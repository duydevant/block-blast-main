import "server-only"

import { randomInt } from "node:crypto"

import { FieldValue } from "firebase-admin/firestore"
import { z } from "zod"

import type { PlayerProfile } from "@/modules/player-profile/player-profile-types"
import {
  normalizeReferralCode,
  REFERRAL_CODE_ALPHABET,
  REFERRAL_CODE_LENGTH,
  REFERRAL_GAMES_REQUIRED,
  type ReferralInfoResponse,
} from "@/modules/progression/referral-rules"
import { dayKeyFor } from "@/server/daily/daily-challenge-calendar"
import { getAdminFirestore } from "@/server/firebase/firebase-admin-app"
import { HttpError } from "@/server/http/authenticated-json-route"
import {
  parseStoredPlayer,
  REFERRAL_CODES_COLLECTION,
  toPlayerProfile,
  USERS_COLLECTION,
} from "@/server/profile/stored-player-document"

export const claimReferralRequestSchema = z.object({ code: z.string().max(16) })

/** Số mã thử trong một lần tạo; ~887 triệu mã nên trùng cả loạt gần như không xảy ra. */
const CODE_CANDIDATES = 4

function generateReferralCode(): string {
  return Array.from({ length: REFERRAL_CODE_LENGTH }, () => REFERRAL_CODE_ALPHABET[randomInt(REFERRAL_CODE_ALPHABET.length)]).join("")
}

/** Mã mời của người chơi; lần đầu thì tạo (referralCodes/{code} → uid) trong transaction. */
export async function getOrCreateReferralInfo(uid: string): Promise<ReferralInfoResponse> {
  const db = getAdminFirestore()
  const userRef = db.collection(USERS_COLLECTION).doc(uid)
  return db.runTransaction(async (tx) => {
    const userSnap = await tx.get(userRef)
    const stored = parseStoredPlayer(userSnap.data())
    if (stored.referralCode) return { code: stored.referralCode, referralCount: stored.referralCount }

    const candidates = Array.from({ length: CODE_CANDIDATES }, generateReferralCode)
    const snaps = await tx.getAll(...candidates.map((code) => db.collection(REFERRAL_CODES_COLLECTION).doc(code)))
    const free = snaps.find((snap) => !snap.exists)
    if (!free) throw new HttpError(503, "referral-code-busy")

    const createdAt = FieldValue.serverTimestamp()
    tx.create(free.ref, { uid, createdAt })
    // Giống lúc nộp ván đầu: doc chưa có thì tạo đủ field gốc.
    const base = userSnap.exists ? {} : { displayName: null, createdAt }
    tx.set(userRef, { referralCode: free.id, updatedAt: createdAt, ...base }, { merge: true })
    return { code: free.id, referralCount: stored.referralCount }
  })
}

/**
 * Nhập mã mời: chỉ khi chưa được ai mời, chưa chơi đủ số ván thưởng, không tự mời mình
 * và không mời chéo lại người đã mời mình. Quà phát lúc nộp ván thứ REFERRAL_GAMES_REQUIRED.
 */
export async function claimReferralCode(uid: string, rawCode: string): Promise<PlayerProfile> {
  const code = normalizeReferralCode(rawCode)
  if (!code) throw new HttpError(400, "invalid-code")

  const db = getAdminFirestore()
  const userRef = db.collection(USERS_COLLECTION).doc(uid)
  const stored = await db.runTransaction(async (tx) => {
    const codeSnap = await tx.get(db.collection(REFERRAL_CODES_COLLECTION).doc(code))
    const inviterUid = codeSnap.get("uid")
    if (typeof inviterUid !== "string") throw new HttpError(404, "code-not-found")
    if (inviterUid === uid) throw new HttpError(400, "own-code")

    const [userSnap, inviterSnap] = await tx.getAll(userRef, db.collection(USERS_COLLECTION).doc(inviterUid))
    const current = parseStoredPlayer(userSnap.data())
    if (current.referredBy !== null) throw new HttpError(409, "already-referred")
    const mutual = parseStoredPlayer(inviterSnap.data()).referredBy === uid
    if (current.stats.gamesPlayed >= REFERRAL_GAMES_REQUIRED || mutual) throw new HttpError(409, "not-eligible")

    tx.set(userRef, { referredBy: inviterUid, referredAt: FieldValue.serverTimestamp() }, { merge: true })
    return { ...current, referredBy: inviterUid }
  })
  return toPlayerProfile(uid, stored, dayKeyFor(new Date()))
}
