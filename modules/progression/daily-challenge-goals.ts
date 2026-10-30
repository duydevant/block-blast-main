/**
 * Luật thử thách ngày (dùng chung client + server): mỗi ngày 3 lượt tính điểm, mốc riêng theo phong độ của chính
 * người chơi (phải hơn chính mình hôm qua), sao tuần mở rương, thưởng hạng theo tổng điểm cả tuần.
 */

import { median } from "./score-statistics"

/** Số lượt tính điểm mỗi ngày (lấy lượt cao nhất); lượt sau đó là luyện tập. */
export const DAILY_RUNS_PER_DAY = 3
/** Phong độ của người chưa từng chơi thử thách. */
export const DEFAULT_DAILY_FORM = 1500
/** Phong độ = trung vị điểm của tối đa bấy nhiêu ngày gần nhất có chơi. */
export const DAILY_FORM_DAYS = 7
/** ★ / ★★ / ★★★ = phong độ × hệ số (làm tròn 50). */
export const DAILY_STAR_FACTORS = [0.7, 1.1, 1.5] as const
export const DAILY_STAR_COINS = [20, 40, 80] as const
/** Phá kỷ lục thử thách của chính mình (mọi thời điểm). */
export const DAILY_RECORD_COINS = 100
export const DAILY_MAX_STARS = DAILY_STAR_FACTORS.length
/** Rương tuần mở theo tổng sao 7 ngày (tối đa 21). */
export const WEEK_STAR_CHESTS = [
  { stars: 10, coins: 150 },
  { stars: 18, coins: 400 },
] as const
/** Thưởng hạng bảng tuần (tổng điểm 7 ngày); có chơi nhưng ngoài top 100 vẫn có quà tham gia. */
export const WEEK_RANK_TIERS = [
  { maxRank: 1, coins: 1000, key: "1" },
  { maxRank: 3, coins: 500, key: "3" },
  { maxRank: 10, coins: 300, key: "10" },
  { maxRank: 100, coins: 100, key: "100" },
] as const
export const WEEK_PARTICIPATION_COINS = 30

const ROUND_TO = 50

/** Mốc của một ngày, chốt lúc bắt đầu lượt đầu tiên của ngày đó. */
export interface DailyGoals {
  /** Phong độ dùng để tính mốc. */
  form: number
  /** Điểm cần cho ★, ★★, ★★★ (tăng dần). */
  targets: number[]
  /** Điểm thử thách cao nhất từ trước tới giờ (phải vượt để phá kỷ lục); null = chưa từng chơi. */
  record: number | null
}

/** Kết quả trong ngày (điểm cao nhất + mốc đã đạt), lưu trong doc ngày. */
export interface DailyDayProgress {
  stars: number
  recordBroken: boolean
}

/** Phong độ từ điểm cao nhất các ngày đã chơi, ngày gần nhất trước. */
export function dailyFormFor(recentBests: readonly number[]): number {
  const recent = recentBests.slice(0, DAILY_FORM_DAYS)
  return recent.length === 0 ? DEFAULT_DAILY_FORM : median(recent)
}

export function dailyGoalsFor(recentBests: readonly number[], allTimeBest: number | null): DailyGoals {
  const form = dailyFormFor(recentBests)
  const targets: number[] = []
  for (const factor of DAILY_STAR_FACTORS) {
    const target = Math.max(ROUND_TO, Math.round((form * factor) / ROUND_TO) * ROUND_TO)
    // Phong độ rất thấp → các mốc làm tròn có thể trùng nhau; luôn tăng dần.
    targets.push(Math.max(target, (targets.at(-1) ?? 0) + ROUND_TO))
  }
  return { form, targets, record: allTimeBest !== null && allTimeBest > 0 ? allTimeBest : null }
}

/** Điểm cao nhất các ngày gần đây (khoá "YYYYMMDD" → điểm), lưu trên doc người chơi để tính phong độ. */
export type RecentDailyBests = Record<string, number>

