import "server-only"

import type { DailyStatusResponse } from "@/modules/player-profile/player-profile-types"
import { DAILY_RUNS_PER_DAY } from "@/modules/progression/daily-challenge-goals"
import { dailyRewardCoins, dailyRewardDay } from "@/modules/progression/daily-reward-track"
import { getAdminFirestore } from "@/server/firebase/firebase-admin-app"
import { missionBandFor, missionStatusesFor, parseMissionDay } from "@/server/progression/mission-day-documents"
import { MISSIONS_SUBCOLLECTION, parseStoredPlayer, USERS_COLLECTION } from "@/server/profile/stored-player-document"

import { effectiveDailyStreak } from "./advance-daily-streak"
import { dayKeyFor, nextWeekStartMs, previousDayKey } from "./daily-challenge-calendar"
import { computeDailyGoals, dailyDayRef, parseDailyDay } from "./daily-challenge-documents"
import { getDailyWeeks } from "./daily-week-rewards-store"

/** Trạng thái thử thách hôm nay: lượt, mốc, sao, thưởng chuỗi, nhiệm vụ, tuần này + tuần trước. */
export async function getDailyStatus(uid: string): Promise<DailyStatusResponse> {
  const now = new Date()
  const day = dayKeyFor(now)
  const db = getAdminFirestore()
  const userRef = db.collection(USERS_COLLECTION).doc(uid)
  const [[userSnap, todaySnap, yesterdaySnap, missionsSnap], weeks] = await Promise.all([
    db.getAll(userRef, dailyDayRef(db, uid, day), dailyDayRef(db, uid, previousDayKey(day)), userRef.collection(MISSIONS_SUBCOLLECTION).doc(day)),
    getDailyWeeks(db, uid, now),
  ])
  const stored = parseStoredPlayer(userSnap.data())
  const today = parseDailyDay(todaySnap.data())
  const yesterday = parseDailyDay(yesterdaySnap.data())
  const missionDay = parseMissionDay(missionsSnap.data())
  // Chưa bắt đầu lượt đầu → mốc dự kiến (lượt đầu sẽ chốt đúng mốc này nếu không có gì thay đổi).
  const goals = today.goals ?? (await computeDailyGoals(db, uid, day, stored)).goals

  const streak = effectiveDailyStreak(stored.streak, day)
  const claimed = Boolean(todaySnap.get("rewardClaimedAt"))
  // Lượt hôm qua xong mà chưa nhận (chơi lúc gần nửa đêm) → vẫn nhận được, ứng với chuỗi hiện tại.
  const yesterdayPending = yesterday.status === "done" && !yesterdaySnap.get("rewardClaimedAt")
  const todayDone = today.status === "done"
  // Chưa chơi hôm nay: thưởng sẽ ứng với chuỗi sau khi chơi (+1 nếu chuỗi còn sống từ hôm qua).
  const rewardStreak = todayDone || (yesterdayPending && !claimed) ? streak.current : streak.current + 1
  return {
    day,
    todayScore: today.score,
    runInProgress: today.runs.some((run) => !today.finished.includes(run)),
    runs: { used: today.runs.length, max: DAILY_RUNS_PER_DAY },
    goals,
    yesterdayScore: yesterday.score,
    stars: today.stars,
    recordBroken: today.recordBroken,
    week: { ...weeks.week, endsAt: nextWeekStartMs(now) },
    previousWeek: weeks.previousWeek,
    streak,
    reward: {
      day: dailyRewardDay(rewardStreak),
      coins: dailyRewardCoins(rewardStreak),
      claimable: (todayDone && !claimed) || (!todayDone && yesterdayPending),
      claimed,
    },
    missions: missionStatusesFor(day, missionDay, missionBandFor(missionDay, stored)),
    missionReplaceAvailable: missionDay.replacedSlot === null,
  }
}
