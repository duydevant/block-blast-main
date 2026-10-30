import type { ReplaySummary } from "@/modules/block-puzzle/engine/replay-recorded-game-actions"
import type { DailyRunGameReward, RankedGameMode } from "@/modules/player-profile/player-profile-types"
import { MARATHON_SCORE } from "@/modules/progression/achievement-catalog"
import { formFromRecent, tierForForm, withRecentFormScore } from "@/modules/progression/player-form-rules"
import type { StoredPlayer } from "@/server/profile/stored-player-document"
import { type MissionDay, missionBandFor } from "@/server/progression/mission-day-documents"

import { applyVerifiedGameToModeStats } from "./apply-verified-game-to-player-stats"

/**
 * Ván có tính phong độ không: cùng tập ván với bảng Mọi lúc (Vô tận + lượt đầu thử thách ngày).
 * Mọi ván ≥ 1 nước đều tính (kể cả ván ngắn) để không né được ván xấu bằng "Ván mới" — giống Mastery.
 */
export function countsTowardForm(mode: RankedGameMode, countsForDaily: boolean, firstDailyRun: boolean, moveCount: number): boolean {
  if (moveCount < 1) return false
  return mode === "classic" || (mode === "daily" && countsForDaily && firstDailyRun)
}

/** Các field người chơi / doc nhiệm vụ ngày suy ra từ một ván đã replay (thuần, không I/O). */
export function verifiedGamePlayerUpdates(input: {
  stored: StoredPlayer
  summary: ReplaySummary
  mode: RankedGameMode
  countsForDaily: boolean
  firstDailyRun: boolean
  missionDay: MissionDay
  dailyReward: DailyRunGameReward | null
  /** Ván bị gắn cờ nghi bot: không tính phong độ. */
  suspect?: boolean
}) {
  const { stored, summary, missionDay, dailyReward } = input
  const recentFormScores = !input.suspect && countsTowardForm(input.mode, input.countsForDaily, input.firstDailyRun, summary.moveCount)
    ? withRecentFormScore(stored.recentFormScores, summary.score)
    : stored.recentFormScores
  // Lượt này làm ngày thử thách lần đầu đạt ★★★.
  const reachedThreeStars = dailyReward !== null && dailyReward.stars >= 3 && dailyReward.newStars > 0
  return {
    recentFormScores,
    tierAfter: tierForForm(formFromRecent(recentFormScores)),
    statsByMode: applyVerifiedGameToModeStats(stored.statsByMode, input.mode, summary.score),
    missionBand: missionBandFor(missionDay, stored),
    firstGameToday: missionDay.gamesToday === 0,
    gamesToday: missionDay.gamesToday + 1,
    games1000: missionDay.games1000 + (summary.score >= MARATHON_SCORE ? 1 : 0),
    dailyThreeStarDays: stored.dailyThreeStarDays + (reachedThreeStars ? 1 : 0),
  }
}
