/** Đường cấp độ dùng chung client (hiển thị) và server (cộng thưởng). Thuần, không I/O. */

/** Xu thưởng mỗi lần lên một cấp. */
export const COINS_PER_LEVEL_UP = 50

/** Tổng XP cần để đạt cấp `level` (cấp 1 = 0 XP, cấp 2 = 100, cấp 3 = 300, cấp 4 = 600…). */
export function totalXpForLevel(level: number): number {
  return 50 * (level - 1) * level
}

export function levelForXp(xp: number): number {
  // Nghiệm của 50·L·(L−1) ≤ xp, chỉnh lại 1 bước cho sai số dấu phẩy động.
  let level = Math.max(1, Math.floor((1 + Math.sqrt(1 + (4 * Math.max(0, xp)) / 50)) / 2))
  while (totalXpForLevel(level + 1) <= xp) level++
  while (level > 1 && totalXpForLevel(level) > xp) level--
  return level
}

export interface LevelProgress {
  level: number
  /** XP đã có trong cấp hiện tại. */
  xpIntoLevel: number
  /** XP cần để lên cấp tiếp theo (tính từ đầu cấp hiện tại). */
  xpForNextLevel: number
}

export function levelProgressForXp(xp: number): LevelProgress {
  const level = levelForXp(xp)
  const start = totalXpForLevel(level)
  return { level, xpIntoLevel: xp - start, xpForNextLevel: totalXpForLevel(level + 1) - start }
}

/** Ván ít hơn số nước này không được XP cơ bản, không tính nhiệm vụ "chơi N ván" và mời bạn (chặn farm bằng ván 1 nước). */
export const MIN_MOVES_FOR_REWARDS = 10

export function isQualifyingGame(moveCount: number): boolean {
  return moveCount >= MIN_MOVES_FOR_REWARDS
}

/** XP của một ván đã replay: 10 cho mỗi ván đủ nước + 1 mỗi 100 điểm; tối đa 100/ván. */
export function xpForVerifiedGame(score: number, moveCount: number): number {
  return (isQualifyingGame(moveCount) ? 10 : 0) + Math.min(90, Math.floor(score / 100))
}
