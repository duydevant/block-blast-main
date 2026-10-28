import type { PlayerStats } from "@/modules/player-profile/player-profile-types"

/** Dữ liệu (đã do server xác minh) để xét thành tích. */
export interface AchievementState {
  stats: PlayerStats
  bestStreak: number
  level: number
  referralCount: number
}

export interface Achievement {
  /** Key dịch: `achievement.${id}`. */
  id: string
  /** Mốc cần đạt, để UI hiện tiến độ. */
  target: number
  coins: number
  value: (state: AchievementState) => number
}

const achievement = (id: string, target: number, coins: number, value: Achievement["value"]): Achievement => ({
  id,
  target,
  coins,
  value,
})

/** Thứ tự = thứ tự hiển thị. Thêm thành tích chỉ cần thêm dòng ở đây + key dịch. */
export const ACHIEVEMENTS: readonly Achievement[] = [
  achievement("first-game", 1, 20, (s) => s.stats.gamesPlayed),
  achievement("games-50", 50, 100, (s) => s.stats.gamesPlayed),
  achievement("games-200", 200, 300, (s) => s.stats.gamesPlayed),
  achievement("score-5000", 5000, 60, (s) => s.stats.bestScore),
  achievement("score-20000", 20000, 200, (s) => s.stats.bestScore),
  achievement("combo-15", 15, 60, (s) => s.stats.bestCombo),
  achievement("combo-30", 30, 200, (s) => s.stats.bestCombo),
  achievement("lines-1000", 1000, 150, (s) => s.stats.totalLinesCleared),
  achievement("clears-10", 10, 100, (s) => s.stats.boardClears),
  achievement("streak-7", 7, 100, (s) => s.bestStreak),
  achievement("streak-30", 30, 400, (s) => s.bestStreak),
  achievement("level-10", 10, 200, (s) => s.level),
  achievement("referral-1", 1, 50, (s) => s.referralCount),
]

export const ACHIEVEMENT_IDS: ReadonlySet<string> = new Set(ACHIEVEMENTS.map((item) => item.id))

export function isAchievementMet(item: Achievement, state: AchievementState): boolean {
  return item.value(state) >= item.target
}

/** Thành tích vừa đạt mà chưa nhận thưởng. */
export function newlyMetAchievements(owned: readonly string[], state: AchievementState): Achievement[] {
  return ACHIEVEMENTS.filter((item) => !owned.includes(item.id) && isAchievementMet(item, state))
}
