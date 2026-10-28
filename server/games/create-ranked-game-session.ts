import "server-only"

import { randomInt } from "node:crypto"

import { FieldValue, Timestamp } from "firebase-admin/firestore"

import type { RankedGameMode, StartRankedGameResponse } from "@/modules/player-profile/player-profile-types"
import { readChallengeForSession } from "@/server/challenges/challenge-store"
import { dailySeedFor, dayKeyFor } from "@/server/daily/daily-challenge-calendar"
import { getAdminFirestore } from "@/server/firebase/firebase-admin-app"
import { HttpError } from "@/server/http/authenticated-json-route"
import {
  DAILY_RESULTS_SUBCOLLECTION,
  GAME_SESSIONS_COLLECTION,
  parseStoredPlayer,
  resolveStashUnlockedForNewGame,
  USERS_COLLECTION,
} from "@/server/profile/stored-player-document"

import { createDuelSession, createEventSession, createLevelSession } from "./create-variant-game-session"

/** Session chưa nộp tự hết hạn (cần bật TTL policy cho field `expireAt` trong console). */
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000

function dailySeedSecret(): string {
  const secret = process.env.DAILY_SEED_SECRET
  if (!secret) throw new Error("Missing DAILY_SEED_SECRET environment variable (see docs/firebase-setup-guide.md)")
  return secret
}

/**
 * Cấp seed cho một ván. Classic: seed ngẫu nhiên, ô cất theo profile.
 * Daily: seed chung của ngày, ô cất luôn khoá (công bằng). Lượt **bắt đầu** đầu tiên trong ngày được giữ chỗ
 * ngay (users/{uid}/daily/{day} = started) → mở nhiều lượt rồi chỉ nộp lượt đẹp nhất không được tính.
 * Các lượt sau trả seed để luyện tập nhưng không tạo session (gameId null, không nộp được).
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

  // Ô cất luôn khoá ở các chế độ đặc biệt; extra = id tuần/màn/trận để replay đúng biến thể.
  const variantFields = (seed: number, extra: Record<string, unknown>) => ({ ...session(seed, false, null), ...extra })
  if (request.mode === "event") return createEventSession(sessionRef, variantFields)
  if (request.mode === "level") return createLevelSession(uid, sessionRef, variantFields, request.levelId)
  if (request.mode === "duel") return createDuelSession(uid, sessionRef, variantFields, request.duelId)

  if (request.mode === "daily") {
    const day = dayKeyFor(new Date())
    const seed = dailySeedFor(day, dailySeedSecret())
    const dailyRef = userRef.collection(DAILY_RESULTS_SUBCOLLECTION).doc(day)
    const claimed = await db.runTransaction(async (tx) => {
      if ((await tx.get(dailyRef)).exists) return false
      tx.set(dailyRef, { gameId: sessionRef.id, status: "started", startedAt: FieldValue.serverTimestamp() })
      tx.set(sessionRef, session(seed, false, day))
      return true
    })
    return { gameId: claimed ? sessionRef.id : null, seed, stashUnlocked: false, mode: "daily", day, challenge: null }
  }

  if (request.mode === "challenge") {
    if (!request.challengeId) throw new HttpError(400, "missing-challenge-id")
    const { challenge, opponent } = await readChallengeForSession(request.challengeId)
    await sessionRef.set(session(challenge.seed, challenge.stashUnlocked, null, request.challengeId))
    return { gameId: sessionRef.id, seed: challenge.seed, stashUnlocked: challenge.stashUnlocked, mode: "challenge", day: null, challenge: opponent }
  }

  const seed = randomInt(0, 0x1_0000_0000)
  const stashUnlocked = resolveStashUnlockedForNewGame(parseStoredPlayer((await userRef.get()).data()), request.stashUnlocked)
  await sessionRef.set(session(seed, stashUnlocked, null))
  return { gameId: sessionRef.id, seed, stashUnlocked, mode: "classic", day: null, challenge: null }
}
