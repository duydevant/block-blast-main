import "server-only"

import type { FieldValue, Firestore, Transaction } from "firebase-admin/firestore"

import type { RecordedGameAction, ReplaySummary } from "@/modules/block-puzzle/engine/replay-recorded-game-actions"
import type { RankedGameMode } from "@/modules/player-profile/player-profile-types"
import type { PlayerTier } from "@/modules/progression/player-form-rules"
import type { StoredPlayer } from "@/server/profile/stored-player-document"

import { GAME_REPLAYS_COLLECTION, replayDocFor, replayExpiry } from "./replay-documents"
import type { ReplayDecision } from "./should-store-replay"

/**
 * Ghi replay của ván vừa nộp (đã quyết định lưu). Kỷ lục cá nhân mới → giữ vĩnh viễn và replay kỷ lục cũ
 * chuyển sang tự xoá theo TTL (merge: doc đã bị xoá thì chỉ còn `expireAt`, TTL dọn luôn).
 * Trả field cần ghi vào doc người chơi.
 */
export function writeSubmittedGameReplay(
  tx: Transaction,
  db: Firestore,
  input: {
    gameId: string
    uid: string
    stored: StoredPlayer
    session: { mode: RankedGameMode; seed: number; stashUnlocked: boolean; levelId: number | null }
    actions: readonly RecordedGameAction[]
    summary: ReplaySummary
    tier: PlayerTier
    decision: ReplayDecision
    /** Replay kỷ lục cũ đang được top bảng mọi lúc link tới → giữ nguyên, không cho hết hạn. */
    previousBestPinnedByBoard: boolean
    stamp: FieldValue
    nowMs: number
  }
): { bestReplayId?: string } {
  const { stored, decision } = input
  const ref = db.collection(GAME_REPLAYS_COLLECTION).doc(input.gameId)
  tx.set(
    ref,
    replayDocFor({
      uid: input.uid,
      ...input.session,
      actions: input.actions,
      summary: input.summary,
      displayName: stored.displayName,
      tier: input.tier,
      playerTag: stored.referralCode,
      createdAt: input.stamp,
      expireAt: decision.permanent ? null : replayExpiry(input.nowMs),
      pinnedByBoard: decision.pinnedByBoard,
    })
  )
  if (!decision.personalBest) return {}
  if (stored.bestReplayId && stored.bestReplayId !== input.gameId && !input.previousBestPinnedByBoard) {
    tx.set(db.collection(GAME_REPLAYS_COLLECTION).doc(stored.bestReplayId), { expireAt: replayExpiry(input.nowMs) }, { merge: true })
  }
  return { bestReplayId: input.gameId }
}
