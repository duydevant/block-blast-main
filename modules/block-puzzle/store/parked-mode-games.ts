import type { ChallengeOpponent } from "@/modules/challenge/challenge-types"
import type { VariantRun } from "@/modules/game-modes/variant-run"

import { gameReducer } from "../engine/game-state-reducer"
import type { GameState } from "../engine/game-types"
import type { RecordedGameAction } from "../engine/replay-recorded-game-actions"
import { type PendingSubmission, parseSavedRankedGameCloudState, type RankedSession } from "./ranked-game-cloud-state"
import { parseSavedGame } from "./saved-game-schema"

/**
 * Mỗi chế độ giữ ván riêng: Vô tận, thử thách ngày, màn chơi, thách đấu bạn bè.
 * Đấu 1v1 không cất (ván có giờ, rời là bỏ trận).
 */
export const GAME_MODE_SLOTS = ["endless", "daily", "level", "challenge", "logic"] as const
export type GameModeSlot = (typeof GAME_MODE_SLOTS)[number]

/** Ván dở của một chế độ khi người chơi sang chế độ khác (đủ để chơi tiếp và nộp điểm như chưa từng rời). */
export interface ParkedGame {
  game: GameState
  rankedSession: RankedSession | null
  actionLog: RecordedGameAction[]
  dailyDay: string | null
  challenge: ChallengeOpponent | null
  variantRun: VariantRun | null
}

export type ParkedGames = Partial<Record<GameModeSlot, ParkedGame>>

/** Chế độ của ván (null = đấu 1v1, không cất). */
export function modeSlotOf(state: Pick<ParkedGame, "dailyDay" | "challenge" | "variantRun">): GameModeSlot | null {
  // Đấu 1v1 / Đấu trường có giờ hoặc lần thử đã trả xu → không cất (rời ván = nộp phần đã chơi).
  if (state.variantRun?.kind === "duel" || state.variantRun?.kind === "arena" || state.variantRun?.kind === "ranked") return null
  if (state.variantRun) return state.variantRun.kind
  if (state.dailyDay) return "daily"
  if (state.challenge) return "challenge"
  return "endless"
}

/** Ván cất có tính điểm, bị bỏ (VD sang ngày mới / màn khác) → vẫn nộp phần đã chơi để không mất thống kê. */
export function queueParkedGame(pending: PendingSubmission[], parked: ParkedGame | undefined): PendingSubmission[] {
  const session = parked?.rankedSession
  if (!parked || !session || session.queued || (parked.actionLog.length === 0 && !parked.dailyDay)) return pending
  return [...pending, { gameId: session.gameId, uid: session.uid, actions: parked.actionLog }]
}

/** Save trong localStorage (người dùng sửa được): từng ván cất parse riêng, ván hỏng thì bỏ. */
export function parseParkedGames(value: unknown): ParkedGames {
  const record = typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {}
  const parked: ParkedGames = {}
  for (const slot of GAME_MODE_SLOTS) {
    const raw = record[slot]
    if (typeof raw !== "object" || raw === null) continue
    const { game } = parseSavedGame(raw)
    if (!game || game.isGameOver) continue
    const cloud = parseSavedRankedGameCloudState(raw)
    const entry: ParkedGame = {
      game: gameReducer(game, { type: "RESTORE", state: game }),
      rankedSession: cloud.rankedSession,
      actionLog: cloud.actionLog,
      dailyDay: cloud.dailyDay,
      challenge: cloud.challenge,
      variantRun: cloud.variantRun,
    }
    // Chỉ giữ ván nằm đúng ngăn của chế độ mình (save bị sửa tay thì bỏ).
    if (modeSlotOf(entry) === slot) parked[slot] = entry
  }
  return parked
}
