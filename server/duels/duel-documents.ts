import "server-only"

import { randomInt } from "node:crypto"

import { FieldValue, type DocumentReference, type Firestore, type Transaction } from "firebase-admin/firestore"
import { z } from "zod"

import {
  DUEL_COUNTDOWN_MS,
  DUEL_EARLY_START_TOLERANCE_MS,
  DUEL_DURATION_MS,
  DUEL_HISTORY_LIMIT,
  DUEL_RTDB_PATH,
  type DuelRoundResult,
  type DuelState,
  duelRoundKey,
} from "@/modules/duel/duel-types"
import { CURRENT_RULES_VERSION } from "@/modules/block-puzzle/engine/game-types"
import { getAdminDatabase } from "@/server/firebase/firebase-admin-app"
import { USERS_COLLECTION } from "@/server/profile/stored-player-document"

import { type DuelRoundDecision, effectiveDuelStatus } from "./duel-round-rules"

/** duels/{id}: phòng đấu 1v1 nhiều ván (chỉ Admin SDK đọc/ghi; client nghe bản mirror trên RTDB). */
export const DUELS_COLLECTION = "duels"

const name = z.string().nullable().catch(null)
const scores = z.record(z.string(), z.number().int().nonnegative())
const endReason = z.enum(["clinched", "both-over", "time"])

const roundResultSchema = z.object({ round: z.number().int().positive(), scores, winnerUid: z.string().nullable(), endReason })

export const storedDuelSchema = z
  .object({
    hostUid: z.string(),
    hostName: name,
    guestUid: z.string().nullable().catch(null),
    guestName: name,
    seed: z.number().int().nonnegative().catch(0),
    status: z.enum(["waiting", "playing", "finished", "expired"]),
    createdAtMs: z.number(),
    lastActiveAtMs: z.number().optional(),
    version: z.number().int().nonnegative().catch(0),
    round: z.number().int().nonnegative().catch(0),
    startAt: z.number().nullable().catch(null),
    endsAt: z.number().nullable().catch(null),
    /** uid → gameId của ván hiện tại (mỗi người một ván mỗi lượt). */
    sessions: z.record(z.string(), z.string()).catch({}),
    results: scores.catch({}),
    winnerUid: z.string().nullable().catch(null),
    endReason: endReason.nullable().catch(null),
    series: scores.catch({}),
    ready: z.array(z.string()).catch([]),
    history: z.array(roundResultSchema).catch([]),
    /** Phiên bản luật của ván hiện tại (thiếu = 1: ván mở trước luật v2). */
    rulesVersion: z.literal(2).optional().catch(undefined),
  })
  // Phòng tạo trước khi có lastActiveAtMs: tính từ lúc tạo.
  .transform((duel) => ({ ...duel, lastActiveAtMs: duel.lastActiveAtMs ?? duel.createdAtMs }))

export type StoredDuel = z.infer<typeof storedDuelSchema>

export function duelRef(db: Firestore, id: string) {
  return db.collection(DUELS_COLLECTION).doc(id)
}

export function parseDuel(data: unknown): StoredDuel | null {
  const parsed = storedDuelSchema.safeParse(data)
  return parsed.success ? parsed.data : null
}

export function toDuelState(id: string, duel: StoredDuel, now: number): DuelState {
  return {
    id,
    version: duel.version,
    status: effectiveDuelStatus(duel, now),
    host: { uid: duel.hostUid, name: duel.hostName },
    guest: duel.guestUid ? { uid: duel.guestUid, name: duel.guestName } : null,
    round: duel.round,
    roundKey: duelRoundKey(duel.round),
    seed: duel.round > 0 && duel.startAt !== null && now >= duel.startAt - DUEL_EARLY_START_TOLERANCE_MS ? duel.seed : null,
    startAt: duel.startAt,
    endsAt: duel.endsAt,
    results: duel.results,
    winnerUid: duel.winnerUid,
    endReason: duel.endReason,
    series: duel.series,
    ready: duel.ready,
    history: duel.history,
    started: Object.keys(duel.sessions),
    ...(duel.rulesVersion === 2 ? { rulesVersion: duel.rulesVersion } : {}),
  }
}

