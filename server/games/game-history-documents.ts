import { FieldValue, Timestamp } from "firebase-admin/firestore"
import { z } from "zod"

import type { ReplaySummary } from "@/modules/block-puzzle/engine/replay-recorded-game-actions"
import type { GameHistoryEntry } from "@/modules/player-profile/game-history-types"
import type { RankedGameMode } from "@/modules/player-profile/player-profile-types"

import { isCountedPureGame } from "./apply-verified-game-to-player-stats"

/** Lịch sử ván giữ bấy lâu (TTL policy trên field `expireAt` của collection group `games`). */
export const HISTORY_TTL_MS = 180 * 24 * 60 * 60 * 1000

/** Doc users/{uid}/games/{gameId} — ghi trong transaction nộp ván. */
export function historyDocFor(input: {
  mode: RankedGameMode
  summary: ReplaySummary
  levelId: number | null
  day: string | null
  finishedAt: FieldValue
  nowMs: number
}) {
  const { summary } = input
  return {
    mode: input.mode,
    score: summary.score,
    moveCount: summary.moveCount,
    linesCleared: summary.linesCleared,
    bestCombo: summary.bestCombo,
    boardClears: summary.boardClears,
    multiClears3: summary.runStats.multiClears[1],
    pure: isCountedPureGame(summary),
    levelId: input.levelId,
    day: input.day,
    finishedAt: input.finishedAt,
    expireAt: Timestamp.fromMillis(input.nowMs + HISTORY_TTL_MS),
  }
}

/**
 * Bộ đếm cả năm (users/{uid}/years/{YYYY}) cho tổng kết năm. Chỉ dùng increment/max nên không cần đọc doc;
 * `firstGameToday` (suy từ doc nhiệm vụ của ngày) quyết định có cộng thêm một ngày chơi không.
 */
export function yearCounterUpdate(summary: ReplaySummary, mode: RankedGameMode, firstGameToday: boolean) {
  return {
    games: FieldValue.increment(1),
    totalScore: FieldValue.increment(summary.score),
    lines: FieldValue.increment(summary.linesCleared),
    boardClears: FieldValue.increment(summary.boardClears),
    pureGames: FieldValue.increment(isCountedPureGame(summary) ? 1 : 0),
    bestScore: FieldValue.maximum(summary.score),
    bestCombo: FieldValue.maximum(summary.bestCombo),
    days: FieldValue.increment(firstGameToday ? 1 : 0),
    modes: { [mode]: FieldValue.increment(1) },
  }
}

/** Đọc lại doc lịch sử (doc hỏng → bỏ qua). */
export const storedHistorySchema = z.object({
  mode: z.enum(["classic", "daily", "challenge", "level", "duel", "logic"]),
  score: z.number().int().nonnegative(),
  moveCount: z.number().int().nonnegative(),
  linesCleared: z.number().int().nonnegative().catch(0),
  bestCombo: z.number().int().nonnegative().catch(0),
  boardClears: z.number().int().nonnegative().catch(0),
  multiClears3: z.number().int().nonnegative().catch(0),
  pure: z.boolean().catch(false),
  levelId: z.number().int().positive().nullable().catch(null),
  day: z.string().nullable().catch(null),
  finishedAt: z.instanceof(Timestamp),
})

export function toGameHistoryEntry(gameId: string, data: unknown): GameHistoryEntry | null {
  const parsed = storedHistorySchema.safeParse(data)
  if (!parsed.success) return null
  const { finishedAt, ...rest } = parsed.data
  return { gameId, ...rest, finishedAt: finishedAt.toMillis() }
}
