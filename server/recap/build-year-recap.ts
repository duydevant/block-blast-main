import { z } from "zod"

import { arenaPoints } from "@/modules/game-modes/arena-catalog"
import type { RankedGameMode } from "@/modules/player-profile/player-profile-types"
import { totalLevelStars } from "@/modules/progression/achievement-catalog"
import { highestTier } from "@/modules/progression/player-form-rules"
import type { YearRecapResponse } from "@/modules/recap/recap-types"
import type { StoredPlayer } from "@/server/profile/stored-player-document"

const count = z.number().int().nonnegative().catch(0)
const RANKED_MODES = ["classic", "daily", "challenge", "level", "duel", "logic", "arena", "ranked"] as const

/** Doc users/{uid}/years/{YYYY} (bộ đếm ghi khi nộp ván, xem `yearCounterUpdate`). */
const yearDocSchema = z.object({
  games: count,
  totalScore: count,
  lines: count,
  boardClears: count,
  pureGames: count,
  bestScore: count,
  bestCombo: count,
  days: count,
  modes: z.record(z.string(), z.number().int().nonnegative()).catch({}),
})

/** Chế độ có nhiều ván nhất (hoà → theo thứ tự RANKED_MODES); không có → null. */
function favoriteModeOf(modes: Record<string, number>): RankedGameMode | null {
  let best: RankedGameMode | null = null
  for (const mode of RANKED_MODES) if ((modes[mode] ?? 0) > 0 && (best === null || modes[mode] > modes[best])) best = mode
  return best
}

/** Gộp bộ đếm năm + hồ sơ thành tổng kết (thuần). Năm chưa có ván → `{ empty: true }`. */
export function buildYearRecap(year: number, yearData: unknown, stored: StoredPlayer): YearRecapResponse {
  const parsed = yearDocSchema.safeParse(yearData ?? {})
  const doc = parsed.success ? parsed.data : null
  if (!doc || doc.games === 0) return { empty: true, year }
  return {
    empty: false,
    year,
    games: doc.games,
    totalScore: doc.totalScore,
    lines: doc.lines,
    boardClears: doc.boardClears,
    pureGames: doc.pureGames,
    bestScore: doc.bestScore,
    bestCombo: doc.bestCombo,
    days: doc.days,
    favoriteMode: favoriteModeOf(doc.modes),
    longestStreak: stored.streak.best,
    highestTier: highestTier(stored.tierRewardsClaimed),
    arenaPoints: arenaPoints(stored.arena),
    levelStars: totalLevelStars(stored.levelStars),
  }
}
