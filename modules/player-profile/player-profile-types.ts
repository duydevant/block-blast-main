/** Kiểu dữ liệu profile dùng chung giữa API route (server) và UI (client). */

import type { ChallengeOpponent } from "@/modules/challenge/challenge-types"
import type { DuelStartInfo } from "@/modules/duel/duel-types"
import type { DailyRewardStatus } from "@/modules/progression/daily-reward-track"
import type { DailyMissionStatus } from "@/modules/progression/daily-mission-catalog"

export interface PlayerStats {
  gamesPlayed: number
  bestScore: number
  totalScore: number
  totalLinesCleared: number
  bestCombo: number
  boardClears: number
  totalMoves: number
}

/** Chuỗi ngày liên tiếp hoàn thành thử thách hằng ngày. */
export interface DailyStreak {
  current: number
  best: number
  /** Khoá ngày "YYYYMMDD" lần gần nhất có lượt tính điểm. */
  lastDailyDay: string | null
}

export interface PlayerProfile {
  uid: string
  /** null = chưa đặt tên, UI hiện tên khách mặc định. */
  displayName: string | null
  stashUnlocked: boolean
  stats: PlayerStats
  /** Đã tính "còn sống" theo hôm nay (đứt chuỗi → current = 0). */
  streak: DailyStreak
  /** Tổng XP; cấp tính bằng levelForXp (modules/progression/player-level-curve). */
  xp: number
  coins: number
  /** Theme đã mua/được tặng (theme theo cấp và theme miễn phí không nằm ở đây). */
  unlockedThemes: string[]
  /** Id thành tích đã đạt. */
  achievements: string[]
  /** Số bạn được mời đã chơi đủ ván để nhận thưởng. */
  referralCount: number
  /** Đã nhập mã mời của người khác. */
  referred: boolean
  /** Số sao cao nhất từng màn ("1" → 3). */
  levelStars: Record<string, number>
  duelStats: DuelStats
}

export interface DuelStats {
  played: number
  won: number
}

/** Sự kiện tuần hiện hành: tuần ISO + luật (xem modules/game-modes/weekly-event-catalog). */
export interface WeeklyEventInfo {
  week: string
  ruleId: string
}

export const EMPTY_DAILY_STREAK: DailyStreak = { current: 0, best: 0, lastDailyDay: null }

/**
 * classic: seed ngẫu nhiên; daily: seed chung của ngày; challenge: seed của ván người thách đấu;
 * event: luật sự kiện tuần; level: màn chơi (seed + bàn cố định); duel: đấu 1v1 cùng seed.
 */
export type RankedGameMode = "classic" | "daily" | "challenge" | "event" | "level" | "duel"

export const EMPTY_PLAYER_STATS: PlayerStats = {
  gamesPlayed: 0,
  bestScore: 0,
  totalScore: 0,
  totalLinesCleared: 0,
  bestCombo: 0,
  boardClears: 0,
  totalMoves: 0,
}

export const DISPLAY_NAME_MIN_LENGTH = 2
export const DISPLAY_NAME_MAX_LENGTH = 16

/** Ký tự điều khiển, zero-width và ký tự đổi chiều chữ (bidi) — không cho vào tên hiển thị. */
function isControlOrInvisible(char: string): boolean {
  const code = char.codePointAt(0) ?? 0
  return code < 0x20 || (code >= 0x7f && code <= 0x9f) || (code >= 0x200b && code <= 0x200f) || (code >= 0x2028 && code <= 0x202e)
}

/** Bỏ ký tự điều khiển, gộp khoảng trắng. Trả null nếu độ dài không hợp lệ. */
export function normalizeDisplayName(raw: string): string | null {
  const cleaned = [...raw].filter((char) => !isControlOrInvisible(char)).join("").replace(/\s+/g, " ").trim()
  const length = [...cleaned].length
  return length >= DISPLAY_NAME_MIN_LENGTH && length <= DISPLAY_NAME_MAX_LENGTH ? cleaned : null
}

/** Mã ngắn từ uid để phân biệt các khách chưa đặt tên (VD "Khách #A1B2"). */
export function guestTagFromUid(uid: string): string {
  return uid.slice(-4).toUpperCase()
}

/** POST /api/games/start */
export interface StartRankedGameResponse {
  /** null = lượt luyện tập daily (đã chơi lượt tính điểm hôm nay) → không nộp. */
  gameId: string | null
  seed: number
  stashUnlocked: boolean
  mode: RankedGameMode
  /** Chỉ có ở daily: khoá ngày "YYYYMMDD". */
  day: string | null
  /** Chỉ có ở challenge: người thách + điểm cần vượt. */
  challenge: ChallengeOpponent | null
  /** Chỉ có ở event. */
  event?: WeeklyEventInfo | null
  /** Chỉ có ở level. */
  levelId?: number | null
  /** Chỉ có ở duel. */
  duel?: DuelStartInfo | null
}

/** Phần thưởng một ván đã replay mang lại (để client báo cho người chơi). */
export interface GameRewards {
  xp: number
  coins: number
  /** Cấp mới nếu ván này làm lên cấp, không thì null. */
  levelUp: number | null
  /** Id nhiệm vụ ngày vừa hoàn thành. */
  missions: string[]
  /** Id thành tích vừa đạt. */
  achievements: string[]
  /** Ván này đủ điều kiện mời bạn → đã nhận quà mời bạn. */
  referralBonus: boolean
  /** Ván màn chơi: số sao đạt được (0 = chưa qua) và có phá kỷ lục sao của màn không. */
  level?: { id: number; stars: number; improved: boolean } | null
}

export const NO_GAME_REWARDS: GameRewards = { xp: 0, coins: 0, levelUp: null, missions: [], achievements: [], referralBonus: false, level: null }

/** POST /api/games/submit */
export interface SubmitRankedGameResponse {
  score: number
  stats: PlayerStats
  /** Các bảng mà điểm này là kỷ lục mới của người chơi. */
  improvedBoards: string[]
  rewards: GameRewards
}

/** GET /api/daily */
export interface DailyStatusResponse {
  day: string
  /** Điểm lượt tính điểm hôm nay; null = chưa chơi xong. */
  todayScore: number | null
  /** Đã bắt đầu lượt tính điểm hôm nay nhưng chưa nộp (lượt mới sẽ là luyện tập). */
  runInProgress: boolean
  streak: DailyStreak
  /** 3 nhiệm vụ hôm nay kèm tiến độ. */
  missions: DailyMissionStatus[]
  event: WeeklyEventInfo
  /** Thưởng hoàn thành thử thách hôm nay (vòng 7 ngày theo chuỗi). */
  reward: DailyRewardStatus
}