/**
 * Ghi thay đổi phòng trong transaction: tăng version (để mirror/clients biết bản nào mới hơn) + mốc hoạt động.
 * Trả bản phòng sau khi ghi để caller dựng state trả về.
 */
export function writeDuel(tx: Transaction, ref: DocumentReference, duel: StoredDuel, patch: Partial<StoredDuel>, now: number): StoredDuel {
  const updated: StoredDuel = { ...duel, ...patch, version: duel.version + 1, lastActiveAtMs: now }
  tx.update(ref, { ...patch, version: updated.version, lastActiveAtMs: now })
  return updated
}

/** Field mở một ván mới: seed mới, đếm ngược rồi 3 phút; xoá kết quả + danh sách sẵn sàng của ván trước. */
export function nextRoundPatch(duel: StoredDuel, now: number): Partial<StoredDuel> {
  const startAt = now + DUEL_COUNTDOWN_MS
  return {
    status: "playing",
    round: duel.round + 1,
    seed: randomInt(0, 0x1_0000_0000),
    rulesVersion: CURRENT_RULES_VERSION,
    startAt,
    endsAt: startAt + DUEL_DURATION_MS,
    sessions: {},
    results: {},
    winnerUid: null,
    endReason: null,
    ready: [],
  }
}

/**
 * Chốt ván trong transaction (đã đọc doc phòng trước đó): điểm, người thắng, tỉ số, lịch sử + cộng thống kê
 * đấu cho hai người.
 */
export function finishRoundInTransaction(
  tx: Transaction,
  db: Firestore,
  id: string,
  duel: StoredDuel,
  decision: DuelRoundDecision,
  now: number
): StoredDuel {
  const { winnerUid, scores } = decision
  const endReason = decision.endReason ?? "time"
  const result: DuelRoundResult = { round: duel.round, scores, winnerUid, endReason }
  const series = winnerUid ? { ...duel.series, [winnerUid]: (duel.series[winnerUid] ?? 0) + 1 } : duel.series
  const updated = writeDuel(
    tx,
    duelRef(db, id),
    duel,
    { status: "finished", results: scores, winnerUid, endReason, series, ready: [], history: [...duel.history, result].slice(-DUEL_HISTORY_LIMIT) },
    now
  )
  for (const uid of [duel.hostUid, duel.guestUid]) {
    if (!uid) continue
    // set + merge với object lồng (không dùng key "duelStats.played": set coi dấu chấm là tên field).
    const duelStats = { played: FieldValue.increment(1), ...(uid === winnerUid ? { won: FieldValue.increment(1) } : {}) }
    tx.set(db.collection(USERS_COLLECTION).doc(uid), { duelStats }, { merge: true })
  }
  return updated
}

/** Xoá phòng cũ trên RTDB (trạng thái + nước đi) — mã 6 ký tự có thể được dùng lại sau khi doc Firestore hết hạn. */
export async function resetDuelRoom(id: string): Promise<void> {
  try {
    await getAdminDatabase().ref(`${DUEL_RTDB_PATH}/${id}`).remove()
  } catch (error) {
    console.warn("[duel] reset RTDB room failed", error)
  }
}

/** Ván mới bắt đầu → bỏ nước đi của ván trước trên RTDB (kết quả đã nằm trong lịch sử phòng). */
export async function dropDuelRoundMoves(id: string, round: number): Promise<void> {
  if (round < 1) return
  try {
    await getAdminDatabase().ref(`${DUEL_RTDB_PATH}/${id}/moves/${duelRoundKey(round)}`).remove()
  } catch (error) {
    console.warn("[duel] drop old moves failed", error)
  }
}

/**
 * Ghi trạng thái phòng lên RTDB để mọi người trong phòng thấy ngay (best-effort: lỗi chỉ log, Firestore vẫn là
 * nguồn thật). Transaction RTDB chỉ ghi khi bản mới không cũ hơn bản đang có (request song song mirror lệch thứ tự).
 */
export async function mirrorDuelState(state: DuelState): Promise<void> {
  try {
    await getAdminDatabase()
      .ref(`${DUEL_RTDB_PATH}/${state.id}/state`)
      .transaction((current: DuelState | null) => (current && (current.version ?? 0) > state.version ? undefined : state))
  } catch (error) {
    console.warn("[duel] mirror to RTDB failed", error)
  }
}
