import "server-only"

import type { Firestore, Transaction } from "firebase-admin/firestore"

import type { DuelState } from "@/modules/duel/duel-types"

import { duelRef, finishDuelInTransaction, toDuelState, type StoredDuel } from "./duel-documents"
import { acceptsDuelSubmission, bothResultsIn } from "./duel-rules"

/**
 * Ghi điểm đã replay của một người vào trận (gọi trong transaction nộp ván, sau phần đọc).
 * Nộp trễ quá hạn/đã có điểm → bỏ qua (ván vẫn cộng thống kê). Đủ hai điểm → chốt trận ngay.
 * Trả trạng thái mới để mirror lên RTDB sau khi transaction xong, hoặc null nếu không đổi gì.
 */
export function recordDuelResultInTransaction(
  tx: Transaction,
  db: Firestore,
  duelId: string,
  duel: StoredDuel,
  uid: string,
  score: number,
  now: number
): DuelState | null {
  if (!acceptsDuelSubmission(duel, now) || duel.results[uid] !== undefined) return null
  const updated: StoredDuel = { ...duel, results: { ...duel.results, [uid]: score } }
  tx.update(duelRef(db, duelId), { [`results.${uid}`]: score })
  if (!bothResultsIn(updated)) return toDuelState(duelId, updated, now)
  return toDuelState(duelId, { ...updated, ...finishDuelInTransaction(tx, db, duelId, updated) }, now)
}
