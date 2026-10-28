import "server-only"

import { randomInt } from "node:crypto"

import { FieldValue, Timestamp } from "firebase-admin/firestore"
import { z } from "zod"

import { DUEL_CODE_LENGTH, type CreateDuelResponse, type DuelStateResponse } from "@/modules/duel/duel-types"
import { REFERRAL_CODE_ALPHABET } from "@/modules/progression/referral-rules"
import { getAdminFirestore } from "@/server/firebase/firebase-admin-app"
import { HttpError } from "@/server/http/authenticated-json-route"
import { parseStoredPlayer, USERS_COLLECTION } from "@/server/profile/stored-player-document"

import {
  dropDuelRoundMoves,
  duelRef,
  mirrorDuelState,
  nextRoundPatch,
  parseDuel,
  resetDuelRoom,
  type StoredDuel,
  toDuelState,
  writeDuel,
} from "./duel-documents"
import { effectiveDuelStatus, isDuelRoomIdle, isDuelRoundOverdue, nextReadyList } from "./duel-round-rules"
import { settleDuelRound } from "./settle-duel-round"

/** Doc phòng tự xoá sau từng ấy kể từ lần hoạt động cuối (cần TTL policy cho `expireAt`, như gameSessions). */
const DUEL_TTL_MS = 7 * 24 * 60 * 60 * 1000

export const setDuelReadyRequestSchema = z.object({ ready: z.boolean() })

/** Số mã thử trong một lần tạo phòng (~887 triệu mã, trùng cả loạt gần như không xảy ra). */
const CODE_CANDIDATES = 4

/** Mã phòng 6 ký tự, cùng bảng chữ không dễ nhầm với mã mời (gõ tay được). */
function generateDuelCode(): string {
  return Array.from({ length: DUEL_CODE_LENGTH }, () => REFERRAL_CODE_ALPHABET[randomInt(REFERRAL_CODE_ALPHABET.length)]).join("")
}

const withServerNow = (state: ReturnType<typeof toDuelState>): DuelStateResponse => ({ ...state, serverNow: Date.now() })

/** Tạo phòng (chủ phòng = người gọi), chờ đối thủ vào. */
export async function createDuel(uid: string): Promise<CreateDuelResponse> {
  const db = getAdminFirestore()
  const now = Date.now()
  const candidates = Array.from({ length: CODE_CANDIDATES }, generateDuelCode)
  const host = parseStoredPlayer((await db.collection(USERS_COLLECTION).doc(uid).get()).data())
  const duel: StoredDuel = {
    hostUid: uid,
    hostName: host.displayName,
    guestUid: null,
    guestName: null,
    seed: 0,
    status: "waiting",
    createdAtMs: now,
    lastActiveAtMs: now,
    version: 1,
    round: 0,
    startAt: null,
    endsAt: null,
    sessions: {},
    results: {},
    winnerUid: null,
    endReason: null,
    series: {},
    ready: [],
    history: [],
  }

  const id = await db.runTransaction(async (tx) => {
    // Chọn mã ứng viên chưa có phòng (đọc hết trước khi ghi).
    const codeSnaps = await tx.getAll(...candidates.map((code) => duelRef(db, code)))
    const free = codeSnaps.find((snap) => !snap.exists)
    if (!free) throw new HttpError(503, "duel-code-busy")
    tx.create(free.ref, { ...duel, createdAt: FieldValue.serverTimestamp(), expireAt: Timestamp.fromMillis(now + DUEL_TTL_MS) })
    return free.id
  })
  await resetDuelRoom(id)
  await mirrorDuelState(toDuelState(id, duel, now))
  return { duelId: id }
}

/** Người thứ hai vào phòng → mở ván 1 (đếm ngược); chủ phòng / đã vào rồi gọi lại thì không đổi gì. */
export async function joinDuel(uid: string, id: string): Promise<DuelStateResponse> {
  const db = getAdminFirestore()
  const now = Date.now()
  const ref = duelRef(db, id)
  const state = await db.runTransaction(async (tx) => {
    const [duelSnap, userSnap] = await tx.getAll(ref, db.collection(USERS_COLLECTION).doc(uid))
    const duel = parseDuel(duelSnap.data())
    if (!duel) throw new HttpError(404, "duel-not-found")
    if (duel.hostUid === uid || duel.guestUid === uid) return toDuelState(id, duel, now)
    const status = effectiveDuelStatus(duel, now)
    if (status === "expired") throw new HttpError(410, "duel-expired")
    if (status !== "waiting") throw new HttpError(409, "duel-full")
    const guestName = parseStoredPlayer(userSnap.data()).displayName
    const joined = writeDuel(tx, ref, duel, { guestUid: uid, guestName, ...nextRoundPatch(duel, now) }, now)
    tx.update(ref, { expireAt: Timestamp.fromMillis(now + DUEL_TTL_MS) })
    return toDuelState(id, joined, now)
  })
  await mirrorDuelState(state)
  return withServerNow(state)
}

/** Xem phòng (công khai, mã không đoán được); ván quá hạn ghi nước mà chưa chốt thì chốt luôn. */
export async function getDuel(id: string): Promise<DuelStateResponse> {
  const db = getAdminFirestore()
  const now = Date.now()
  const duel = parseDuel((await duelRef(db, id).get()).data())
  if (!duel) throw new HttpError(404, "duel-not-found")
  if (isDuelRoundOverdue(duel, now)) return withServerNow(await settleDuelRound(id))
  return withServerNow(toDuelState(id, duel, now))
}

/**
 * Sẵn sàng / huỷ sẵn sàng đấu ván tiếp (chỉ người chơi, chỉ khi ván trước đã xong). Đủ hai người → mở ván mới
 * cùng phòng, cùng mã (seed mới); người xem ở lại xem tiếp.
 */
export async function setDuelReady(uid: string, id: string, ready: boolean): Promise<DuelStateResponse> {
  const db = getAdminFirestore()
  const now = Date.now()
  const ref = duelRef(db, id)
  const outcome = await db.runTransaction(async (tx) => {
    const duel = parseDuel((await tx.get(ref)).data())
    if (!duel) throw new HttpError(404, "duel-not-found")
    if (duel.hostUid !== uid && duel.guestUid !== uid) throw new HttpError(403, "not-a-player")
    if (duel.status !== "finished" || !duel.guestUid) throw new HttpError(409, "round-not-finished")
    if (isDuelRoomIdle(duel, now)) throw new HttpError(410, "duel-expired")
    const next = nextReadyList(duel.ready, uid, ready, [duel.hostUid, duel.guestUid])
    const patch = next.start ? nextRoundPatch(duel, now) : { ready: next.ready }
    const updated = writeDuel(tx, ref, duel, patch, now)
    if (next.start) tx.update(ref, { expireAt: Timestamp.fromMillis(now + DUEL_TTL_MS) })
    return { state: toDuelState(id, updated, now), previousRound: next.start ? duel.round : 0 }
  })
  await mirrorDuelState(outcome.state)
  await dropDuelRoundMoves(id, outcome.previousRound)
  return withServerNow(outcome.state)
}
