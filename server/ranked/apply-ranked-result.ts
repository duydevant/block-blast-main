import "server-only"

import { FieldValue, type Firestore, type Transaction } from "firebase-admin/firestore"

import type { RecordedGameAction } from "@/modules/block-puzzle/engine/replay-recorded-game-actions"
import { encodeActions } from "@/modules/block-puzzle/engine/recorded-action-codec"
import { relativeGhostTimes } from "@/modules/ranked/bot-ghost"
import { ratingForSeason } from "@/modules/ranked/rating-rules"
import { isQualifyingGame } from "@/modules/progression/player-level-curve"
import type { PlayerTier } from "@/modules/progression/player-form-rules"
import { type StoredPlayer, USERS_COLLECTION } from "@/server/profile/stored-player-document"

import { GHOST_POOL_COLLECTION, ghostDocFor } from "./ghost-pool-documents"
import type { RankedOutcome, RankedSessionInfo } from "./ranked-outcome"

export { forfeitedRating, rankedOutcome, type RankedOutcome, type RankedSessionInfo } from "./ranked-outcome"

/**
 * Ghi kết quả trận (sau khi đã đọc xong): rating của mình, nửa thay đổi MMR cho chủ bóng ma (người thật, không phải
 * mình), và đưa ván này vào hồ bóng ma (ván hợp lệ, đủ nước, không bị gắn cờ, nộp trong giờ).
 */
export function writeRankedResult(
  tx: Transaction,
  db: Firestore,
  input: {
    uid: string
    gameId: string
    outcome: RankedOutcome
    session: RankedSessionInfo & { seed: number }
    stored: StoredPlayer
    tier: PlayerTier
    actions: readonly RecordedGameAction[]
    times: readonly number[] | null
    score: number
    moveCount: number
    flagged: boolean
    nowMs: number
  }
) {
  const { outcome, session } = input
  if (!outcome.current) return
  const ghostDelta = Math.round((outcome.rating.mmr - ratingForSeason(input.stored.rating, outcome.rating.season).mmr) / 2)
  // Đối thủ bị gắn cờ / nộp trễ → thua do vi phạm, không phải do bóng ma giỏi: chủ bóng ma giữ nguyên MMR.
  if (session.ghostUid && session.ghostUid !== input.uid && ghostDelta !== 0 && !input.flagged && !outcome.late) {
    tx.set(db.collection(USERS_COLLECTION).doc(session.ghostUid), { rating: { mmr: FieldValue.increment(-ghostDelta) } }, { merge: true })
  }
  if (!input.flagged && !outcome.late && isQualifyingGame(input.moveCount)) {
    tx.set(
      db.collection(GHOST_POOL_COLLECTION).doc(input.gameId),
      ghostDocFor(
        {
          uid: input.uid,
          displayName: input.stored.displayName,
          tier: input.tier === "unranked" ? null : input.tier,
          mmr: outcome.rating.mmr,
          seed: session.seed,
          score: input.score,
          actions: encodeActions(input.actions),
          times: relativeGhostTimes(input.times, input.actions.length),
        },
        input.nowMs
      )
    )
  }
}
