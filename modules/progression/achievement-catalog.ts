import type { PlayerStats } from "@/modules/player-profile/player-profile-types"

import { type PlayerTier, tierRank } from "./player-form-rules"

/** Dữ liệu (đã do server xác minh) để xét thành tích. */
export interface AchievementState {
  stats: PlayerStats
  bestStreak: number
  level: number
  referralCount: number
  /** Tổng sao các màn chơi (tối đa 3 × số màn). */
  levelStarsTotal: number
  duelWins: number
  /** Bậc cao nhất từng đạt. */
  highestTier: PlayerTier
  /** Số ván ≥ MARATHON_SCORE điểm trong ngày hôm nay. */
  todayGames1000: number
  /** Số ngày thử thách đạt ★★★. */
  dailyThreeStarDays: number
}

/** Nhóm hiển thị: chăm chỉ / kỹ năng / phong cách / xã hội. */
export type AchievementCategory = "dedication" | "skill" | "style" | "social"
export const ACHIEVEMENT_CATEGORIES: readonly AchievementCategory[] = ["dedication", "skill", "style", "social"]

export interface Achievement {
  /** Key dịch: `achievement.${id}`. */
  id: string
  category: AchievementCategory
  /** Mốc cần đạt, để UI hiện tiến độ. */
  target: number
  coins: number
  value: (state: AchievementState) => number
}

/** Điểm tối thiểu của một ván tính cho thành tích "Marathon". */
export const MARATHON_SCORE = 1000

const achievement = (id: string, category: AchievementCategory, target: number, coins: number, value: Achievement["value"]): Achievement => ({
  id,
  category,
  target,
  coins,
  value,
})

/** Bậc → số để so mốc (Tập sự = 0, Đồng = 1…). */
const tierValue = (state: AchievementState) => tierRank(state.highestTier) + 1

/** Thứ tự = thứ tự hiển thị trong nhóm. Thêm thành tích chỉ cần thêm dòng ở đây + key dịch. */
export const ACHIEVEMENTS: readonly Achievement[] = [
  achievement("first-game", "dedication", 1, 20, (s) => s.stats.gamesPlayed),
  achievement("games-50", "dedication", 50, 100, (s) => s.stats.gamesPlayed),
  achievement("games-200", "dedication", 200, 300, (s) => s.stats.gamesPlayed),
  achievement("lines-1000", "dedication", 1000, 150, (s) => s.stats.totalLinesCleared),
  achievement("streak-7", "dedication", 7, 100, (s) => s.bestStreak),
  achievement("streak-30", "dedication", 30, 400, (s) => s.bestStreak),
  achievement("level-10", "dedication", 10, 200, (s) => s.level),
  achievement("marathon", "dedication", 10, 150, (s) => s.todayGames1000),
  achievement("score-5000", "skill", 5000, 60, (s) => s.stats.bestScore),
  achievement("score-20000", "skill", 20000, 200, (s) => s.stats.bestScore),
  achievement("combo-15", "skill", 15, 60, (s) => s.stats.bestCombo),
  achievement("combo-30", "skill", 30, 200, (s) => s.stats.bestCombo),
  achievement("tier-gold", "skill", 3, 100, tierValue),
  achievement("tier-diamond", "skill", 5, 400, tierValue),
  achievement("stars-30", "skill", 30, 100, (s) => s.levelStarsTotal),
  achievement("stars-60", "skill", 60, 300, (s) => s.levelStarsTotal),
  achievement("daily-3stars-7", "skill", 7, 200, (s) => s.dailyThreeStarDays),
  achievement("pure-2000", "style", 2000, 80, (s) => s.stats.bestPureScore),
  achievement("pure-10000", "style", 10000, 300, (s) => s.stats.bestPureScore),
  achievement("quad-clear", "style", 4, 100, (s) => s.stats.maxLinesInMove),
  achievement("multi3-50", "style", 50, 150, (s) => s.stats.multiClears3),
  achievement("clears-10", "style", 10, 100, (s) => s.stats.boardClears),
  achievement("duel-wins-10", "social", 10, 150, (s) => s.duelWins),
  achievement("referral-1", "social", 1, 50, (s) => s.referralCount),
]

export const ACHIEVEMENT_IDS: ReadonlySet<string> = new Set(ACHIEVEMENTS.map((item) => item.id))

export function isAchievementMet(item: Achievement, state: AchievementState): boolean {
  return item.value(state) >= item.target
}

/** Thành tích vừa đạt mà chưa nhận thưởng. */
export function newlyMetAchievements(owned: readonly string[], state: AchievementState): Achievement[] {
  return ACHIEVEMENTS.filter((item) => !owned.includes(item.id) && isAchievementMet(item, state))
}

/** Tổng sao từ map màn → sao. */
export function totalLevelStars(levelStars: Readonly<Record<string, number>>): number {
  return Object.values(levelStars).reduce((sum, value) => sum + value, 0)
}
