import "server-only"

import { FieldValue } from "firebase-admin/firestore"

import { type ClaimDailyRewardResponse, dailyRewardCoins, dailyRewardDay } from "@/modules/progression/daily-reward-track"
import { getAdminFirestore } from "@/server/firebase/firebase-admin-app"
import { HttpError } from "@/server/http/authenticated-json-route"
import { DAILY_RESULTS_SUBCOLLECTION, parseStoredPlayer, USERS_COLLECTION } from "@/server/profile/stored-player-document"

import { effectiveDailyStreak } from "./advance-daily-streak"
import { dayKeyFor, previousDayKey } from "./daily-challenge-calendar"

/**
 * Nhận thưởng thử thách: lượt tính điểm hôm nay đã nộp xong (status "done"), mỗi ngày một lần; chưa có thì nhận
 * cho lượt hôm qua chưa nhận (chơi xong 23:59, sang ngày mới mới bấm nhận). Xu theo vòng 7 ngày của chuỗi.
 */
export async function claimDailyReward(uid: string): Promise<ClaimDailyRewardResponse> {
  const db = getAdminFirestore()
  const today = dayKeyFor(new Date())
  const userRef = db.collection(USERS_COLLECTION).doc(uid)
  const todayRef = userRef.collection(DAILY_RESULTS_SUBCOLLECTION).doc(today)
  const yesterdayRef = userRef.collection(DAILY_RESULTS_SUBCOLLECTION).doc(previousDayKey(today))

  return db.runTransaction(async (tx) => {
    const [userSnap, todaySnap, yesterdaySnap] = await tx.getAll(userRef, todayRef, yesterdayRef)
    const claimable = (snap: typeof todaySnap) => snap.get("status") === "done" && !snap.get("rewardClaimedAt")
    // Lượt hôm qua chỉ nhận khi hôm nay chưa chơi xong (khớp với trạng thái hiện ở GET /api/daily).
    const dailySnap = claimable(todaySnap) ? todaySnap : todaySnap.get("status") !== "done" && claimable(yesterdaySnap) ? yesterdaySnap : null
    if (!dailySnap) throw new HttpError(409, todaySnap.get("rewardClaimedAt") ? "already-claimed" : "daily-not-done")
    const dailyRef = dailySnap.ref

    const stored = parseStoredPlayer(userSnap.data())
    const streak = effectiveDailyStreak(stored.streak, today).current
    const coins = dailyRewardCoins(streak)
    const now = FieldValue.serverTimestamp()
    tx.update(dailyRef, { rewardClaimedAt: now, rewardCoins: coins })
    tx.set(userRef, { coins: stored.coins + coins, updatedAt: now }, { merge: true })
    return { coins, day: dailyRewardDay(streak), totalCoins: stored.coins + coins }
  })
}
