import "server-only"

import type { YearRecapResponse } from "@/modules/recap/recap-types"
import { getAdminFirestore } from "@/server/firebase/firebase-admin-app"
import { parseStoredPlayer, USERS_COLLECTION, YEARS_SUBCOLLECTION } from "@/server/profile/stored-player-document"

import { buildYearRecap } from "./build-year-recap"

/** Tổng kết năm của chính người gọi: doc bộ đếm năm + doc người chơi (2 lượt đọc). */
export async function getYearRecap(uid: string, year: number): Promise<YearRecapResponse> {
  const db = getAdminFirestore()
  const userRef = db.collection(USERS_COLLECTION).doc(uid)
  const [userSnap, yearSnap] = await db.getAll(userRef, userRef.collection(YEARS_SUBCOLLECTION).doc(String(year)))
  return buildYearRecap(year, yearSnap.data(), parseStoredPlayer(userSnap.data()))
}
