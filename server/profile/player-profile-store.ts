import "server-only"

import { FieldValue } from "firebase-admin/firestore"
import { z } from "zod"

import { normalizeDisplayName, type PlayerProfile } from "@/modules/player-profile/player-profile-types"
import { dayKeyFor } from "@/server/daily/daily-challenge-calendar"
import { getAdminFirestore } from "@/server/firebase/firebase-admin-app"
import { HttpError } from "@/server/http/authenticated-json-route"
import { renamePlayerOnCurrentLeaderboards } from "@/server/leaderboards/rename-player-on-current-leaderboards"

import { parseStoredPlayer, toPlayerProfile, USERS_COLLECTION } from "./stored-player-document"

export const updateProfileRequestSchema = z.object({
  displayName: z.string().max(64),
})

/** Doc chưa tồn tại (chưa nộp ván nào) → trả profile mặc định, không ghi gì. */
export async function getPlayerProfile(uid: string): Promise<PlayerProfile> {
  const snap = await getAdminFirestore().collection(USERS_COLLECTION).doc(uid).get()
  return toPlayerProfile(uid, parseStoredPlayer(snap.data()), dayKeyFor(new Date()))
}

export async function updatePlayerDisplayName(uid: string, rawName: string): Promise<PlayerProfile> {
  const displayName = normalizeDisplayName(rawName)
  if (!displayName) throw new HttpError(400, "invalid-display-name")

  const userRef = getAdminFirestore().collection(USERS_COLLECTION).doc(uid)
  await userRef.set({ displayName, updatedAt: FieldValue.serverTimestamp() }, { merge: true })
  await renamePlayerOnCurrentLeaderboards(uid, displayName)
  return toPlayerProfile(uid, parseStoredPlayer((await userRef.get()).data()), dayKeyFor(new Date()))
}
