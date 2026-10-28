import "server-only"

import { FieldValue, type Firestore, type Transaction } from "firebase-admin/firestore"
import { z } from "zod"

import { DUEL_RTDB_PATH, type DuelState, duelStateRank } from "@/modules/duel/duel-types"
import { getAdminDatabase } from "@/server/firebase/firebase-admin-app"
import { USERS_COLLECTION } from "@/server/profile/stored-player-document"

import { duelWinner, effectiveDuelStatus, type DuelRuleState } from "./duel-rules"

/** duels/{id}: phòng đấu 1v1 (chỉ Admin SDK đọc/ghi; client nghe bản mirror trên RTDB). */
export const DUELS_COLLECTION = "duels"

const name = z.string().nullable().catch(null)

export const storedDuelSchema = z.object({
  hostUid: z.string(),
  hostName: name,
  guestUid: z.string().nullable().catch(null),
  guestName: name,
  seed: z.number().int().nonnegative(),
  status: z.enum(["waiting", "playing", "finished", "expired"]),
  createdAtMs: z.number(),
  startAt: z.number().nullable().catch(null),
  endsAt: z.number().nullable().catch(null),
  /** uid → gameId của ván đấu (mỗi người một ván). */
  sessions: z.record(z.string(), z.string()).catch({}),
  results: z.record(z.string(), z.number().int().nonnegative()).catch({}),
  winnerUid: z.string().nullable().catch(null),
  rematchId: z.string().nullable().catch(null),
})

export type StoredDuel = z.infer<typeof storedDuelSchema> & DuelRuleState

export function duelRef(db: Firestore, id: string) {
  return db.collection(DUELS_COLLECTION).doc(id)
}

export function toDuelState(id: string, duel: StoredDuel, now: number): DuelState {
  return {
    id,
    status: effectiveDuelStatus(duel, now),
    host: { uid: duel.hostUid, name: duel.hostName },
    guest: duel.guestUid ? { uid: duel.guestUid, name: duel.guestName } : null,
    startAt: duel.startAt,
    endsAt: duel.endsAt,
    results: duel.results,
    winnerUid: duel.winnerUid,
    rematchId: duel.rematchId,
    started: Object.keys(duel.sessions),
  }
}

/** Xoá phòng cũ trên RTDB (trạng thái + điểm trực tiếp) — mã 6 ký tự có thể được dùng lại sau khi doc Firestore hết hạn. */
export async function resetDuelRoom(id: string): Promise<void> {
  try {
    await getAdminDatabase().ref(`${DUEL_RTDB_PATH}/${id}`).remove()
  } catch (error) {
    console.warn("[duel] reset RTDB room failed", error)
  }
}

/**
 * Ghi trạng thái phòng lên RTDB để hai bên thấy ngay (best-effort: lỗi chỉ log, Firestore vẫn là nguồn thật).
 * Dùng transaction RTDB và chỉ ghi khi bản mới không "lùi" so với bản đang có (các request chạy song song
 * có thể mirror sai thứ tự, VD "playing" cũ ghi đè "finished").
 */
export async function mirrorDuelState(state: DuelState): Promise<void> {
  try {
    await getAdminDatabase()
      .ref(`${DUEL_RTDB_PATH}/${state.id}/state`)
      .transaction((current: DuelState | null) => (current && duelStateRank(current) > duelStateRank(state) ? undefined : state))
  } catch (error) {
    console.warn("[duel] mirror to RTDB failed", error)
  }
}

/**
 * Chốt trận trong transaction (đã đọc doc trận trước đó): ghi người thắng + cộng thống kê đấu cho hai người.
 * Trả về các field đã đổi để caller gộp vào state trả về.
 */
export function finishDuelInTransaction(tx: Transaction, db: Firestore, id: string, duel: StoredDuel): Pick<StoredDuel, "status" | "winnerUid"> {
  const winnerUid = duelWinner(duel)
  tx.update(duelRef(db, id), { status: "finished", winnerUid, finishedAt: FieldValue.serverTimestamp() })
  for (const uid of [duel.hostUid, duel.guestUid]) {
    if (!uid) continue
    // set + merge với object lồng (không dùng key "duelStats.played": set coi dấu chấm là tên field).
    const duelStats = { played: FieldValue.increment(1), ...(uid === winnerUid ? { won: FieldValue.increment(1) } : {}) }
    tx.set(db.collection(USERS_COLLECTION).doc(uid), { duelStats }, { merge: true })
  }
  return { status: "finished", winnerUid }
}
