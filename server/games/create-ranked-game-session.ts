import "server-only"

import { randomInt } from "node:crypto"

import { FieldValue, Timestamp } from "firebase-admin/firestore"

import type { RankedGameMode, StartRankedGameResponse } from "@/modules/player-profile/player-profile-types"
import { readChallengeForSession } from "@/server/challenges/challenge-store"
import { startDailyRun } from "@/server/daily/start-daily-run"
import { getAdminFirestore } from "@/server/firebase/firebase-admin-app"
import { HttpError } from "@/server/http/authenticated-json-route"
import {
  GAME_SESSIONS_COLLECTION,
  parseStoredPlayer,
  resolveStashUnlockedForNewGame,
  USERS_COLLECTION,
} from "@/server/profile/stored-player-document"

import { createDuelSession, createLevelSession } from "./create-variant-game-session"

/** Session chưa nộp tự hết hạn (cần bật TTL policy cho field `expireAt` trong console). */
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000

/**
 * Cấp seed cho một ván. Classic: seed ngẫu nhiên, ô cất theo profile.
 * Daily: xem startDailyRun (3 lượt tính điểm mỗi ngày, sau đó luyện tập).
 * Challenge: seed + ô cất y như ván của người thách; chơi lại bao nhiêu lần cũng được (giữ điểm cao nhất).
 */
export async function createRankedGameSession(
  uid: string,
  request: { mode: RankedGameMode; stashUnlocked: boolean; challengeId?: string; levelId?: number; duelId?: string }
): Promise<StartRankedGameResponse> {
  const db = getAdminFirestore()
  const userRef = db.collection(USERS_COLLECTION).doc(uid)
  const sessionRef = db.collection(GAME_SESSIONS_COLLECTION).doc()
  const session = (seed: number, stashUnlocked: boolean, day: string | null, challengeId: string | null = null) => ({
    uid,
    seed,
    stashUnlocked,
    mode: request.mode,
    day,
    challengeId,
    status: "open",
    createdAt: FieldValue.serverTimestamp(),
    expireAt: Timestamp.fromMillis(Date.now() + SESSION_TTL_MS),
  })

  // Ô cất luôn khoá ở các chế độ đặc biệt; extra = id màn/trận để replay đúng biến thể.
  const variantFields = (seed: number, extra: Record<string, unknown>) => ({ ...session(seed, false, null), ...extra })
  if (request.mode === "level") return createLevelSession(uid, sessionRef, variantFields, request.levelId)
  if (request.mode === "duel") return createDuelSession(uid, sessionRef, variantFields, request.duelId)

  if (request.mode === "daily") return startDailyRun(uid, sessionRef, (seed, day) => session(seed, false, day))

  if (request.mode === "challenge") {
    if (!request.challengeId) throw new HttpError(400, "missing-challenge-id")
    const { challenge, opponent } = await readChallengeForSession(request.challengeId)
    await sessionRef.set(session(challenge.seed, challenge.stashUnlocked, null, request.challengeId))
    return { gameId: sessionRef.id, seed: challenge.seed, stashUnlocked: challenge.stashUnlocked, mode: "challenge", day: null, challenge: opponent }
  }

  const seed = randomInt(0, 0x1_0000_0000)
  // Ván "Không bế tắc" là chế độ biến thể: ô cất khoá đầu ván như client (variantGameState) → replay khớp tuyệt đối.
  const stashUnlocked =
    request.mode === "logic" ? false : resolveStashUnlockedForNewGame(parseStoredPlayer((await userRef.get()).data()), request.stashUnlocked)
  await sessionRef.set(session(seed, stashUnlocked, null))
  // classic và logic ("Không bế tắc") cấp seed như nhau; biến thể suy từ mode khi replay.
  return { gameId: sessionRef.id, seed, stashUnlocked, mode: request.mode === "logic" ? "logic" : "classic", day: null, challenge: null }
}
