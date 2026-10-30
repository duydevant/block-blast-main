import "server-only"

import { FieldValue, Timestamp } from "firebase-admin/firestore"

import { type RecordedGameAction, replayRecordedGame } from "@/modules/block-puzzle/engine/replay-recorded-game-actions"
import { formFromRecent, tierForForm } from "@/modules/progression/player-form-rules"
import { type GameReplayResponse, MAX_SAVED_REPLAYS, type SaveReplayResponse } from "@/modules/replay/replay-types"
import { getAdminFirestore } from "@/server/firebase/firebase-admin-app"
import { storedSessionSchema, variantForSession } from "@/server/games/stored-game-session"
import { HttpError } from "@/server/http/authenticated-json-route"
import { GAME_SESSIONS_COLLECTION, parseStoredPlayer, USERS_COLLECTION } from "@/server/profile/stored-player-document"

import { GAME_REPLAYS_COLLECTION, replayDocFor, toReplayResponse } from "./replay-documents"

/** Tự lưu giữ 1 năm (không vĩnh viễn như kỷ lục). */
const SAVED_REPLAY_TTL_MS = 365 * 24 * 60 * 60 * 1000

export async function getGameReplay(replayId: string): Promise<GameReplayResponse | null> {
  const snap = await getAdminFirestore().collection(GAME_REPLAYS_COLLECTION).doc(replayId).get()
  return snap.exists ? toReplayResponse(snap.id, snap.data()) : null
}

/**
 * Người chơi tự lưu một ván ĐÃ NỘP của chính mình (để chia sẻ / xem lại). Server replay lại log và chỉ nhận khi
 * điểm khớp điểm đã tính lúc nộp. Đã có replay (tự động hoặc lưu trước) → trả luôn id, không tính lượt lưu.
 */
export async function saveOwnGameReplay(uid: string, gameId: string, actions: RecordedGameAction[]): Promise<SaveReplayResponse> {
  const db = getAdminFirestore()
  const sessionRef = db.collection(GAME_SESSIONS_COLLECTION).doc(gameId)
  const replayRef = db.collection(GAME_REPLAYS_COLLECTION).doc(gameId)
  const userRef = db.collection(USERS_COLLECTION).doc(uid)

  // Đếm ngoài transaction (aggregate không chạy trong transaction); vượt 1–2 khi bấm song song là chấp nhận được.
  const savedCount = (await db.collection(GAME_REPLAYS_COLLECTION).where("uid", "==", uid).where("saved", "==", true).count().get()).data().count

  return db.runTransaction(async (tx) => {
    const [sessionSnap, replaySnap, userSnap] = await tx.getAll(sessionRef, replayRef, userRef)
    const session = storedSessionSchema.safeParse(sessionSnap.data())
    if (!session.success || session.data.uid !== uid) throw new HttpError(404, "game-not-found")
    if (replaySnap.exists) return { replayId: gameId }
    const storedScore = sessionSnap.get("score")
    if (session.data.status !== "done" || typeof storedScore !== "number" || sessionSnap.get("suspect") === true) {
      throw new HttpError(409, "game-not-verified")
    }
    const stored = parseStoredPlayer(userSnap.data())
    if (stored.banned) throw new HttpError(403, "account-restricted")
    if (savedCount >= MAX_SAVED_REPLAYS) throw new HttpError(409, "replay-limit")

    const { seed, stashUnlocked, mode, levelId } = session.data
    if (mode === "event") throw new HttpError(409, "game-not-verified")
    const replay = replayRecordedGame({ seed, stashUnlocked, variant: variantForSession(session.data) }, actions)
    if (!replay.ok || replay.summary.score !== storedScore) throw new HttpError(422, "replay-mismatch")

    const createdAt = FieldValue.serverTimestamp()
    tx.set(
      replayRef,
      replayDocFor({
        uid,
        mode,
        seed,
        stashUnlocked,
        levelId,
        actions,
        summary: replay.summary,
        displayName: stored.displayName,
        tier: tierForForm(formFromRecent(stored.recentFormScores)),
        playerTag: stored.referralCode,
        createdAt,
        expireAt: Timestamp.fromMillis(Date.now() + SAVED_REPLAY_TTL_MS),
        saved: true,
      })
    )
    tx.update(sessionRef, { replayId: gameId })
    return { replayId: gameId }
  })
}
