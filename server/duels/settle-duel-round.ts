import "server-only"

import { DUEL_EARLY_START_TOLERANCE_MS, DUEL_MOVE_GRACE_MS, DUEL_RTDB_PATH, type DuelState, duelRoundKey } from "@/modules/duel/duel-types"
import { replayDuelMoves } from "@/modules/duel/duel-move-replay"
import { getAdminDatabase, getAdminFirestore } from "@/server/firebase/firebase-admin-app"
import { HttpError } from "@/server/http/authenticated-json-route"

import { duelRef, finishRoundInTransaction, mirrorDuelState, parseDuel, type StoredDuel, toDuelState } from "./duel-documents"
import { decideDuelRound, type DuelPlayerProgress } from "./duel-round-rules"

/** Điểm thật của hai người: replay nước đi trên RTDB (chỉ nước ghi trước hạn chót + ân hạn, theo giờ server). */
async function loadRoundProgress(id: string, duel: StoredDuel): Promise<Record<string, DuelPlayerProgress>> {
  const snapshot = await getAdminDatabase().ref(`${DUEL_RTDB_PATH}/${id}/moves/${duelRoundKey(duel.round)}`).get()
  const moves = (snapshot.val() ?? {}) as Record<string, Record<string, unknown> | undefined>
  const deadline = (duel.endsAt ?? 0) + DUEL_MOVE_GRACE_MS
  const progress: Record<string, DuelPlayerProgress> = {}
  for (const uid of [duel.hostUid, duel.guestUid]) {
    if (!uid) continue
    const { state } = replayDuelMoves(duel.seed, moves[uid], deadline, duel.rulesVersion)
    progress[uid] = { score: state.score, over: state.isGameOver }
  }
  return progress
}

/**
 * Chấm ván đang chơi (gọi nhiều lần không sao): replay nước đi của hai người → `decideDuelRound`. Đã rõ thắng thua
 * (cả hai hết nước / người còn sống đã vượt điểm / hết giờ) thì chốt trong transaction và mirror; chưa thì trả trạng thái.
 * `callerUid` (route /settle) phải là người chơi; GET công khai gọi không kèm uid, chỉ khi ván đã quá hạn.
 */
export async function settleDuelRound(id: string, callerUid?: string): Promise<DuelState> {
  const db = getAdminFirestore()
  const ref = duelRef(db, id)
  const now = Date.now()
  const duel = parseDuel((await ref.get()).data())
  if (!duel) throw new HttpError(404, "duel-not-found")
  if (callerUid !== undefined && callerUid !== duel.hostUid && callerUid !== duel.guestUid) throw new HttpError(403, "not-a-player")
  const playing = duel.status === "playing" && duel.guestUid !== null && duel.startAt !== null && duel.endsAt !== null
  if (!playing || now < (duel.startAt ?? 0) - DUEL_EARLY_START_TOLERANCE_MS) return toDuelState(id, duel, now)

  const decision = decideDuelRound({
    hostUid: duel.hostUid,
    guestUid: duel.guestUid ?? "",
    endsAt: duel.endsAt ?? 0,
    now,
    progress: await loadRoundProgress(id, duel),
  })
  if (!decision.finished) return toDuelState(id, duel, now)

  const state = await db.runTransaction(async (tx) => {
    const current = parseDuel((await tx.get(ref)).data())
    if (!current) throw new HttpError(404, "duel-not-found")
    // Request khác đã chốt / đã sang ván mới trong lúc replay → giữ nguyên.
    if (current.status !== "playing" || current.round !== duel.round) return toDuelState(id, current, now)
    return toDuelState(id, finishRoundInTransaction(tx, db, id, current, decision, now), now)
  })
  await mirrorDuelState(state)
  return state
}
