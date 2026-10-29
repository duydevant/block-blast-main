import { z } from "zod"

import {
  EMPTY_DAILY_STREAK,
  EMPTY_PLAYER_STATS,
  type PlayerProfile,
} from "@/modules/player-profile/player-profile-types"
import { FORM_WINDOW, formFromRecent, highestTier, tierForForm } from "@/modules/progression/player-form-rules"
import { effectiveDailyStreak } from "@/server/daily/advance-daily-streak"

/** Tên collection Firestore — dùng chung cho mọi chỗ đọc/ghi. */
export const USERS_COLLECTION = "users"
export const GAME_SESSIONS_COLLECTION = "gameSessions"
/** users/{uid}/daily/{YYYYMMDD}: các lượt tính điểm, mốc, điểm cao nhất + sao của thử thách ngày đó. */
export const DAILY_RESULTS_SUBCOLLECTION = "daily"
/** leaderboards/{boardId} (snapshot top) và leaderboards/{boardId}/entries/{uid}. */
export const LEADERBOARDS_COLLECTION = "leaderboards"
export const LEADERBOARD_ENTRIES_SUBCOLLECTION = "entries"
/** users/{uid}/missions/{YYYYMMDD}: tiến độ nhiệm vụ ngày. */
export const MISSIONS_SUBCOLLECTION = "missions"
/** referralCodes/{code} → { uid }: tra mã mời ra người mời. */
export const REFERRAL_CODES_COLLECTION = "referralCodes"
/** users/{uid}/games/{gameId}: lịch sử ván đã nộp (TTL `expireAt`). */
export const GAMES_HISTORY_SUBCOLLECTION = "games"
/** users/{uid}/years/{YYYY}: bộ đếm cả năm (tổng kết năm). */
export const YEARS_SUBCOLLECTION = "years"

const count = z.number().int().nonnegative().catch(0)
const idList = z.array(z.string()).catch([])
const RANKED_MODES = ["classic", "daily", "challenge", "level", "duel"] as const
const modeStatsSchema = z.object({ games: count, best: count, total: count })

const storedPlayerSchema = z.object({
  displayName: z.string().nullable().catch(null),
  stashUnlocked: z.boolean().catch(false),
  stats: z
    .object({
      gamesPlayed: count,
      bestScore: count,
      totalScore: count,
      totalLinesCleared: count,
      bestCombo: count,
      boardClears: count,
      totalMoves: count,
      pureGames: count,
      bestPureScore: count,
      multiClears3: count,
      maxLinesInMove: count,
    })
    .catch(EMPTY_PLAYER_STATS),
  streak: z
    .object({ current: count, best: count, lastDailyDay: z.string().regex(/^\d{8}$/).nullable().catch(null) })
    .catch(EMPTY_DAILY_STREAK),
  xp: count,
  coins: count,
  unlockedThemes: idList,
  achievements: idList,
  referralCode: z.string().nullable().catch(null),
  /** uid người mời (chỉ server đọc, không trả ra client). */
  referredBy: z.string().nullable().catch(null),
  /** Đã phát quà mời bạn cho cặp này (khi người được mời chơi đủ ván). */
  referralRewarded: z.boolean().catch(false),
  /** Số ván đủ nước đã chơi kể từ khi được mời (đủ REFERRAL_GAMES_REQUIRED thì phát quà). */
  referralGames: count,
  referralCount: count,
  /** Màn chơi → số sao cao nhất (chỉ giữ giá trị 1–3 hợp lệ). */
  levelStars: z.record(z.string().regex(/^\d{1,3}$/), z.number().int().min(1).max(3)).catch({}),
  duelStats: z.object({ played: count, won: count }).catch({ played: 0, won: 0 }),
  /** Điểm thử thách ngày cao nhất mọi thời điểm (mốc "Kỷ lục" của thử thách). */
  dailyBest: count,
  /** Điểm cao nhất các ngày thử thách gần đây (tính phong độ). Thiếu = người chơi cũ chưa chuyển, đọc lịch sử một lần. */
  dailyRecent: z.record(z.string().regex(/^\d{8}$/), z.number().int().nonnegative()).optional().catch(undefined),
  /** Điểm các ván tính phong độ gần nhất (mới nhất ở cuối, tối đa FORM_WINDOW). */
  recentFormScores: z
    .array(z.number().int().nonnegative())
    .catch([])
    .transform((list) => list.slice(-FORM_WINDOW)),
  /** Bậc đã nhận thưởng lần đầu (cũng là các Bậc từng đạt). */
  tierRewardsClaimed: idList,
  statsByMode: z.partialRecord(z.enum(RANKED_MODES), modeStatsSchema).catch({}),
  /** Số ngày thử thách đạt ★★★. */
  dailyThreeStarDays: count,
})

/** Field người dùng được ghi trong users/{uid}; doc thiếu/hỏng field nào thì field đó về mặc định. */
export type StoredPlayer = z.infer<typeof storedPlayerSchema>

const EMPTY_STORED_PLAYER: StoredPlayer = {
  displayName: null,
  stashUnlocked: false,
  stats: EMPTY_PLAYER_STATS,
  streak: EMPTY_DAILY_STREAK,
  xp: 0,
  coins: 0,
  unlockedThemes: [],
  achievements: [],
  referralCode: null,
  referredBy: null,
  referralRewarded: false,
  referralGames: 0,
  referralCount: 0,
  levelStars: {},
  duelStats: { played: 0, won: 0 },
  dailyBest: 0,
  recentFormScores: [],
  tierRewardsClaimed: [],
  statsByMode: {},
  dailyThreeStarDays: 0,
}

export function parseStoredPlayer(data: unknown): StoredPlayer {
  const parsed = storedPlayerSchema.safeParse(data ?? {})
  return parsed.success ? parsed.data : EMPTY_STORED_PLAYER
}

/** `today` để tính chuỗi còn sống hay đã đứt khi hiển thị. */
export function toPlayerProfile(uid: string, stored: StoredPlayer, today: string): PlayerProfile {
  return {
    uid,
    displayName: stored.displayName,
    stashUnlocked: stored.stashUnlocked,
    stats: stored.stats,
    streak: effectiveDailyStreak(stored.streak, today),
    xp: stored.xp,
    coins: stored.coins,
    unlockedThemes: stored.unlockedThemes,
    achievements: stored.achievements,
    referralCount: stored.referralCount,
    referred: stored.referredBy !== null,
    levelStars: stored.levelStars,
    duelStats: stored.duelStats,
    ...playerFormView(stored),
    statsByMode: stored.statsByMode,
    dailyThreeStarDays: stored.dailyThreeStarDays,
  }
}

/** Phong độ, Bậc hiện tại và Bậc cao nhất từng đạt (hiển thị). */
export function playerFormView(stored: Pick<StoredPlayer, "recentFormScores" | "tierRewardsClaimed">) {
  const form = formFromRecent(stored.recentFormScores)
  return {
    form,
    formGames: stored.recentFormScores.length,
    tier: tierForForm(form),
    highestTier: highestTier(stored.tierRewardsClaimed),
  }
}

/**
 * Ô cất đầu ván: lấy theo server. Riêng người chưa có ván nào trên cloud thì tin trạng thái local
 * một lần, để người chơi cũ không bị khoá lại ô cất khi chuyển sang tài khoản cloud.
 */
export function resolveStashUnlockedForNewGame(stored: StoredPlayer, clientClaim: boolean): boolean {
  return stored.stashUnlocked || (stored.stats.gamesPlayed === 0 && clientClaim)
}
