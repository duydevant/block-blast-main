/**
 * Mục tiêu của sự kiện tuần — lý do để chơi: (1) mốc điểm trong 1 ván, mỗi mốc nhận xu một lần;
 * (2) thưởng theo hạng cuối tuần trên bảng sự kiện, nhận vào tuần sau. Dùng chung client và server.
 */
export const EVENT_SCORE_MILESTONES = [
  { score: 1000, coins: 30 },
  { score: 3000, coins: 80 },
  { score: 6000, coins: 150 },
] as const

/** Bậc hạng (hạng ≤ maxRank); người có điểm nhưng ngoài top 100 vẫn nhận quà tham gia. */
export const EVENT_RANK_TIERS = [
  { maxRank: 1, coins: 1000, key: "1" },
  { maxRank: 3, coins: 500, key: "3" },
  { maxRank: 10, coins: 300, key: "10" },
  { maxRank: 100, coins: 100, key: "100" },
] as const
export const EVENT_PARTICIPATION_COINS = 30

/** Xu thưởng xếp hạng cuối tuần; null = không chơi sự kiện tuần đó (không có quà). */
export function eventRankRewardCoins(rank: number | null): number {
  if (rank === null) return 0
  return EVENT_RANK_TIERS.find((tier) => rank <= tier.maxRank)?.coins ?? EVENT_PARTICIPATION_COINS
}

export interface EventMilestoneStatus {
  index: number
  score: number
  coins: number
  reached: boolean
  claimed: boolean
}

export interface EventWeekStatus {
  week: string
  ruleId: string
  /** Điểm cao nhất của mình trên bảng sự kiện tuần đó (null = chưa chơi). */
  bestScore: number | null
  rank: number | null
  milestones: EventMilestoneStatus[]
}

/** GET /api/events */
export interface EventStatusResponse {
  current: EventWeekStatus & { endsAt: number }
  /** Tuần trước (chỉ khi đã chơi): nhận thưởng hạng + mốc chưa nhận. */
  previous: (EventWeekStatus & { rankCoins: number; rankClaimed: boolean }) | null
}

/** POST /api/events/claim */
export type ClaimEventRewardRequest = { week: string; kind: "milestone"; index: number } | { week: string; kind: "rank" }

export interface ClaimEventRewardResponse {
  coins: number
  totalCoins: number
}

export function milestoneStatuses(bestScore: number | null, claimed: readonly number[]): EventMilestoneStatus[] {
  return EVENT_SCORE_MILESTONES.map((milestone, index) => ({
    index,
    score: milestone.score,
    coins: milestone.coins,
    reached: bestScore !== null && bestScore >= milestone.score,
    claimed: claimed.includes(index),
  }))
}
