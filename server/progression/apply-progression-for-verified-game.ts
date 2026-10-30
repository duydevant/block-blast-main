import type { ReplaySummary } from "@/modules/block-puzzle/engine/replay-recorded-game-actions"
import type { DailyStreak, GameRewards, PlayerStats, RankedGameMode } from "@/modules/player-profile/player-profile-types"
import { type AchievementState, newlyMetAchievements, totalLevelStars } from "@/modules/progression/achievement-catalog"
import {
  advanceDailyMissions,
  dailyMissionsForDay,
  type DailyMissionProgress,
  type MissionBand,
} from "@/modules/progression/daily-mission-catalog"
import { highestTier, newlyReachedTiers, type PlayerTier, tierRewardCoins } from "@/modules/progression/player-form-rules"
import { COINS_PER_LEVEL_UP, isQualifyingGame, levelForXp, xpForVerifiedGame } from "@/modules/progression/player-level-curve"
import {
  MAX_REWARDED_REFERRALS,
  REFERRAL_COINS,
  REFERRAL_GAMES_REQUIRED,
} from "@/modules/progression/referral-rules"
import { REFERRAL_THEME } from "@/modules/progression/theme-unlock-rules"
import { COINS_PER_LEVEL_STAR } from "@/modules/game-modes/level-catalog"
import { isCountedPureGame } from "@/server/games/apply-verified-game-to-player-stats"
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
  mode: RankedGameMode
  /** Mức nhiệm vụ đã chốt của ngày + ô nhiệm vụ đã đổi (nếu có). */
  missionBand: MissionBand
  missionReplacedSlot: number | null
  /** Bậc theo phong độ sau ván này (để thưởng lần đầu đạt Bậc). */
  tierAfter: PlayerTier
  /** Số sao thử thách ngày sau lượt này (0 nếu không phải lượt tính điểm). */
  dailyStars: number
  /** Số ván ≥ 1.000 điểm hôm nay, đã gồm ván này. */
  todayGames1000: number
  /** Số ngày đạt ★★★ thử thách, đã gồm hôm nay nếu vừa đạt. */
  dailyThreeStarDays: number
  /** Ván nghi bot / tài khoản bị khoá: chỉ XP cơ bản — không nhiệm vụ, thành tích, Bậc, sao màn, quà mời bạn. */
  flagged?: boolean
}

export interface InviterReward {
  /** Xu mời bạn + xu thành tích người mời vừa đạt (VD "referral-1"). */
  coins: number
  addTheme: string
  achievements: string[]
}

