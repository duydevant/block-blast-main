import type { ReplaySummary } from "@/modules/block-puzzle/engine/replay-recorded-game-actions"
import type { DailyStreak, GameRewards, PlayerStats } from "@/modules/player-profile/player-profile-types"
import { newlyMetAchievements } from "@/modules/progression/achievement-catalog"
import { advanceDailyMissions, dailyMissionsForDay, type DailyMissionProgress } from "@/modules/progression/daily-mission-catalog"
import { COINS_PER_LEVEL_UP, isQualifyingGame, levelForXp, xpForVerifiedGame } from "@/modules/progression/player-level-curve"
import {
  MAX_REWARDED_REFERRALS,
  REFERRAL_COINS,
  REFERRAL_GAMES_REQUIRED,
} from "@/modules/progression/referral-rules"
import { REFERRAL_THEME } from "@/modules/progression/theme-unlock-rules"
import { COINS_PER_LEVEL_STAR } from "@/modules/game-modes/level-catalog"
import type { StoredPlayer } from "@/server/profile/stored-player-document"

export interface ProgressionInput {
  /** Doc người chơi trước ván này. */
  stored: StoredPlayer
  /** Thống kê/chuỗi ngày sau khi đã cộng ván này. */
  stats: PlayerStats
  streak: DailyStreak
  summary: ReplaySummary
  /** Ván là lượt tính điểm của thử thách ngày. */
  countedDaily: boolean
  /** Ngày (giờ VN) tính nhiệm vụ = ngày nộp ván. */
  missionDay: string
  missionProgress: DailyMissionProgress
  /** Doc người mời; chỉ cần khi `referralIsDue`. null = người mời không còn. */
  inviter: StoredPlayer | null
  /** Ván màn chơi: số sao vừa đạt (0 = chưa qua). */
  level?: { id: number; stars: number } | null
}

export interface InviterReward {
  /** Xu mời bạn + xu thành tích người mời vừa đạt (VD "referral-1"). */
  coins: number
  addTheme: string
  achievements: string[]
}

export interface ProgressionResult {
  /** Field ghi đè vào users/{uid}. */
  playerFields: Pick<StoredPlayer, "xp" | "coins" | "achievements" | "unlockedThemes" | "referralRewarded" | "referralGames" | "levelStars">
  missionProgress: DailyMissionProgress
  /** null = không phải ghi gì cho người mời. */
  inviterReward: InviterReward | null
  rewards: GameRewards
}

/** Số ván đủ nước tính cho mời bạn sau ván này (chỉ đếm khi đã được mời và chưa phát quà). */
function referralGamesAfter(stored: StoredPlayer, moveCount: number): number {
  const counting = stored.referredBy !== null && !stored.referralRewarded && isQualifyingGame(moveCount)
  return stored.referralGames + (counting ? 1 : 0)
}

/** Ván này làm người được mời đạt đủ số ván đủ nước → phát quà mời bạn. */
export function referralIsDue(stored: StoredPlayer, moveCount: number): boolean {
  return stored.referredBy !== null && !stored.referralRewarded && referralGamesAfter(stored, moveCount) >= REFERRAL_GAMES_REQUIRED
}

/** Phần người mời nhận: xu mời bạn (có giới hạn), theme, và thành tích mở nhờ số bạn mời tăng. */
function rewardForInviter(inviter: StoredPlayer): InviterReward {
  const achieved = newlyMetAchievements(inviter.achievements, {
    stats: inviter.stats,
    bestStreak: inviter.streak.best,
    level: levelForXp(inviter.xp),
    referralCount: inviter.referralCount + 1,
  })
  const referralCoins = inviter.referralCount < MAX_REWARDED_REFERRALS ? REFERRAL_COINS : 0
  return {
    coins: referralCoins + achieved.reduce((sum, item) => sum + item.coins, 0),
    addTheme: REFERRAL_THEME,
    achievements: achieved.map((item) => item.id),
  }
}

/**
 * Tính XP, xu, nhiệm vụ ngày, thành tích và quà mời bạn cho một ván đã replay (thuần, không I/O).
 * Thứ tự: XP ván + nhiệm vụ → cấp mới (xu lên cấp) → thành tích (xét cả cấp mới).
 */
export function applyProgressionForVerifiedGame(input: ProgressionInput): ProgressionResult {
  const { stored, stats, streak, summary } = input

  const missions = advanceDailyMissions(dailyMissionsForDay(input.missionDay), input.missionProgress, {
    moveCount: summary.moveCount,
    score: summary.score,
    linesCleared: summary.linesCleared,
    bestCombo: summary.bestCombo,
    boardClears: summary.boardClears,
    countedDaily: input.countedDaily,
  })
  const missionXp = missions.completed.reduce((sum, item) => sum + item.xp, 0)
  const missionCoins = missions.completed.reduce((sum, item) => sum + item.coins, 0)

  const xpGained = xpForVerifiedGame(summary.score, summary.moveCount) + missionXp
  const xp = stored.xp + xpGained
  const levelBefore = levelForXp(stored.xp)
  const level = levelForXp(xp)
  const levelCoins = (level - levelBefore) * COINS_PER_LEVEL_UP

  const achieved = newlyMetAchievements(stored.achievements, {
    stats,
    bestStreak: streak.best,
    level,
    referralCount: stored.referralCount,
  })
  const achievementCoins = achieved.reduce((sum, item) => sum + item.coins, 0)

  const referral = referralIsDue(stored, summary.moveCount)
  const referralCoins = referral ? REFERRAL_COINS : 0
  const unlockedThemes =
    referral && !stored.unlockedThemes.includes(REFERRAL_THEME) ? [...stored.unlockedThemes, REFERRAL_THEME] : stored.unlockedThemes
  const inviterReward = referral && input.inviter ? rewardForInviter(input.inviter) : null

  // Màn chơi: xu cho mỗi sao mới (lần đầu qua màn, rồi mỗi lần thêm sao), không thưởng lại sao đã có.
  const levelResult = input.level ?? null
  const previousStars = levelResult ? (stored.levelStars[String(levelResult.id)] ?? 0) : 0
  const levelImproved = levelResult !== null && levelResult.stars > previousStars
  const levelStars = levelImproved ? { ...stored.levelStars, [String(levelResult.id)]: levelResult.stars } : stored.levelStars
  const levelStarCoins = levelImproved ? (levelResult.stars - previousStars) * COINS_PER_LEVEL_STAR : 0

  const coinsGained = missionCoins + levelCoins + achievementCoins + referralCoins + levelStarCoins
  return {
    playerFields: {
      xp,
      coins: stored.coins + coinsGained,
      achievements: [...stored.achievements, ...achieved.map((item) => item.id)],
      unlockedThemes,
      referralRewarded: stored.referralRewarded || referral,
      referralGames: referralGamesAfter(stored, summary.moveCount),
      levelStars,
    },
    missionProgress: missions.progress,
    inviterReward,
    rewards: {
      xp: xpGained,
      coins: coinsGained,
      levelUp: level > levelBefore ? level : null,
      missions: missions.completed.map((item) => item.id),
      achievements: achieved.map((item) => item.id),
      referralBonus: referral,
      level: levelResult ? { ...levelResult, improved: levelImproved } : null,
    },
  }
}
