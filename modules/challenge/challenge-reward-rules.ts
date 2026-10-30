/**
 * Thách đấu có thưởng 2 chiều (giống friend quest của Minesweeper): người nhận vượt điểm người thách trong hạn
 * → cả hai cùng nhận xu. Chống tài khoản phụ: người nhận phải là người chơi thật (đủ ván, tài khoản đủ tuổi),
 * mỗi người nhận chỉ được thưởng 1 lần / thách đấu, mỗi người tối đa CREATOR_DAILY_LIMIT lần thưởng / ngày (tính cả
 * vai người thách lẫn người nhận, chung một bộ đếm).
 */
export const CHALLENGE_REWARD_COINS = 50
export const CHALLENGE_REWARD_WINDOW_MS = 3 * 24 * 60 * 60 * 1000
export const CHALLENGE_CREATOR_DAILY_LIMIT = 5
export const CHALLENGE_RECIPIENT_MIN_GAMES = 5
export const CHALLENGE_RECIPIENT_MIN_AGE_MS = 24 * 60 * 60 * 1000
/** Ván quá ngắn không tính (đồng bộ với MIN_MOVES_FOR_REWARDS). */
export const CHALLENGE_MIN_MOVES = 10

export interface ChallengeRewardInput {
  recipientUid: string
  creatorUid: string
  /** Hạn thưởng (ms); null = thách đấu cũ không có thưởng. */
  expiresAtMs: number | null
  alreadyRewarded: boolean
  score: number
  creatorScore: number
  moveCount: number
  flagged: boolean
  /** Số ván người nhận đã chơi TRƯỚC ván này. */
  recipientGamesBefore: number
  /** Lúc tạo tài khoản người nhận (ms); null = chưa rõ (chưa từng nộp ván). */
  recipientCreatedAtMs: number | null
  nowMs: number
}

export function isChallengeRewardDue(input: ChallengeRewardInput): boolean {
  if (input.expiresAtMs === null || input.nowMs >= input.expiresAtMs) return false
  if (input.recipientUid === input.creatorUid || input.alreadyRewarded || input.flagged) return false
  if (input.moveCount < CHALLENGE_MIN_MOVES || input.score <= input.creatorScore) return false
  if (input.recipientGamesBefore < CHALLENGE_RECIPIENT_MIN_GAMES) return false
  return input.recipientCreatedAtMs !== null && input.nowMs - input.recipientCreatedAtMs >= CHALLENGE_RECIPIENT_MIN_AGE_MS
}

/** Người thách còn được nhận thưởng hôm nay không (đếm theo ngày VN lưu trong doc người thách). */
export function creatorRewardCount(stored: { challengeRewardDay: string | null; challengeRewardCount: number }, today: string): number {
  return stored.challengeRewardDay === today ? stored.challengeRewardCount : 0
}

/** Kết quả thưởng thách đấu trả kèm phần thưởng ván. */
export interface ChallengeRewardResult {
  coins: number
  /** Người thách cũng nhận xu (chưa vượt giới hạn ngày). */
  creatorRewarded: boolean
}
