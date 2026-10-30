import type { PlayerTier, PlayerTierId } from "./player-form-rules"

/**
 * Mùa giải tháng (giống Season leaders của Minesweeper): bảng điểm / phong độ / thuần riêng mỗi tháng, huy hiệu
 * theo Bậc cao nhất trong mùa, thưởng hạng nhận ở mùa sau khi bảng đã chốt. Bậc KHÔNG reset (phong độ là cửa sổ
 * trượt 20 ván nên tự làm mới). Thuần, dùng chung client + server.
 */

/** Số ván tính điểm tối thiểu trong mùa để nhận huy hiệu + quà tham gia. */
export const SEASON_MIN_GAMES = 20
/** Thưởng hạng mùa trước chỉ nhận được sau khi tháng kết thúc bấy lâu (bảng đã ổn định). Ván nộp sau 00:00 ngày 1 tính cho mùa mới. */
export const SEASON_GRACE_MS = 60 * 60 * 1000

export const SEASON_RANK_TIERS = [
  { maxRank: 1, coins: 2000 },
  { maxRank: 3, coins: 1200 },
  { maxRank: 10, coins: 800 },
  { maxRank: 100, coins: 300 },
] as const
export const SEASON_PARTICIPATION_COINS = 100

/** Xu thưởng hạng mùa (bảng điểm mùa); ngoài top 100 nhưng đủ ván → quà tham gia. */
export function seasonRankCoins(rank: number | null, games: number): number {
  const tier = rank === null ? undefined : SEASON_RANK_TIERS.find((item) => rank <= item.maxRank)
  if (tier) return tier.coins
  return games >= SEASON_MIN_GAMES ? SEASON_PARTICIPATION_COINS : 0
}

/** Id huy hiệu mùa "2026-11:gold" (chỉ khi đủ ván và đã xếp Bậc). */
export function seasonBadgeId(season: string, peakTier: PlayerTier, games: number): string | null {
  return games >= SEASON_MIN_GAMES && peakTier !== "unranked" ? `${season}:${peakTier}` : null
}

export function parseSeasonBadge(id: string): { season: string; tier: PlayerTierId } | null {
  const match = /^(\d{4}-\d{2}):([a-z]+)$/.exec(id)
  return match ? { season: match[1], tier: match[2] as PlayerTierId } : null
}

/** Mùa trước (nếu có chơi): hạng bảng điểm mùa đã chốt + thưởng. */
export interface PreviousSeasonStatus {
  season: string
  games: number
  peakTier: PlayerTier
  rank: number | null
  rankCoins: number
  /** Huy hiệu sẽ nhận (null = chưa đủ ván / chưa xếp Bậc). */
  badge: string | null
  /** Bảng đã chốt (hết giờ ân hạn) → nhận được. */
  claimable: boolean
  claimed: boolean
}

/** GET /api/seasons */
export interface SeasonStatusResponse {
  season: string
  /** Epoch ms lúc mùa kết thúc (00:00 ngày 1 tháng sau, giờ VN). */
  endsAt: number
  /** Số ngày còn lại (server tính, làm tròn lên). */
  daysLeft: number
  games: number
  peakTier: PlayerTier
  missions: import("./season-mission-catalog").SeasonMissionStatus[]
  previous: PreviousSeasonStatus | null
}

/** POST /api/seasons/claim */
export type SeasonClaimRequest = { season: string; kind: "mission"; missionId: string } | { kind: "rank" }

export interface SeasonClaimResponse {
  coins: number
  xp: number
  badge: string | null
  totalCoins: number
}