/** Điểm các ngày trước `day`, ngày gần nhất trước (đầu vào của dailyFormFor). */
export function recentBestsBefore(recent: RecentDailyBests, day: string): number[] {
  return Object.keys(recent)
    .filter((key) => key < day)
    .sort()
    .reverse()
    .map((key) => recent[key])
}

/** Ghi điểm cao nhất của `day`, chỉ giữ DAILY_FORM_DAYS + 1 ngày mới nhất (đủ cho phong độ của ngày mai). */
export function withRecentBest(recent: RecentDailyBests, day: string, best: number): RecentDailyBests {
  const merged = { ...recent, [day]: Math.max(recent[day] ?? 0, best) }
  const keep = Object.keys(merged).sort().slice(-(DAILY_FORM_DAYS + 1))
  return Object.fromEntries(keep.map((key) => [key, merged[key]]))
}

export function starsForScore(goals: DailyGoals, score: number): number {
  return goals.targets.filter((target) => score >= target).length
}

/** Mốc kế tiếp chưa đạt (cho HUD); null = đã đạt hết sao và kỷ lục. */
export function nextDailyGoal(goals: DailyGoals, score: number): { kind: "star"; stars: number; target: number } | { kind: "record"; target: number } | null {
  const stars = starsForScore(goals, score)
  if (stars < goals.targets.length) return { kind: "star", stars: stars + 1, target: goals.targets[stars] }
  return goals.record !== null && score <= goals.record ? { kind: "record", target: goals.record + 1 } : null
}

export interface DailyRunReward {
  /** Tiến độ của ngày sau lượt này. */
  progress: DailyDayProgress
  /** Số sao mới đạt ở lượt này (0 nếu không hơn lượt trước). */
  newStars: number
  /** Lượt này vừa phá kỷ lục (lần đầu trong ngày). */
  recordBroken: boolean
  coins: number
}

/** Thưởng của một lượt: chỉ mốc chưa đạt trong ngày mới được cộng (mỗi mốc 1 lần/ngày). */
export function dailyRunReward(goals: DailyGoals, before: DailyDayProgress, score: number): DailyRunReward {
  const stars = Math.max(before.stars, starsForScore(goals, score))
  const recordBroken = !before.recordBroken && goals.record !== null && score > goals.record
  let coins = 0
  for (let star = before.stars; star < stars; star++) coins += DAILY_STAR_COINS[star]
  if (recordBroken) coins += DAILY_RECORD_COINS
  return { progress: { stars, recordBroken: before.recordBroken || recordBroken }, newStars: stars - before.stars, recordBroken, coins }
}

/** Xu thưởng hạng tuần; null = không chơi tuần đó. */
export function weekRankCoins(rank: number | null): number {
  if (rank === null) return 0
  return WEEK_RANK_TIERS.find((tier) => rank <= tier.maxRank)?.coins ?? WEEK_PARTICIPATION_COINS
}

export interface WeekChestStatus {
  index: number
  stars: number
  coins: number
  reached: boolean
  claimed: boolean
}

export function weekChestStatuses(stars: number, claimed: readonly number[]): WeekChestStatus[] {
  return WEEK_STAR_CHESTS.map((chest, index) => ({ index, stars: chest.stars, coins: chest.coins, reached: stars >= chest.stars, claimed: claimed.includes(index) }))
}

/** Tuần của thử thách: tổng điểm 7 ngày, hạng, sao và rương. */
export interface DailyWeekStatus {
  week: string
  /** Tổng điểm cao nhất từng ngày; null = chưa chơi tuần này. */
  total: number | null
  rank: number | null
  stars: number
  chests: WeekChestStatus[]
}

/** POST /api/daily/week-claim */
export type ClaimDailyWeekRequest = { week: string; kind: "chest"; index: number } | { week: string; kind: "rank" }

export interface ClaimDailyWeekResponse {
  coins: number
  totalCoins: number
}
