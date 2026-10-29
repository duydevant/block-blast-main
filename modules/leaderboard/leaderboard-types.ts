/** Kiểu dữ liệu bảng xếp hạng dùng chung giữa API (server) và UI (client). */

import type { PlayerTierId } from "@/modules/progression/player-form-rules"

/** Tab trang /leaderboard: "today" = mọi ván tính điểm hôm nay, "challenge" = tổng điểm thử thách ngày cả tuần. */
export const LEADERBOARD_TABS = ["today", "weekly", "challenge", "alltime"] as const
export type LeaderboardTab = (typeof LEADERBOARD_TABS)[number]

/** Mọi bảng hiện hành đọc được qua API; "daily" = riêng thử thách ngày (hiện ở trang /daily). */
export const LEADERBOARD_PERIODS = [...LEADERBOARD_TABS, "daily"] as const
export type LeaderboardPeriod = (typeof LEADERBOARD_PERIODS)[number]

export interface LeaderboardRow {
  uid: string
  /** null = khách chưa đặt tên → UI hiện "Khách #ABCD". */
  displayName: string | null
  score: number
  /** Bậc của người chơi lúc ghi điểm (hàng cũ không có). */
  tier?: PlayerTierId
}

export interface MyLeaderboardStanding {
  score: number
  rank: number
  /** Điểm của người ngay trên mình (null nếu đang hạng 1). */
  nextScore: number | null
}

/** GET /api/leaderboards/{period} */
export interface LeaderboardResponse {
  period: LeaderboardPeriod
  /** VD "today-20261027", "daily-20261027", "weekly-2026-W44", "alltime". */
  boardId: string
  top: LeaderboardRow[]
  me: MyLeaderboardStanding | null
}
