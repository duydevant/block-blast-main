import "server-only"

import { FieldValue } from "firebase-admin/firestore"
import { z } from "zod"

import type { PlayerProfile } from "@/modules/player-profile/player-profile-types"
import { isBlockThemeId, THEME_UNLOCKS } from "@/modules/progression/theme-unlock-rules"
import { dayKeyFor } from "@/server/daily/daily-challenge-calendar"
import { getAdminFirestore } from "@/server/firebase/firebase-admin-app"
import { HttpError } from "@/server/http/authenticated-json-route"
import { parseStoredPlayer, toPlayerProfile, USERS_COLLECTION } from "@/server/profile/stored-player-document"

export const buyThemeRequestSchema = z.object({ themeId: z.string().max(32) })

/** Mua theme bằng xu: kiểm tra giá + số dư và trừ xu trong cùng một transaction. */
export async function buyThemeWithCoins(uid: string, themeId: string): Promise<PlayerProfile> {
  if (!isBlockThemeId(themeId)) throw new HttpError(400, "unknown-theme")
  const unlock = THEME_UNLOCKS[themeId]
  if (unlock.kind !== "coins") throw new HttpError(400, "theme-not-for-sale")

  const userRef = getAdminFirestore().collection(USERS_COLLECTION).doc(uid)
  const stored = await getAdminFirestore().runTransaction(async (tx) => {
    const current = parseStoredPlayer((await tx.get(userRef)).data())
    if (current.unlockedThemes.includes(themeId)) throw new HttpError(409, "theme-owned")
    if (current.coins < unlock.price) throw new HttpError(409, "not-enough-coins")
    const next = { coins: current.coins - unlock.price, unlockedThemes: [...current.unlockedThemes, themeId] }
    tx.set(userRef, { ...next, updatedAt: FieldValue.serverTimestamp() }, { merge: true })
    return { ...current, ...next }
  })
  return toPlayerProfile(uid, stored, dayKeyFor(new Date()))
}
