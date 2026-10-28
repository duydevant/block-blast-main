import type { LeaderboardRow, MyLeaderboardStanding } from "@/modules/leaderboard/leaderboard-types"

/** Số dòng giữ trong doc snapshot của mỗi bảng (1 lượt đọc cho cả bảng). */
export const LEADERBOARD_TOP_SIZE = 100

/**
 * Chèn/cập nhật điểm tốt nhất của một người vào top list (giảm dần, mỗi uid một dòng).
 * Trả về null nếu top không đổi → khỏi ghi snapshot. Bằng điểm: ai đạt trước đứng trên.
 */
export function mergeScoreIntoTopList(top: readonly LeaderboardRow[], row: LeaderboardRow, size = LEADERBOARD_TOP_SIZE): LeaderboardRow[] | null {
  const existing = top.find((item) => item.uid === row.uid)
  if (existing && existing.score >= row.score) return null
  if (!existing && top.length >= size && row.score <= top[top.length - 1].score) return null

  const others = top.filter((item) => item.uid !== row.uid)
  const insertAt = others.findIndex((item) => item.score < row.score)
  const merged = insertAt === -1 ? [...others, row] : [...others.slice(0, insertAt), row, ...others.slice(insertAt)]
  return merged.slice(0, size)
}

/** Hạng = số người điểm cao hơn + 1 (bằng điểm thì đồng hạng). Tính từ top nếu mình nằm trong top. */
export function standingFromTop(top: readonly LeaderboardRow[], score: number): MyLeaderboardStanding {
  const above = top.filter((row) => row.score > score)
  return { score, rank: above.length + 1, nextScore: above.length > 0 ? above[above.length - 1].score : null }
}
