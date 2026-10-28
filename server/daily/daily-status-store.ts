import "server-only"

import type { DailyStatusResponse } from "@/modules/player-profile/player-profile-types"
import { dailyMissionProgressSchema, dailyMissionStatuses, dailyMissionsForDay } from "@/modules/progression/daily-mission-catalog"
import { dailyRewardCoins, dailyRewardDay } from "@/modules/progression/daily-reward-track"
import { getAdminFirestore } from "@/server/firebase/firebase-admin-app"
import {
  DAILY_RESULTS_SUBCOLLECTION,
  MISSIONS_SUBCOLLECTION,
  parseStoredPlayer,
  USERS_COLLECTION,
} from "@/server/profile/stored-player-document"

import { currentWeeklyEvent } from "./current-weekly-event"
import { effectiveDailyStreak } from "./advance-daily-streak"
import { dayKeyFor, previousDayKey } from "./daily-challenge-calendar"

/** Trạng thái hôm nay của người chơi: 3 lượt đọc (user + kết quả daily + tiến độ nhiệm vụ). */
export async function getDailyStatus(uid: string): Promise<DailyStatusResponse> {
  const day = dayKeyFor(new Date())
  const userRef = getAdminFirestore().collection(USERS_COLLECTION).doc(uid)
  const [userSnap, resultSnap, missionsSnap, yesterdaySnap] = await Promise.all([
    userRef.get(),
    userRef.collection(DAILY_RESULTS_SUBCOLLECTION).doc(day).get(),
    userRef.collection(MISSIONS_SUBCOLLECTION).doc(day).get(),
    userRef.collection(DAILY_RESULTS_SUBCOLLECTION).doc(previousDayKey(day)).get(),
  ])
  const score = resultSnap.get("score")
  const streak = effectiveDailyStreak(parseStoredPlayer(userSnap.data()).streak, day)
  const claimed = Boolean(resultSnap.get("rewardClaimedAt"))
  // Lượt hôm qua xong mà chưa nhận (chơi lúc gần nửa đêm) → vẫn nhận được, ứng với chuỗi hiện tại.
  const yesterdayPending = yesterdaySnap.get("status") === "done" && !yesterdaySnap.get("rewardClaimedAt")
  const todayDone = resultSnap.get("status") === "done"
  // Chưa chơi hôm nay: thưởng sẽ ứng với chuỗi sau khi chơi (+1 nếu chuỗi còn sống từ hôm qua).
  const rewardStreak = todayDone || (yesterdayPending && !claimed) ? streak.current : streak.current + 1
  return {
    day,
    todayScore: typeof score === "number" ? score : null,
    runInProgress: resultSnap.get("status") === "started",
    streak,
    reward: {
      day: dailyRewardDay(rewardStreak),
      coins: dailyRewardCoins(rewardStreak),
      claimable: (todayDone && !claimed) || (!todayDone && yesterdayPending),
      claimed,
    },
    event: currentWeeklyEvent(new Date()),
    missions: dailyMissionStatuses(dailyMissionsForDay(day), dailyMissionProgressSchema.parse(missionsSnap.get("progress"))),
  }
}
