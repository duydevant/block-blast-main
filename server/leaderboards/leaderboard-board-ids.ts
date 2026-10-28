import type { LeaderboardPeriod } from "@/modules/leaderboard/leaderboard-types"
import type { RankedGameMode } from "@/modules/player-profile/player-profile-types"
import { dayKeyFor, isoWeekKeyFor } from "@/server/daily/daily-challenge-calendar"

export const ALLTIME_BOARD_ID = "alltime"

/** Mọi ván tính điểm trong ngày (Vô tận + lượt thử thách ngày), theo ngày nộp. */
export const todayBoardId = (day: string) => `today-${day}`
/** Riêng thử thách ngày (cùng bộ khối cho mọi người), theo ngày của thử thách. */
export const dailyBoardId = (day: string) => `daily-${day}`
export const weeklyBoardId = (now: Date) => `weekly-${isoWeekKeyFor(now)}`
export const eventBoardId = (week: string) => `event-${week}`

/** Ván sự kiện nộp trễ (mạng chậm) vẫn được tính trong 1 giờ sau khi tuần kết thúc, sau đó bảng chốt. */
export const EVENT_SUBMIT_GRACE_MS = 60 * 60 * 1000

/** Bảng sự kiện tuần `week` còn nhận điểm lúc `now` không. */
export function isEventWeekOpen(week: string, now: Date): boolean {
  return isoWeekKeyFor(now) === week || isoWeekKeyFor(new Date(now.getTime() - EVENT_SUBMIT_GRACE_MS)) === week
}

/** Bảng hiện hành của từng kỳ (ngày/tuần theo giờ VN). */
export function boardIdForPeriod(period: LeaderboardPeriod, now: Date): string {
  if (period === "today") return todayBoardId(dayKeyFor(now))
  if (period === "daily") return dailyBoardId(dayKeyFor(now))
  if (period === "weekly") return weeklyBoardId(now)
  if (period === "event") return eventBoardId(isoWeekKeyFor(now))
  return ALLTIME_BOARD_ID
}

/**
 * Ván tính điểm ghi vào bảng nào. Hôm nay ⊂ tuần này ⊂ mọi lúc: cùng một tập ván (Vô tận + lượt thử thách ngày
 * tính điểm), khác khoảng thời gian — điểm cao nhất hôm nay luôn có mặt ở bảng tuần và mọi lúc.
 * - classic → hôm nay + tuần + mọi lúc + sự kiện tuần này (Vô tận cũng tính cho mục tiêu/hạng sự kiện).
 * - daily (lượt tính điểm, chỉ lượt đầu của ngày) → thêm bảng thử thách của ngày đó; lượt luyện tập không vào bảng nào.
 * - event → bảng sự kiện của **tuần bắt đầu ván** (luật thay đổi theo tuần), chốt sau giờ ân hạn.
 * - challenge/level/duel → không bảng nào (seed biết trước hoặc chơi lại được nhiều lần).
 */
export function boardIdsForRankedGame(
  mode: RankedGameMode,
  now: Date,
  day: string | null,
  countsForDaily: boolean,
  eventWeek: string | null = null
): string[] {
  const scoreBoards = [todayBoardId(dayKeyFor(now)), weeklyBoardId(now), ALLTIME_BOARD_ID]
  if (mode === "daily") return day && countsForDaily ? [dailyBoardId(day), ...scoreBoards] : []
  // Bảng tuần trước đã chốt (thưởng hạng tính theo nó) → ván cũ nộp muộn chỉ cộng thống kê.
  if (mode === "event") return eventWeek && isEventWeekOpen(eventWeek, now) ? [eventBoardId(eventWeek)] : []
  if (mode === "challenge" || mode === "level" || mode === "duel") return []
  return [...scoreBoards, eventBoardId(isoWeekKeyFor(now))]
}
