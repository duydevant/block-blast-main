import "server-only"

import { randomInt } from "node:crypto"

import { FieldValue, Timestamp } from "firebase-admin/firestore"

import { CURRENT_RULES_VERSION, type RulesVersion } from "@/modules/block-puzzle/engine/game-types"
import type { RankedGameMode, StartRankedGameResponse } from "@/modules/player-profile/player-profile-types"
import { createArenaSession } from "@/server/arena/create-arena-session"
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
  request: {
    mode: RankedGameMode
    stashUnlocked: boolean
    challengeId?: string
    levelId?: number
    duelId?: string
    arenaRunId?: string
    rulesVersion?: RulesVersion
  }
): Promise<StartRankedGameResponse> {
  // Tab / PWA còn chạy JS trước luật v2 không khai phiên bản → ván riêng cấp v1 (replay khớp ván client đó tạo);
  // ván dùng chung luật v2 (thách đấu, phòng 1v1) thì từ chối để client tải lại bản mới.
  const clientSupportsCurrent = request.rulesVersion === CURRENT_RULES_VERSION
  const endlessRules = clientSupportsCurrent ? CURRENT_RULES_VERSION : undefined
  const db = getAdminFirestore()
  const userRef = db.collection(USERS_COLLECTION).doc(uid)
  const sessionRef = db.collection(GAME_SESSIONS_COLLECTION).doc()
  // Phiên bản luật chỉ ghi cho chế độ vô tận; Màn / Đấu trường / Không bế tắc giữ luật v1 (thiết kế theo bộ chia cũ).
  const session = (seed: number, stashUnlocked: boolean, day: string | null, challengeId: string | null = null, rulesVersion?: RulesVersion) => ({
    uid,
    seed,
    stashUnlocked,
    mode: request.mode,
    day,
    challengeId,
    ...(rulesVersion === 2 ? { rulesVersion } : {}),
    status: "open",
    createdAt: FieldValue.serverTimestamp(),
    expireAt: Timestamp.fromMillis(Date.now() + SESSION_TTL_MS),
  })

  // Ô cất luôn khoá ở các chế độ đặc biệt; extra = id màn/trận để replay đúng biến thể.
  const variantFields = (seed: number, extra: Record<string, unknown>) => ({ ...session(seed, false, null), ...extra })
  if (request.mode === "level") return createLevelSession(uid, sessionRef, variantFields, request.levelId)
  if (request.mode === "duel") return createDuelSession(uid, sessionRef, variantFields, request.duelId, clientSupportsCurrent)
  if (request.mode === "arena") return createArenaSession(uid, sessionRef, variantFields, request.arenaRunId)

  if (request.mode === "daily") {
    const daily = await startDailyRun(uid, sessionRef, (seed, day) => session(seed, false, day, null, endlessRules))
    return { ...daily, rulesVersion: endlessRules }
  }

  if (request.mode === "challenge") {
    if (!request.challengeId) throw new HttpError(400, "missing-challenge-id")
    const { challenge, opponent } = await readChallengeForSession(request.challengeId)
    if (challenge.rulesVersion === 2 && !clientSupportsCurrent) throw new HttpError(409, "client-outdated")
    // Cùng luật với ván của người thách (thách đấu tạo trước luật v2 → v1) để hai bên có cùng chuỗi khay.
    await sessionRef.set(session(challenge.seed, challenge.stashUnlocked, null, request.challengeId, challenge.rulesVersion))
    return {
      gameId: sessionRef.id,
      seed: challenge.seed,
      stashUnlocked: challenge.stashUnlocked,
      mode: "challenge",
      day: null,
      challenge: opponent,
      rulesVersion: challenge.rulesVersion,
    }
  }

  const seed = randomInt(0, 0x1_0000_0000)
  // Ván "Không bế tắc" là chế độ biến thể: ô cất khoá đầu ván như client (variantGameState) → replay khớp tuyệt đối.
  const stashUnlocked =
    request.mode === "logic" ? false : resolveStashUnlockedForNewGame(parseStoredPlayer((await userRef.get()).data()), request.stashUnlocked)
  const rulesVersion = request.mode === "logic" ? undefined : endlessRules
  await sessionRef.set(session(seed, stashUnlocked, null, null, rulesVersion))
  // classic và logic ("Không bế tắc") cấp seed như nhau; biến thể suy từ mode khi replay.
  return { gameId: sessionRef.id, seed, stashUnlocked, mode: request.mode === "logic" ? "logic" : "classic", day: null, challenge: null, rulesVersion }
}
