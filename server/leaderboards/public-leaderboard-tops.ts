import "server-only"

import { LEADERBOARD_PERIODS, type LeaderboardPeriod, type LeaderboardRow } from "@/modules/leaderboard/leaderboard-types"
import { getAdminFirestore } from "@/server/firebase/firebase-admin-app"

import { boardIdForPeriod } from "./leaderboard-board-ids"
import { leaderboardRef, parseLeaderboardTop } from "./leaderboard-documents"

/** Số dòng render sẵn trong HTML (cho Google + hiện ngay trước khi đăng nhập xong). */
export const PUBLIC_TOP_SIZE = 20

export type PublicLeaderboardTops = Record<LeaderboardPeriod, LeaderboardRow[]>

/**
 * Top các bảng hiện hành, 1 lượt đọc/bảng.
 * Lúc build mà lỗi (VD CI không có env Firebase) → bảng rỗng để build vẫn qua; lúc chạy thì ném lỗi
 * để ISR giữ bản trang cũ thay vì lưu đè một trang rỗng suốt 5 phút.
 */
export async function getPublicLeaderboardTops(now = new Date()): Promise<PublicLeaderboardTops> {
  const empty = Object.fromEntries(LEADERBOARD_PERIODS.map((period) => [period, []])) as unknown as PublicLeaderboardTops
  try {
    const db = getAdminFirestore()
    const snaps = await db.getAll(...LEADERBOARD_PERIODS.map((period) => leaderboardRef(db, boardIdForPeriod(period, now))))
    return Object.fromEntries(
      LEADERBOARD_PERIODS.map((period, index) => [period, parseLeaderboardTop(snaps[index].data()).slice(0, PUBLIC_TOP_SIZE)])
    ) as PublicLeaderboardTops
  } catch (error) {
    if (process.env.NEXT_PHASE !== "phase-production-build") throw error
    console.warn("[leaderboard] public tops unavailable at build time", error)
    return empty
  }
}
