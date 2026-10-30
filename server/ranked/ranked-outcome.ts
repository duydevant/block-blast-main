import type { RulesVersion } from "@/modules/block-puzzle/engine/game-types"
import type { RankedMatchReward } from "@/modules/ranked/ranked-types"
import { applyMatch, leagueForLp, matchResult, PLACEMENT_GAMES, RANKED_TIME_MS, type RankedRating, ratingForSeason } from "@/modules/ranked/rating-rules"
import type { StoredPlayer } from "@/server/profile/stored-player-document"

/** Nộp quá 3 phút + chừng này → tính thua (không thể chơi tiếp sau giờ rồi mới nộp). Đủ cho mạng chậm / hàng chờ. */
const RANKED_SUBMIT_GRACE_MS = 30_000
/** Nhịp client (nước đầu → nước cuối) dài quá 3 phút + chừng này → đã chơi quá giờ. */
const RANKED_PLAY_SPAN_SLACK_MS = 3_000

export interface RankedSessionInfo {
  /** Phiên bản luật của trận (thiếu = 1) — ván vào hồ bóng ma mang theo để chỉ ghép trận cùng luật. */
  rulesVersion?: RulesVersion
  ghostScore: number
  ghostMmr: number
  ghostUid: string | null
  ghostIsBot: boolean
}

export interface RankedOutcome {
  rating: RankedRating
  reward: RankedMatchReward
  /** Trận này còn là trận đang mở (chưa bị tính thua khi mở trận mới) → ghi rating. */
  current: boolean
  /** Nộp quá giờ (có thể đã chơi quá 3 phút) → không làm bóng ma. */
  late: boolean
}

/** Trận đang mở bị bỏ (log hỏng / 0 nước) → tính thua như nộp trễ; không phải trận đang mở → null. */
export function forfeitedRating(input: { gameId: string; session: RankedSessionInfo; stored: StoredPlayer; season: string }): RankedRating | null {
  if (input.stored.rankedOpenGameId !== input.gameId) return null
  const before = ratingForSeason(input.stored.rating, input.season)
  return applyMatch(before, { mmr: input.session.ghostMmr, uid: input.session.ghostUid, isBot: input.session.ghostIsBot }, "loss").rating
}

/** Chấm trận (thuần): so điểm với bóng ma; nộp trễ / ván bị gắn cờ → thua. */
export function rankedOutcome(input: {
  gameId: string
  session: RankedSessionInfo
  stored: StoredPlayer
  score: number
  durationMs: number
  /** Nước đầu → nước cuối theo đồng hồ client; null = không gửi nhịp. */
  playSpanMs: number | null
  flagged: boolean
  season: string
}): RankedOutcome {
  const before = ratingForSeason(input.stored.rating, input.season)
  const current = input.stored.rankedOpenGameId === input.gameId
  const late =
    input.durationMs > RANKED_TIME_MS + RANKED_SUBMIT_GRACE_MS || (input.playSpanMs !== null && input.playSpanMs > RANKED_TIME_MS + RANKED_PLAY_SPAN_SLACK_MS)
  const result = late || input.flagged ? "loss" : matchResult(input.score, input.session.ghostScore)
  const rating = current
    ? applyMatch(before, { mmr: input.session.ghostMmr, uid: input.session.ghostUid, isBot: input.session.ghostIsBot }, result).rating
    : before
  return {
    rating,
    current,
    late,
    reward: {
      result,
      ghostScore: input.session.ghostScore,
      lpBefore: before.lp,
      lpAfter: rating.lp,
      league: leagueForLp(rating.lp),
      placementsLeft: Math.max(0, PLACEMENT_GAMES - rating.placements),
      isBot: input.session.ghostIsBot,
    },
  }
}