export interface ProgressionResult {
  /** Field ghi đè vào users/{uid}. */
  playerFields: Pick<
    StoredPlayer,
    "xp" | "coins" | "achievements" | "unlockedThemes" | "referralRewarded" | "referralGames" | "levelStars" | "tierRewardsClaimed"
  >
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

/** Dữ liệu xét thành tích từ doc người chơi; `overrides` = số đã cập nhật bởi ván đang nộp. */
function achievementStateFor(player: StoredPlayer, overrides: Partial<AchievementState>): AchievementState {
  return {
    stats: player.stats,
    bestStreak: player.streak.best,
    level: levelForXp(player.xp),
    referralCount: player.referralCount,
    levelStarsTotal: totalLevelStars(player.levelStars),
    duelWins: player.duelStats.won,
    highestTier: highestTier(player.tierRewardsClaimed),
    todayGames1000: 0,
    dailyThreeStarDays: player.dailyThreeStarDays,
    ...overrides,
  }
}

/** Phần người mời nhận: xu mời bạn (có giới hạn), theme, và thành tích mở nhờ số bạn mời tăng. */
function rewardForInviter(inviter: StoredPlayer): InviterReward {
  const achieved = newlyMetAchievements(inviter.achievements, achievementStateFor(inviter, { referralCount: inviter.referralCount + 1 }))
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
  const flagged = input.flagged === true

  const missions = flagged ? { progress: input.missionProgress, completed: [] } : advanceDailyMissions(
    dailyMissionsForDay(input.missionDay, input.missionBand, input.missionReplacedSlot),
    input.missionProgress,
    {
      moveCount: summary.moveCount,
      score: summary.score,
      linesCleared: summary.linesCleared,
      bestCombo: summary.bestCombo,
      boardClears: summary.boardClears,
      countedDaily: input.countedDaily,
      pure: isCountedPureGame(summary),
      multiClears3: summary.runStats.multiClears[1],
      levelThreeStars: input.level?.stars === 3,
      isDuel: input.mode === "duel",
      dailyStars: input.dailyStars,
    }
  )
  const missionXp = missions.completed.reduce((sum, item) => sum + item.xp, 0)
  const missionCoins = missions.completed.reduce((sum, item) => sum + item.coins, 0)

  const xpGained = xpForVerifiedGame(summary.score, summary.moveCount) + missionXp
  const xp = stored.xp + xpGained
  const levelBefore = levelForXp(stored.xp)
  const level = levelForXp(xp)
  const levelCoins = (level - levelBefore) * COINS_PER_LEVEL_UP

  // Màn chơi: xu cho mỗi sao mới (lần đầu qua màn, rồi mỗi lần thêm sao), không thưởng lại sao đã có.
  const levelResult = flagged ? null : (input.level ?? null)
  const previousStars = levelResult ? (stored.levelStars[String(levelResult.id)] ?? 0) : 0
  const levelImproved = levelResult !== null && levelResult.stars > previousStars
  const levelStars = levelImproved ? { ...stored.levelStars, [String(levelResult.id)]: levelResult.stars } : stored.levelStars
  const levelStarCoins = levelImproved ? (levelResult.stars - previousStars) * COINS_PER_LEVEL_STAR : 0

  // Bậc: thưởng một lần cho mỗi Bậc lần đầu đạt (kể cả Bậc bị bỏ qua khi lên thẳng nhiều Bậc).
  const reachedTiers = flagged ? [] : newlyReachedTiers(input.tierAfter, stored.tierRewardsClaimed)
  const tierRewardsClaimed = [...stored.tierRewardsClaimed, ...reachedTiers]
  const tierCoins = tierRewardCoins(reachedTiers)

  const achievementState = achievementStateFor(stored, {
    stats,
    bestStreak: streak.best,
    level,
    levelStarsTotal: totalLevelStars(levelStars),
    highestTier: highestTier(tierRewardsClaimed),
    todayGames1000: input.todayGames1000,
    dailyThreeStarDays: input.dailyThreeStarDays,
  })
  const achieved = flagged ? [] : newlyMetAchievements(stored.achievements, achievementState)
  const achievementCoins = achieved.reduce((sum, item) => sum + item.coins, 0)

  const referral = !flagged && referralIsDue(stored, summary.moveCount)
  const referralCoins = referral ? REFERRAL_COINS : 0
  const unlockedThemes =
    referral && !stored.unlockedThemes.includes(REFERRAL_THEME) ? [...stored.unlockedThemes, REFERRAL_THEME] : stored.unlockedThemes
  const inviterReward = referral && input.inviter ? rewardForInviter(input.inviter) : null

  const coinsGained = missionCoins + levelCoins + achievementCoins + referralCoins + levelStarCoins + tierCoins
  return {
    playerFields: {
      xp,
      coins: stored.coins + coinsGained,
      achievements: [...stored.achievements, ...achieved.map((item) => item.id)],
      unlockedThemes,
      referralRewarded: stored.referralRewarded || referral,
      referralGames: flagged ? stored.referralGames : referralGamesAfter(stored, summary.moveCount),
      levelStars,
      tierRewardsClaimed,
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
      tierUp: reachedTiers.at(-1) ?? null,
    },
  }
}
