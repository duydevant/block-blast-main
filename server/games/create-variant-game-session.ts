import "server-only"

import type { DocumentReference } from "firebase-admin/firestore"

import { findLevel } from "@/modules/game-modes/level-catalog"
import type { StartRankedGameResponse } from "@/modules/player-profile/player-profile-types"
import { DUEL_EARLY_START_TOLERANCE_MS } from "@/modules/duel/duel-types"
import { DUEL_RTDB_PATH, duelRoundKey } from "@/modules/duel/duel-types"
import { duelRef, mirrorDuelState, parseDuel, toDuelState, writeDuel } from "@/server/duels/duel-documents"
import { getAdminDatabase } from "@/server/firebase/firebase-admin-app"
import { getAdminFirestore } from "@/server/firebase/firebase-admin-app"
import { HttpError } from "@/server/http/authenticated-json-route"
import { parseStoredPlayer, USERS_COLLECTION } from "@/server/profile/stored-player-document"

/** Field chung của doc gameSessions (mode, seed, hạn…) do create-ranked-game-session dựng. */
type SessionFields = (seed: number, extra: Record<string, unknown>) => Record<string, unknown>

/**
 * Màn chơi: seed + bàn cố định theo màn (mọi người cùng một câu đố). Màn chỉ mở (được thưởng) khi server
 * đã xác nhận qua màn trước; màn qua offline chưa đồng bộ → client tự chơi offline màn sau.
 */
export async function createLevelSession(
  uid: string,
  sessionRef: DocumentReference,
  fields: SessionFields,
  levelId: number | undefined
): Promise<StartRankedGameResponse> {
  const definition = levelId === undefined ? undefined : findLevel(levelId)
  if (!definition) throw new HttpError(400, "unknown-level")
  if (definition.id > 1) {
    const stored = parseStoredPlayer((await getAdminFirestore().collection(USERS_COLLECTION).doc(uid).get()).data())
    if (!stored.levelStars[String(definition.id - 1)]) throw new HttpError(403, "level-locked")
  }
  await sessionRef.set(fields(definition.seed, { levelId: definition.id }))
  return { gameId: sessionRef.id, seed: definition.seed, stashUnlocked: false, mode: "level", day: null, challenge: null, levelId: definition.id }
}

/**
 * Ván đấu 1v1: chỉ thành viên, chỉ khi ván hiện tại của phòng đang diễn ra; mỗi người đúng một ván mỗi lượt.
 * Gọi lại khi chưa đi nước nào (mất phản hồi lần trước) → trả lại ván đã cấp; đã đi nước rồi → 409 (ván đang nằm
 * trong save của máy kia, chơi song song sẽ làm hỏng chuỗi nước). Điểm ván đấu chấm từ nước đi trên RTDB.
 */
export async function createDuelSession(
  uid: string,
  sessionRef: DocumentReference,
  fields: SessionFields,
  duelId: string | undefined,
  clientSupportsCurrent: boolean
): Promise<StartRankedGameResponse> {
  if (!duelId) throw new HttpError(400, "missing-duel-id")
  const db = getAdminFirestore()
  const ref = duelRef(db, duelId)
  const now = Date.now()
  const result = await db.runTransaction(async (tx) => {
    const duel = parseDuel((await tx.get(ref)).data())
    if (!duel || (duel.hostUid !== uid && duel.guestUid !== uid)) throw new HttpError(404, "duel-not-found")
    // Không cấp seed trong lúc đếm ngược: ai cũng nhận seed cùng lúc khi trận bắt đầu.
    if (duel.status !== "playing" || duel.startAt === null || duel.endsAt === null || now < duel.startAt - DUEL_EARLY_START_TOLERANCE_MS || now >= duel.endsAt) {
      throw new HttpError(409, "duel-not-playing")
    }
    // Ván của phòng theo luật v2 mà client còn JS cũ (tạo bàn luật v1) → nước đi sẽ chấm sai: bắt tải lại trước.
    if (duel.rulesVersion === 2 && !clientSupportsCurrent) throw new HttpError(409, "client-outdated")
    const existing = duel.sessions[uid]
    const updated = existing ? duel : writeDuel(tx, ref, duel, { sessions: { ...duel.sessions, [uid]: sessionRef.id } }, now)
    if (!existing) tx.set(sessionRef, fields(duel.seed, { duelId, ...(duel.rulesVersion === 2 ? { rulesVersion: 2 } : {}) }))
    const opponent = uid === duel.hostUid ? { uid: duel.guestUid ?? "", name: duel.guestName } : { uid: duel.hostUid, name: duel.hostName }
    const response: StartRankedGameResponse = {
      gameId: existing ?? sessionRef.id,
      seed: duel.seed,
      stashUnlocked: false,
      mode: "duel",
      day: null,
      challenge: null,
      duel: { id: duelId, round: duel.round, opponent, startAt: duel.startAt, endsAt: duel.endsAt, serverNow: now },
      rulesVersion: duel.rulesVersion,
    }
    return { response, state: toDuelState(duelId, updated, now), existing: Boolean(existing), round: duel.round }
  })
  if (result.existing) {
    const moves = await getAdminDatabase().ref(`${DUEL_RTDB_PATH}/${duelId}/moves/${duelRoundKey(result.round)}/${uid}`).limitToFirst(1).get()
    if (moves.exists()) throw new HttpError(409, "duel-already-started")
  }
  // Phòng thấy người này đã vào ván (không đưa quay lại ván đã chơi xong).
  await mirrorDuelState(result.state)
  return result.response
}
