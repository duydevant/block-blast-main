import type { LeaderboardPeriod } from "./leaderboard-types"

/**
 * Hạng mục BXH (giống Best players của Minesweeper: mỗi kiểu người chơi có bảng của mình).
 * score = điểm 1 ván (bảng cũ); form = phong độ (trung vị 20 ván, ghi đè được giảm); pure = ván thuần;
 * combo = combo cao nhất; stars = tổng sao màn chơi; logic = điểm chế độ "Không bế tắc" (tách bảng như NG / Standard).
 */
export const LEADERBOARD_CATEGORIES = ["score", "form", "pure", "combo", "stars", "logic"] as const
export type LeaderboardCategory = (typeof LEADERBOARD_CATEGORIES)[number]

/** Kỳ hợp lệ của từng hạng mục (tab đầu tiên là mặc định). */
export const CATEGORY_PERIODS: Record<LeaderboardCategory, readonly LeaderboardPeriod[]> = {
  score: ["today", "weekly", "challenge", "alltime", "daily"],
  form: ["alltime"],
  pure: ["weekly", "alltime"],
  combo: ["alltime"],
  stars: ["alltime"],
  logic: ["weekly", "alltime"],
}

export function isLeaderboardCategory(value: string): value is LeaderboardCategory {
  return (LEADERBOARD_CATEGORIES as readonly string[]).includes(value)
}

export function isCategoryPeriod(category: LeaderboardCategory, period: LeaderboardPeriod): boolean {
  return CATEGORY_PERIODS[category].includes(period)
}
