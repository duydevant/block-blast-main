import { median } from "./score-statistics"

/**
 * Phong độ = trung vị điểm các ván Vô tận gần nhất (giống Mastery: đo độ ổn định, không phải một ván ăn may).
 * Bậc suy ra từ phong độ. Thuần, dùng chung client (hiển thị) và server (cộng thưởng).
 */

/** Số ván gần nhất tính phong độ. */
export const FORM_WINDOW = 20
/** Chưa đủ số ván này → chưa xếp Bậc ("Tập sự"). */
export const FORM_MIN_GAMES = 10

/**
 * Ngưỡng TẠM — chỉnh theo phân phối điểm thật của người chơi (percentile 50/75/90/97/99.5).
 * `coins` = thưởng một lần khi lần đầu đạt Bậc đó.
 */
export const PLAYER_TIERS = [
  { id: "bronze", minForm: 0, coins: 0 },
  { id: "silver", minForm: 800, coins: 50 },
  { id: "gold", minForm: 1500, coins: 100 },
  { id: "platinum", minForm: 3000, coins: 200 },
  { id: "diamond", minForm: 6000, coins: 400 },
  { id: "master", minForm: 12000, coins: 800 },
] as const

export type PlayerTierId = (typeof PLAYER_TIERS)[number]["id"]
/** "unranked" = chưa đủ FORM_MIN_GAMES ván. */
export type PlayerTier = PlayerTierId | "unranked"

export const PLAYER_TIER_IDS: readonly PlayerTierId[] = PLAYER_TIERS.map((tier) => tier.id)

/** Thêm điểm một ván vào danh sách gần nhất (mới nhất ở cuối), giữ tối đa FORM_WINDOW. */
export function withRecentFormScore(recent: readonly number[], score: number): number[] {
  return [...recent, score].slice(-FORM_WINDOW)
}

/** Phong độ; null khi chưa đủ ván. */
export function formFromRecent(recent: readonly number[]): number | null {
  const window = recent.slice(-FORM_WINDOW)
  return window.length < FORM_MIN_GAMES ? null : median(window)
}

export function tierForForm(form: number | null): PlayerTier {
  if (form === null) return "unranked"
  let tier: PlayerTierId = "bronze"
  for (const item of PLAYER_TIERS) if (form >= item.minForm) tier = item.id
  return tier
}

/** Thứ bậc để so sánh: unranked = -1, bronze = 0… */
export function tierRank(tier: PlayerTier | string): number {
  return PLAYER_TIER_IDS.indexOf(tier as PlayerTierId)
}

/** Bậc cao nhất trong danh sách (VD các Bậc đã nhận thưởng); không có → "unranked". */
export function highestTier(tiers: readonly string[]): PlayerTier {
  let best: PlayerTier = "unranked"
  for (const tier of tiers) if (tierRank(tier) > tierRank(best)) best = tier as PlayerTierId
  return best
}

/** Bậc kế tiếp + phong độ cần; null nếu đã ở Bậc cao nhất hoặc chưa xếp Bậc. */
export function nextTierTarget(form: number | null): { tier: PlayerTierId; minForm: number } | null {
  if (form === null) return null
  const next = PLAYER_TIERS.find((item) => item.minForm > form)
  return next ? { tier: next.id, minForm: next.minForm } : null
}

/**
 * Các Bậc lần đầu đạt được (chưa nhận thưởng) khi đang ở `tier`: mọi Bậc từ Đồng tới `tier` chưa có trong `claimed`.
 * Lên thẳng nhiều Bậc thì nhận đủ thưởng các Bậc bỏ qua.
 */
export function newlyReachedTiers(tier: PlayerTier, claimed: readonly string[]): PlayerTierId[] {
  const rank = tierRank(tier)
  return PLAYER_TIERS.filter((item, index) => index <= rank && !claimed.includes(item.id)).map((item) => item.id)
}

export function tierRewardCoins(tiers: readonly PlayerTierId[]): number {
  return PLAYER_TIERS.filter((item) => tiers.includes(item.id)).reduce((sum, item) => sum + item.coins, 0)
}
