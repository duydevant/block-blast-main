import "server-only"

import { FieldValue, Timestamp } from "firebase-admin/firestore"

import { CURRENT_RULES_VERSION, type RulesVersion } from "@/modules/block-puzzle/engine/game-types"
import type { StartRankedGameResponse } from "@/modules/player-profile/player-profile-types"
import { RANKED_TIME_MS } from "@/modules/ranked/bot-ghost"
import { applyMatch, rankedSeasonKeyFor, ratingForSeason } from "@/modules/ranked/rating-rules"
import { getAdminFirestore } from "@/server/firebase/firebase-admin-app"
import { HttpError } from "@/server/http/authenticated-json-route"
import { GAME_SESSIONS_COLLECTION, parseStoredPlayer, USERS_COLLECTION } from "@/server/profile/stored-player-document"

import { pickGhost } from "./ghost-pool-documents"

/** Session chưa nộp sau chừng này (3 phút + ân hạn) → trận cũ tính thua khi mở trận mới. */
const RANKED_FORFEIT_AFTER_MS = RANKED_TIME_MS + 2 * 60 * 1000

/**
 * Mở trận xếp hạng: chọn bóng ma theo MMR, tạo session `mode: "ranked"` cùng seed với bóng ma (biến thể đấu 1v1).
 * Trận trước còn mở (thoát không nộp): đang trong giờ → 409 `match-pending`; quá giờ → tính thua (không né thua được).
 */
export async function startRankedMatch(uid: string, clientRulesVersion?: RulesVersion): Promise<StartRankedGameResponse> {
  // Hồ bóng ma + bot chỉ có luật hiện tại; JS cũ sẽ dựng bàn luật cũ → chấm sai, tính thua oan. Bắt tải lại trước.
  if (clientRulesVersion !== CURRENT_RULES_VERSION) throw new HttpError(409, "client-outdated")
  const db = getAdminFirestore()
  const userRef = db.collection(USERS_COLLECTION).doc(uid)
  const now = new Date()
  const nowMs = now.getTime()
  const season = rankedSeasonKeyFor(now)
  const before = parseStoredPlayer((await userRef.get()).data())
  if (before.banned) throw new HttpError(403, "account-restricted")
  const ghost = await pickGhost(db, { uid, mmr: ratingForSeason(before.rating, season).mmr, recentOpponents: before.rating?.recentOpponents ?? [] })
  const sessionRef = db.collection(GAME_SESSIONS_COLLECTION).doc()

  const pending = await db.runTransaction(async (tx) => {
    const stored = parseStoredPlayer((await tx.get(userRef)).data())
    let rating = ratingForSeason(stored.rating, season)
    const openRef = stored.rankedOpenGameId ? db.collection(GAME_SESSIONS_COLLECTION).doc(stored.rankedOpenGameId) : null
    const openSnap = openRef ? await tx.get(openRef) : null
    // Con trỏ còn trỏ tới trận chưa chấm xong (đang mở, hoặc bị từ chối mà chưa trừ) → thua. "done" đã chấm rồi.
    if (openRef && openSnap?.exists && openSnap.get("status") !== "done") {
      const createdAtMs = openSnap.get("createdAt")?.toMillis?.() ?? 0
      const stillOpen = openSnap.get("status") === "open"
      if (stillOpen && nowMs - createdAtMs < RANKED_FORFEIT_AFTER_MS) return true
      if (stillOpen) tx.update(openRef, { status: "abandoned", abandonReason: "ranked-forfeit" })
      rating = applyMatch(rating, { mmr: Number(openSnap.get("ghostMmr")) || rating.mmr, uid: openSnap.get("ghostUid") ?? null, isBot: openSnap.get("ghostIsBot") === true }, "loss").rating
    }
    tx.set(sessionRef, {
      uid,
      seed: ghost.seed,
      stashUnlocked: false,
      mode: "ranked",
      day: null,
      challengeId: null,
      status: "open",
      ghostId: ghost.id,
      ghostScore: ghost.score,
      ghostMmr: ghost.mmr,
      ghostUid: ghost.uid,
      ghostIsBot: ghost.isBot,
      ...(ghost.rulesVersion === 2 ? { rulesVersion: ghost.rulesVersion } : {}),
      createdAt: FieldValue.serverTimestamp(),
      expireAt: Timestamp.fromMillis(nowMs + 30 * 24 * 60 * 60 * 1000),
    })
    tx.set(userRef, { rating, rankedOpenGameId: sessionRef.id, updatedAt: FieldValue.serverTimestamp() }, { merge: true })
    return false
  })
  if (pending) throw new HttpError(409, "match-pending")

  return {
    gameId: sessionRef.id,
    seed: ghost.seed,
    stashUnlocked: false,
    mode: "ranked",
    day: null,
    challenge: null,
    ranked: {
      ghost: { displayName: ghost.displayName, tier: ghost.tier, isBot: ghost.isBot, actions: ghost.actions, times: ghost.times },
      endsAt: nowMs + RANKED_TIME_MS,
      serverNow: nowMs,
    },
    rulesVersion: ghost.rulesVersion,
  }
}
