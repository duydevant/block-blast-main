import type { LeaderboardPeriod } from "@/modules/leaderboard/leaderboard-types"
import type { RankedGameMode } from "@/modules/player-profile/player-profile-types"
import { seasonKeyFor } from "@/lib/vn-calendar"
import { dayKeyFor, isoWeekKeyFor } from "@/server/daily/daily-challenge-calendar"

export const ALLTIME_BOARD_ID = "alltime"

/** Mọi ván tính điểm trong ngày (Vô tận + lượt đầu thử thách ngày), theo ngày nộp. */
export const todayBoardId = (day: string) => `today-${day}`
/** Riêng thử thách ngày (cùng bộ khối cho mọi người): điểm cao nhất trong 3 lượt, theo ngày của thử thách. */
export const dailyBoardId = (day: string) => `daily-${day}`
export const weeklyBoardId = (now: Date) => `weekly-${isoWeekKeyFor(now)}`
/** Mùa giải tháng (giờ VN): điểm 1 ván cao nhất trong tháng. */
export const seasonBoardId = (season: string) => `season-${season}`
/** Thử thách tuần: entry = tổng điểm cao nhất của từng ngày trong tuần (không phải điểm 1 ván). */
export const challengeWeekBoardId = (week: string) => `challenge-week-${week}`

/** Lượt thử thách nộp trễ vẫn cộng vào tổng tuần trong 1 giờ sau khi tuần kết thúc, sau đó bảng chốt để trao hạng. */
export const CHALLENGE_WEEK_GRACE_MS = 60 * 60 * 1000

/** Bảng thử thách tuần `week` còn nhận điểm lúc `now` không. */
export function isChallengeWeekOpen(week: string, now: Date): boolean {
  return isoWeekKeyFor(now) === week || isoWeekKeyFor(new Date(now.getTime() - CHALLENGE_WEEK_GRACE_MS)) === week
}

/** Bảng hiện hành của từng kỳ (ngày/tuần theo giờ VN). */
export function boardIdForPeriod(period: LeaderboardPeriod, now: Date): string {
  if (period === "today") return todayBoardId(dayKeyFor(now))
  if (period === "daily") return dailyBoardId(dayKeyFor(now))
  if (period === "weekly") return weeklyBoardId(now)
  if (period === "challenge") return challengeWeekBoardId(isoWeekKeyFor(now))
  if (period === "season") return seasonBoardId(seasonKeyFor(now))
  return ALLTIME_BOARD_ID
}

/**
 * Ván tính điểm ghi vào bảng (giữ điểm cao nhất) nào. Hôm nay ⊂ tuần này ⊂ mọi lúc: cùng một tập ván (Vô tận +
 * lượt **đầu** của thử thách ngày), khác khoảng thời gian. Bảng tổng tuần của thử thách ghi riêng (cộng dồn).
 * - classic → hôm nay + tuần + mùa (tháng) + mọi lúc.
 * - daily (lượt tính điểm) → bảng thử thách của ngày đó (giữ lượt cao nhất); lượt đầu thêm hôm nay + tuần + mọi lúc
 *   (lượt 2, 3 đã biết trước bộ khối nên không đua bảng chung). Lượt luyện tập không vào bảng nào.
 * - challenge/level/duel → không bảng nào (seed biết trước hoặc chơi lại được nhiều lần).
 */
export function boardIdsForRankedGame(mode: RankedGameMode, now: Date, day: string | null, countsForDaily: boolean, firstDailyRun = true): string[] {
  const scoreBoards = [todayBoardId(dayKeyFor(now)), weeklyBoardId(now), seasonBoardId(seasonKeyFor(now)), ALLTIME_BOARD_ID]
  if (mode === "daily") return day && countsForDaily ? [dailyBoardId(day), ...(firstDailyRun ? scoreBoards : [])] : []
  if (mode === "classic") return scoreBoards
  return []
}
