import "server-only"

import { FieldValue } from "firebase-admin/firestore"

import type { ReplaceDailyMissionResponse } from "@/modules/progression/daily-mission-catalog"
import { dayKeyFor } from "@/server/daily/daily-challenge-calendar"
import { getAdminFirestore } from "@/server/firebase/firebase-admin-app"
import { HttpError } from "@/server/http/authenticated-json-route"
import { MISSIONS_SUBCOLLECTION, parseStoredPlayer, USERS_COLLECTION } from "@/server/profile/stored-player-document"

import { missionBandFor, missionStatusesFor, parseMissionDay } from "./mission-day-documents"

/**
 * Đổi một nhiệm vụ hôm nay (mỗi ngày 1 lần) lấy loại kế tiếp của ngày. Tiến độ của nhiệm vụ cũ bị bỏ;
 * nhiệm vụ đã hoàn thành thì không đổi được. Chốt luôn mức nhiệm vụ của ngày nếu chưa chốt.
 */
export async function replaceDailyMission(uid: string, slot: number): Promise<ReplaceDailyMissionResponse> {
  const db = getAdminFirestore()
  const day = dayKeyFor(new Date())
  const userRef = db.collection(USERS_COLLECTION).doc(uid)
  const missionsRef = userRef.collection(MISSIONS_SUBCOLLECTION).doc(day)

  return db.runTransaction(async (tx) => {
    const [userSnap, missionsSnap] = await tx.getAll(userRef, missionsRef)
    const missionDay = parseMissionDay(missionsSnap.data())
    if (missionDay.replacedSlot !== null) throw new HttpError(409, "already-replaced")
    const band = missionBandFor(missionDay, parseStoredPlayer(userSnap.data()))
    const current = missionStatusesFor(day, missionDay, band)[slot]
    if (!current) throw new HttpError(400, "invalid-slot")
    if (current.progress >= current.target) throw new HttpError(409, "mission-completed")

    tx.set(missionsRef, { band, replacedSlot: slot, updatedAt: FieldValue.serverTimestamp() }, { merge: true })
    return { missions: missionStatusesFor(day, { ...missionDay, replacedSlot: slot }, band) }
  })
}
