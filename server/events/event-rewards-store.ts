import "server-only"

import { FieldValue, type Firestore } from "firebase-admin/firestore"
import { z } from "zod"

import {
  type ClaimEventRewardRequest,
  type ClaimEventRewardResponse,
  EVENT_SCORE_MILESTONES,
  eventRankRewardCoins,
  type EventStatusResponse,
  type EventWeekStatus,
  milestoneStatuses,
} from "@/modules/game-modes/event-rewards"
import { eventRuleForWeek } from "@/modules/game-modes/weekly-event-catalog"
import { isoWeekKeyFor, nextWeekStartMs } from "@/server/daily/daily-challenge-calendar"
import { getAdminFirestore } from "@/server/firebase/firebase-admin-app"
import { HttpError } from "@/server/http/authenticated-json-route"
import { eventBoardId, isEventWeekOpen } from "@/server/leaderboards/leaderboard-board-ids"
import { leaderboardRef } from "@/server/leaderboards/leaderboard-documents"
import { LEADERBOARD_ENTRIES_SUBCOLLECTION, parseStoredPlayer, USERS_COLLECTION } from "@/server/profile/stored-player-document"

/** users/{uid}/eventRewards/{week}: mốc đã nhận + đã nhận thưởng hạng chưa. */
const EVENT_REWARDS_SUBCOLLECTION = "eventRewards"
const WEEK_MS = 7 * 24 * 60 * 60 * 1000

export const claimEventRewardRequestSchema: z.ZodType<ClaimEventRewardRequest> = z.discriminatedUnion("kind", [
  z.object({ week: z.string().regex(/^\d{4}-W\d{2}$/), kind: z.literal("milestone"), index: z.number().int().min(0).max(EVENT_SCORE_MILESTONES.length - 1) }),
  z.object({ week: z.string().regex(/^\d{4}-W\d{2}$/), kind: z.literal("rank") }),
])

const rewardsDocSchema = z.object({
  milestones: z.array(z.number().int().nonnegative()).catch([]),
  rankClaimedAt: z.unknown().optional(),
  /** Hạng lúc nhận thưởng (bảng đã chốt) — hiển thị lại không cần đếm. */
  rank: z.number().int().positive().nullable().catch(null).optional(),
})

function weeks(now: Date) {
  return { current: isoWeekKeyFor(now), previous: isoWeekKeyFor(new Date(now.getTime() - WEEK_MS)) }
}

function entryRef(db: Firestore, week: string, uid: string) {
  return leaderboardRef(db, eventBoardId(week)).collection(LEADERBOARD_ENTRIES_SUBCOLLECTION).doc(uid)
}

function rewardsRef(db: Firestore, week: string, uid: string) {
  return db.collection(USERS_COLLECTION).doc(uid).collection(EVENT_REWARDS_SUBCOLLECTION).doc(week)
}

/** Hạng = số người điểm cao hơn + 1 (đồng điểm đồng hạng), như bảng xếp hạng. */
async function rankFor(db: Firestore, week: string, score: number): Promise<number> {
  const higher = leaderboardRef(db, eventBoardId(week)).collection(LEADERBOARD_ENTRIES_SUBCOLLECTION).where("score", ">", score)
  return (await higher.count().get()).data().count + 1
}

async function weekStatus(db: Firestore, week: string, uid: string): Promise<EventWeekStatus & { rankClaimed: boolean }> {
  const [entrySnap, rewardsSnap] = await Promise.all([entryRef(db, week, uid).get(), rewardsRef(db, week, uid).get()])
  const score = entrySnap.get("score")
  const bestScore = typeof score === "number" ? score : null
  const rewards = rewardsDocSchema.parse(rewardsSnap.data() ?? {})
  const storedRank = rewards.rankClaimedAt ? (rewards.rank ?? null) : null
  return {
    week,
    ruleId: eventRuleForWeek(week).id,
    bestScore,
    rank: bestScore === null ? null : (storedRank ?? (await rankFor(db, week, bestScore))),
    milestones: milestoneStatuses(bestScore, rewards.milestones),
    rankClaimed: Boolean(rewards.rankClaimedAt),
  }
}

/** Trạng thái sự kiện tuần này (mốc, hạng, giờ kết thúc) + tuần trước nếu đã chơi (thưởng hạng). */
export async function getEventStatus(uid: string, now = new Date()): Promise<EventStatusResponse> {
  const db = getAdminFirestore()
  const { current, previous } = weeks(now)
  const [currentStatus, previousStatus] = await Promise.all([weekStatus(db, current, uid), weekStatus(db, previous, uid)])
  const { week, ruleId, bestScore, rank, milestones } = currentStatus
  return {
    current: { week, ruleId, bestScore, rank, milestones, endsAt: nextWeekStartMs(now) },
    previous: previousStatus.bestScore === null ? null : { ...previousStatus, rankCoins: eventRankRewardCoins(previousStatus.rank) },
  }
}

/**
 * Nhận thưởng sự kiện: mốc điểm (tuần này hoặc tuần trước) khi điểm cao nhất đã đạt mốc; thưởng hạng chỉ cho
 * tuần trước (đã kết thúc). Kiểm + đánh dấu trong transaction nên không nhận được hai lần.
 */
export async function claimEventReward(uid: string, request: ClaimEventRewardRequest, now = new Date()): Promise<ClaimEventRewardResponse> {
  const db = getAdminFirestore()
  const { current, previous } = weeks(now)
  if (request.week !== current && request.week !== previous) throw new HttpError(410, "event-week-closed")
  // Thưởng hạng chỉ mở khi bảng tuần trước đã chốt (hết giờ ân hạn nộp muộn) → hạng không đổi nữa.
  if (request.kind === "rank" && (request.week !== previous || isEventWeekOpen(request.week, now))) throw new HttpError(409, "event-not-finished")

  // Hạng tính trước transaction (bảng tuần trước đã đóng, không còn đổi).
  const entry = await entryRef(db, request.week, uid).get()
  const best = entry.get("score")
  if (typeof best !== "number") throw new HttpError(409, "event-not-played")
  const rank = request.kind === "rank" ? await rankFor(db, request.week, best) : null
  const coins = request.kind === "rank" ? eventRankRewardCoins(rank) : EVENT_SCORE_MILESTONES[request.index].coins
  if (request.kind === "milestone" && best < EVENT_SCORE_MILESTONES[request.index].score) throw new HttpError(409, "milestone-not-reached")

  const userRef = db.collection(USERS_COLLECTION).doc(uid)
  const docRef = rewardsRef(db, request.week, uid)
  return db.runTransaction(async (tx) => {
    const [userSnap, rewardsSnap] = await tx.getAll(userRef, docRef)
    const rewards = rewardsDocSchema.parse(rewardsSnap.data() ?? {})
    if (request.kind === "milestone" && rewards.milestones.includes(request.index)) throw new HttpError(409, "already-claimed")
    if (request.kind === "rank" && rewards.rankClaimedAt) throw new HttpError(409, "already-claimed")

    const stamp = FieldValue.serverTimestamp()
    tx.set(
      docRef,
      request.kind === "milestone" ? { milestones: [...rewards.milestones, request.index], updatedAt: stamp } : { rankClaimedAt: stamp, rankCoins: coins, rank },
      { merge: true }
    )
    const stored = parseStoredPlayer(userSnap.data())
    tx.set(userRef, { coins: stored.coins + coins, updatedAt: stamp }, { merge: true })
    return { coins, totalCoins: stored.coins + coins }
  })
}
