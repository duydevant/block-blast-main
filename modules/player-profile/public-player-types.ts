import type { PlayerTier } from "@/modules/progression/player-form-rules"

import type { DuelStats, StatsByMode } from "./player-profile-types"

/** Hồ sơ công khai (/u/{tag}) — không uid, không xu, không thông tin mời bạn. */
export interface PublicPlayerProfile {
  tag: string
  displayName: string | null
  guestTag: string
  form: number | null
  tier: PlayerTier
  highestTier: PlayerTier
  stats: {
    gamesPlayed: number
    bestScore: number
    bestCombo: number
    boardClears: number
    totalLinesCleared: number
    bestPureScore: number
  }
  statsByMode: StatsByMode
  levelStarsTotal: number
  duelStats: DuelStats
  bestStreak: number
  achievements: string[]
  /** Replay ván kỷ lục (null = chưa có). */
  bestReplayId: string | null
}
