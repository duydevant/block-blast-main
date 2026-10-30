import type { RankedGameMode } from "@/modules/player-profile/player-profile-types"
import type { PlayerTier } from "@/modules/progression/player-form-rules"

/** Số liệu một năm của người chơi (GET /api/recap/{year}). */
export interface YearRecap {
  empty: false
  year: number
  games: number
  totalScore: number
  lines: number
  boardClears: number
  pureGames: number
  bestScore: number
  bestCombo: number
  /** Số ngày có chơi ít nhất một ván tính điểm. */
  days: number
  /** Chế độ chơi nhiều nhất trong năm (null = chưa có). */
  favoriteMode: RankedGameMode | null
  longestStreak: number
  highestTier: PlayerTier
  arenaPoints: number
  levelStars: number
}

/** Năm chưa có ván nào được ghi. */
export interface EmptyYearRecap {
  empty: true
  year: number
}

export type YearRecapResponse = YearRecap | EmptyYearRecap
