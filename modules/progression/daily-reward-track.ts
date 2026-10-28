/**
 * Thưởng hoàn thành thử thách ngày theo vòng 7 ngày của chuỗi: ngày càng xa càng nhiều xu, ngày 7 là rương lớn.
 * Hết 7 ngày thì quay lại ngày 1 (chuỗi vẫn tiếp tục đếm). Dùng chung client (hiển thị) và server (cấp thưởng).
 */
export const DAILY_REWARD_TRACK = [20, 30, 40, 50, 60, 80, 150] as const

/** Ngày trong vòng thưởng (1..7) ứng với độ dài chuỗi (chuỗi 0 coi như ngày 1). */
export function dailyRewardDay(streak: number): number {
  return ((Math.max(1, Math.floor(streak)) - 1) % DAILY_REWARD_TRACK.length) + 1
}

export function dailyRewardCoins(streak: number): number {
  return DAILY_REWARD_TRACK[dailyRewardDay(streak) - 1]
}

/** Trạng thái thưởng hôm nay trả kèm GET /api/daily. */
export interface DailyRewardStatus {
  /** Ngày trong vòng 7 ngày (1..7). */
  day: number
  coins: number
  /** Đã xong lượt tính điểm hôm nay và chưa nhận. */
  claimable: boolean
  claimed: boolean
}

/** POST /api/daily/claim */
export interface ClaimDailyRewardResponse {
  coins: number
  day: number
  /** Tổng xu sau khi nhận. */
  totalCoins: number
}
