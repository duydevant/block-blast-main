import "server-only"

import { FieldValue } from "firebase-admin/firestore"
import { z } from "zod"

import type { RecordedGameAction } from "@/modules/block-puzzle/engine/replay-recorded-game-actions"
import { CHALLENGE_MIN_MOVES, CHALLENGE_REWARD_WINDOW_MS } from "@/modules/challenge/challenge-reward-rules"
import type { ChallengeView } from "@/modules/challenge/challenge-types"
import { guestTagFromUid } from "@/modules/player-profile/player-profile-types"
import { getAdminFirestore } from "@/server/firebase/firebase-admin-app"
import { recordSubmittedRankedGame } from "@/server/games/record-submitted-ranked-game"
import { HttpError } from "@/server/http/authenticated-json-route"
import { GAME_SESSIONS_COLLECTION, parseStoredPlayer, USERS_COLLECTION } from "@/server/profile/stored-player-document"

import {
  CHALLENGE_RESULTS_SUBCOLLECTION,
  CHALLENGES_COLLECTION,
  generateChallengeId,
  storedChallengeSchema,
  toChallengeOpponent,
} from "./challenge-documents"

const SHOWN_RESULTS = 20

const sessionSchema = z.object({
  uid: z.string(),
  seed: z.number().int().nonnegative(),
  stashUnlocked: z.boolean(),
  status: z.string(),
  mode: z.string().catch("classic"),
  score: z.number().int().nonnegative().optional(),
  moveCount: z.number().int().nonnegative().catch(0),
  suspect: z.boolean().catch(false),
  /** Thách đấu đã tạo từ ván này (khác `challengeId` = thách đấu mà ván nhận thách đấu đang chơi). */
  createdChallengeId: z.string().optional(),
  rulesVersion: z.literal(2).optional().catch(undefined),
})

/**
 * Tạo thách đấu từ một ván classic của chính người gọi. Ván chưa nộp thì nộp luôn (`actions`) để điểm
 * người thách là điểm server đã replay. Mỗi ván chỉ một thách đấu (gọi lại trả về id cũ).
 */
export async function createChallengeFromSession(uid: string, gameId: string, actions: RecordedGameAction[] | undefined) {
  const db = getAdminFirestore()
  const sessionRef = db.collection(GAME_SESSIONS_COLLECTION).doc(gameId)
  const initial = sessionSchema.safeParse((await sessionRef.get()).data())
  if (!initial.success || initial.data.uid !== uid) throw new HttpError(404, "game-not-found")
  if (initial.data.mode !== "classic") throw new HttpError(400, "not-challengeable")

  if (initial.data.status === "open") {
    if (!actions) throw new HttpError(409, "game-not-submitted")
    // Lượt nộp song song từ hàng chờ có thể đã ghi trước → 409 vẫn tiếp tục.
    await recordSubmittedRankedGame(uid, gameId, actions).catch((error: unknown) => {
      if (!(error instanceof HttpError && error.status === 409)) throw error
    })
  }

  return db.runTransaction(async (tx) => {
    const [sessionSnap, userSnap] = await tx.getAll(sessionRef, db.collection(USERS_COLLECTION).doc(uid))
    const session = sessionSchema.safeParse(sessionSnap.data())
    if (!session.success || session.data.status !== "done" || session.data.score === undefined) {
      throw new HttpError(409, "game-not-verified")
    }
    if (session.data.createdChallengeId) return { challengeId: session.data.createdChallengeId }

    const challengeId = generateChallengeId()
    tx.set(db.collection(CHALLENGES_COLLECTION).doc(challengeId), {
      creatorUid: uid,
      creatorName: parseStoredPlayer(userSnap.data()).displayName,
      creatorScore: session.data.score,
      seed: session.data.seed,
      stashUnlocked: session.data.stashUnlocked,
      sourceGameId: gameId,
      ...(session.data.rulesVersion === 2 ? { rulesVersion: 2 } : {}),
      attempts: 0,
      // Ván người thách quá ngắn / nghi bot → thách đấu vẫn chơi được nhưng không có thưởng 2 chiều.
      expiresAtMs: !session.data.suspect && session.data.moveCount >= CHALLENGE_MIN_MOVES ? Date.now() + CHALLENGE_REWARD_WINDOW_MS : null,
      createdAt: FieldValue.serverTimestamp(),
    })
    tx.update(sessionRef, { createdChallengeId: challengeId })
    return { challengeId }
  })
}

/** Đọc thách đấu cho người nhận (seed + điều kiện đầu ván) — chỉ dùng khi tạo session. */
export async function readChallengeForSession(challengeId: string) {
  const snap = await getAdminFirestore().collection(CHALLENGES_COLLECTION).doc(challengeId).get()
  const parsed = storedChallengeSchema.safeParse(snap.data())
  if (!parsed.success) throw new HttpError(404, "challenge-not-found")
  return { challenge: parsed.data, opponent: toChallengeOpponent(challengeId, parsed.data) }
}

/** Thông tin công khai (không có seed, không có uid) + 20 kết quả cao nhất. */
export async function getChallengeView(challengeId: string): Promise<ChallengeView | null> {
  const ref = getAdminFirestore().collection(CHALLENGES_COLLECTION).doc(challengeId)
  const [snap, resultsSnap] = await Promise.all([
    ref.get(),
    ref.collection(CHALLENGE_RESULTS_SUBCOLLECTION).orderBy("score", "desc").limit(SHOWN_RESULTS).get(),
  ])
  const parsed = storedChallengeSchema.safeParse(snap.data())
  if (!parsed.success) return null

  const opponent = toChallengeOpponent(challengeId, parsed.data)
  return {
    ...opponent,
    attempts: parsed.data.attempts,
    // Chỉ trả hạn thưởng khi còn hạn (giờ server) → trang không phải tự so giờ.
    rewardExpiresAt: parsed.data.expiresAtMs !== null && parsed.data.expiresAtMs > Date.now() ? parsed.data.expiresAtMs : null,
    results: resultsSnap.docs.map((doc) => ({
      displayName: typeof doc.get("displayName") === "string" ? doc.get("displayName") : null,
      tag: guestTagFromUid(doc.id),
      score: Number(doc.get("score")) || 0,
    })),
  }
}
