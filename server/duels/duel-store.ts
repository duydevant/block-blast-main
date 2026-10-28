import "server-only"

import { randomInt } from "node:crypto"

import { FieldValue, Timestamp } from "firebase-admin/firestore"
import { z } from "zod"

import {
  DUEL_CODE_LENGTH,
  DUEL_COUNTDOWN_MS,
  DUEL_DURATION_MS,
  DUEL_ID_PATTERN,
  type CreateDuelResponse,
  type DuelState,
  type DuelStateResponse,
} from "@/modules/duel/duel-types"
import { REFERRAL_CODE_ALPHABET } from "@/modules/progression/referral-rules"
import { getAdminFirestore } from "@/server/firebase/firebase-admin-app"
import { HttpError } from "@/server/http/authenticated-json-route"
import { parseStoredPlayer, USERS_COLLECTION } from "@/server/profile/stored-player-document"

import { duelRef, finishDuelInTransaction, mirrorDuelState, resetDuelRoom, storedDuelSchema, toDuelState, type StoredDuel } from "./duel-documents"
import { effectiveDuelStatus, isDuelOverdue } from "./duel-rules"

/** Doc trận tự xoá sau từng ấy (cần TTL policy cho `expireAt`, như gameSessions). */
const DUEL_TTL_MS = 7 * 24 * 60 * 60 * 1000

export const createDuelRequestSchema = z.object({ rematchOf: z.string().regex(DUEL_ID_PATTERN).optional() })

export function parseDuel(data: unknown): StoredDuel | null {
  const parsed = storedDuelSchema.safeParse(data)
  return parsed.success ? parsed.data : null
}

/** Số mã thử trong một lần tạo phòng (~887 triệu mã, trùng cả loạt gần như không xảy ra). */
const CODE_CANDIDATES = 4

/** Mã phòng 6 ký tự, cùng bảng chữ không dễ nhầm với mã mời (gõ tay được). */
function generateDuelCode(): string {
  return Array.from({ length: DUEL_CODE_LENGTH }, () => REFERRAL_CODE_ALPHABET[randomInt(REFERRAL_CODE_ALPHABET.length)]).join("")
}

/** Tạo phòng (chủ phòng = người gọi). `rematchOf`: trận vừa xong của chính người gọi → gắn link đấu lại cho đối thủ. */
export async function createDuel(uid: string, rematchOf?: string): Promise<CreateDuelResponse> {
  const db = getAdminFirestore()
  const now = Date.now()
  const candidates = Array.from({ length: CODE_CANDIDATES }, generateDuelCode)
  const host = parseStoredPlayer((await db.collection(USERS_COLLECTION).doc(uid).get()).data())
  const duel: StoredDuel = {
    hostUid: uid,
    hostName: host.displayName,
    guestUid: null,
    guestName: null,
    seed: randomInt(0, 0x1_0000_0000),
    status: "waiting",
    createdAtMs: now,
    startAt: null,
    endsAt: null,
    sessions: {},
    results: {},
    winnerUid: null,
    rematchId: null,
  }

  let rematchState: DuelState | null = null
  const id = await db.runTransaction(async (tx) => {
    // Đọc hết trước khi ghi: các mã ứng viên (chọn mã chưa có phòng) + trận cũ nếu là đấu lại.
    const codeSnaps = await tx.getAll(...candidates.map((code) => duelRef(db, code)))
    const free = codeSnaps.find((snap) => !snap.exists)
    if (!free) throw new HttpError(503, "duel-code-busy")
    const id = free.id
    const previous = rematchOf ? parseDuel((await tx.get(duelRef(db, rematchOf))).data()) : null
    const canLink = previous && rematchOf && previous.status === "finished" && !previous.rematchId && (previous.hostUid === uid || previous.guestUid === uid)
    tx.create(duelRef(db, id), { ...duel, createdAt: FieldValue.serverTimestamp(), expireAt: Timestamp.fromMillis(now + DUEL_TTL_MS) })
    if (canLink) {
      tx.update(duelRef(db, rematchOf), { rematchId: id })
      rematchState = toDuelState(rematchOf, { ...previous, rematchId: id }, now)
    }
    return id
  })
  await resetDuelRoom(id)
  await mirrorDuelState(toDuelState(id, duel, now))
  if (rematchState) await mirrorDuelState(rematchState)
  return { duelId: id }
}

/** Người thứ hai vào phòng → bắt đầu đếm ngược; chủ phòng/đã vào rồi gọi lại thì không đổi gì. */
export async function joinDuel(uid: string, id: string): Promise<DuelStateResponse> {
  const db = getAdminFirestore()
  const now = Date.now()
  const state = await db.runTransaction(async (tx) => {
    const [duelSnap, userSnap] = await tx.getAll(duelRef(db, id), db.collection(USERS_COLLECTION).doc(uid))
    const duel = parseDuel(duelSnap.data())
    if (!duel) throw new HttpError(404, "duel-not-found")
    if (duel.hostUid === uid || duel.guestUid === uid) return toDuelState(id, duel, now)
    const status = effectiveDuelStatus(duel, now)
    if (status === "expired") throw new HttpError(410, "duel-expired")
    if (status !== "waiting") throw new HttpError(409, "duel-full")

    const startAt = now + DUEL_COUNTDOWN_MS
    const joined: StoredDuel = {
      ...duel,
      guestUid: uid,
      guestName: parseStoredPlayer(userSnap.data()).displayName,
      status: "playing",
      startAt,
      endsAt: startAt + DUEL_DURATION_MS,
    }
    tx.update(duelRef(db, id), {
      guestUid: joined.guestUid,
      guestName: joined.guestName,
      status: joined.status,
      startAt: joined.startAt,
      endsAt: joined.endsAt,
    })
    return toDuelState(id, joined, now)
  })
  await mirrorDuelState(state)
  return { ...state, serverNow: Date.now() }
}

/** Xem trận (công khai, id không đoán được); quá hạn nộp mà chưa chốt thì chốt luôn (người không nộp thua). */
export async function getDuel(id: string): Promise<DuelStateResponse> {
  const db = getAdminFirestore()
  const now = Date.now()
  const duel = parseDuel((await duelRef(db, id).get()).data())
  if (!duel) throw new HttpError(404, "duel-not-found")
  if (!isDuelOverdue(duel, now)) return { ...toDuelState(id, duel, now), serverNow: Date.now() }

  const state = await db.runTransaction(async (tx) => {
    const current = parseDuel((await tx.get(duelRef(db, id))).data())
    if (!current) throw new HttpError(404, "duel-not-found")
    if (!isDuelOverdue(current, now)) return toDuelState(id, current, now)
    return toDuelState(id, { ...current, ...finishDuelInTransaction(tx, db, id, current) }, now)
  })
  await mirrorDuelState(state)
  return { ...state, serverNow: Date.now() }
}

