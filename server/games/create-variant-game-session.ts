import "server-only"

import { randomInt } from "node:crypto"

import type { DocumentReference } from "firebase-admin/firestore"

import { findLevel } from "@/modules/game-modes/level-catalog"
import type { StartRankedGameResponse } from "@/modules/player-profile/player-profile-types"
import { currentWeeklyEvent } from "@/server/daily/current-weekly-event"
import { DUEL_EARLY_START_TOLERANCE_MS } from "@/modules/duel/duel-types"
import { duelRef, mirrorDuelState, toDuelState } from "@/server/duels/duel-documents"
import { parseDuel } from "@/server/duels/duel-store"
import { getAdminFirestore } from "@/server/firebase/firebase-admin-app"
import { HttpError } from "@/server/http/authenticated-json-route"
import { parseStoredPlayer, USERS_COLLECTION } from "@/server/profile/stored-player-document"

/** Field chung của doc gameSessions (mode, seed, hạn…) do create-ranked-game-session dựng. */
type SessionFields = (seed: number, extra: Record<string, unknown>) => Record<string, unknown>

/**
 * Sự kiện tuần: seed ngẫu nhiên, luật của tuần hiện tại (lưu tuần + luật vào session để replay đúng
 * kể cả khi nộp sang tuần sau). Ô cất khoá như daily để bảng sự kiện công bằng.
 */
export async function createEventSession(sessionRef: DocumentReference, fields: SessionFields): Promise<StartRankedGameResponse> {
  const event = currentWeeklyEvent(new Date())
  const seed = randomInt(0, 0x1_0000_0000)
  await sessionRef.set(fields(seed, { eventWeek: event.week, eventRuleId: event.ruleId }))
  return { gameId: sessionRef.id, seed, stashUnlocked: false, mode: "event", day: null, challenge: null, event }
}

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
 * Ván đấu 1v1: chỉ thành viên, chỉ khi trận đang diễn ra; mỗi người đúng một ván (gọi lại → 409,
 * ván đang chơi đã nằm trong save của máy).
 */
export async function createDuelSession(
  uid: string,
  sessionRef: DocumentReference,
  fields: SessionFields,
  duelId: string | undefined
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
    if (duel.sessions[uid]) throw new HttpError(409, "duel-already-started")

    tx.set(sessionRef, fields(duel.seed, { duelId }))
    tx.update(ref, { [`sessions.${uid}`]: sessionRef.id })
    const opponent = uid === duel.hostUid ? { uid: duel.guestUid ?? "", name: duel.guestName } : { uid: duel.hostUid, name: duel.hostName }
    const response: StartRankedGameResponse = {
      gameId: sessionRef.id,
      seed: duel.seed,
      stashUnlocked: false,
      mode: "duel",
      day: null,
      challenge: null,
      duel: { id: duelId, opponent, startAt: duel.startAt, endsAt: duel.endsAt, serverNow: now },
    }
    return { response, state: toDuelState(duelId, { ...duel, sessions: { ...duel.sessions, [uid]: sessionRef.id } }, now) }
  })
  // Phòng thấy người này đã vào ván (không đưa quay lại ván đã chơi xong).
  await mirrorDuelState(result.state)
  return result.response
}
