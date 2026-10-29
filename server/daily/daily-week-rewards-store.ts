import "server-only"

import { FieldValue, type Firestore } from "firebase-admin/firestore"
import { z } from "zod"

import { weekDayKeysFor } from "@/lib/vn-calendar"
import {
  type ClaimDailyWeekRequest,
  type ClaimDailyWeekResponse,
  type DailyWeekStatus,
  WEEK_STAR_CHESTS,
  weekChestStatuses,
  weekRankCoins,
} from "@/modules/progression/daily-challenge-goals"
import { getAdminFirestore } from "@/server/firebase/firebase-admin-app"
import { HttpError } from "@/server/http/authenticated-json-route"
import { challengeWeekBoardId, isChallengeWeekOpen } from "@/server/leaderboards/leaderboard-board-ids"
import { leaderboardRef } from "@/server/leaderboards/leaderboard-documents"
import { LEADERBOARD_ENTRIES_SUBCOLLECTION, parseStoredPlayer, USERS_COLLECTION } from "@/server/profile/stored-player-document"

import { dayKeyFor, isoWeekKeyFor } from "./daily-challenge-calendar"
import { dailyDayRef, dailyWeekRef, parseDailyDay } from "./daily-challenge-documents"

const WEEK_MS = 7 * 24 * 60 * 60 * 1000
const weekKeySchema = z.string().regex(/^\d{4}-W\d{2}$/)

export const claimDailyWeekRequestSchema: z.ZodType<ClaimDailyWeekRequest> = z.discriminatedUnion("kind", [
  z.object({ week: weekKeySchema, kind: z.literal("chest"), index: z.number().int().min(0).max(WEEK_STAR_CHESTS.length - 1) }),
  z.object({ week: weekKeySchema, kind: z.literal("rank") }),
])

/** users/{uid}/dailyWeeks/{week}: rương đã nhận, thưởng hạng đã nhận (kèm hạng lúc nhận). */
const weekDocSchema = z.object({
  chests: z.array(z.number().int().nonnegative()).catch([]),
  rankClaimedAt: z.unknown().optional(),
  rank: z.number().int().positive().nullable().catch(null).optional(),
})

/** `rankClaimable`: bảng tuần đã chốt (hết giờ ân hạn nộp muộn) → nhận được thưởng hạng, hạng không đổi nữa. */
export type PastWeekStatus = DailyWeekStatus & { rankCoins: number; rankClaimed: boolean; rankClaimable: boolean }

/** Tuần này + tuần trước, mỗi tuần kèm 7 khoá ngày (để đếm sao). */
function weeksOf(now: Date) {
  const lastWeek = new Date(now.getTime() - WEEK_MS)
  return {
    current: { week: isoWeekKeyFor(now), days: weekDayKeysFor(dayKeyFor(now)) },
    previous: { week: isoWeekKeyFor(lastWeek), days: weekDayKeysFor(dayKeyFor(lastWeek)) },
  }
}

const entryRef = (db: Firestore, week: string, uid: string) =>
  leaderboardRef(db, challengeWeekBoardId(week)).collection(LEADERBOARD_ENTRIES_SUBCOLLECTION).doc(uid)

/** Hạng = số người tổng điểm cao hơn + 1 (bằng điểm đồng hạng), như bảng xếp hạng. */
async function rankFor(db: Firestore, week: string, total: number): Promise<number> {
  const higher = leaderboardRef(db, challengeWeekBoardId(week)).collection(LEADERBOARD_ENTRIES_SUBCOLLECTION).where("score", ">", total)
  return (await higher.count().get()).data().count + 1
}

async function readWeek(db: Firestore, uid: string, week: string, days: string[], now: Date): Promise<PastWeekStatus> {
  const [entrySnap, weekSnap, ...daySnaps] = await db.getAll(entryRef(db, week, uid), dailyWeekRef(db, uid, week), ...days.map((day) => dailyDayRef(db, uid, day)))
  const score = entrySnap.get("score")
  const total = typeof score === "number" ? score : null
  const stars = daySnaps.reduce((sum, snap) => sum + parseDailyDay(snap.data()).stars, 0)
  const doc = weekDocSchema.parse(weekSnap.data() ?? {})
  const storedRank = doc.rankClaimedAt ? (doc.rank ?? null) : null
  const rank = total === null ? null : (storedRank ?? (await rankFor(db, week, total)))
  return { week, total, rank, stars, chests: weekChestStatuses(stars, doc.chests), rankCoins: weekRankCoins(rank), rankClaimed: Boolean(doc.rankClaimedAt), rankClaimable: !isChallengeWeekOpen(week, now) }
}

/** Thử thách tuần này + tuần trước (chỉ khi có chơi) cho GET /api/daily. */
export async function getDailyWeeks(db: Firestore, uid: string, now: Date): Promise<{ week: DailyWeekStatus; previousWeek: PastWeekStatus | null }> {
  const { current, previous } = weeksOf(now)
  const [thisWeek, lastWeek] = await Promise.all([readWeek(db, uid, current.week, current.days, now), readWeek(db, uid, previous.week, previous.days, now)])
  const { week, total, rank, stars, chests } = thisWeek
  return {
    week: { week, total, rank, stars, chests },
    previousWeek: lastWeek.total !== null || lastWeek.stars > 0 ? lastWeek : null,
  }
}

/**
 * Nhận rương sao (tuần này hoặc tuần trước, khi đủ sao) hoặc thưởng hạng (chỉ tuần trước, sau khi bảng chốt).
 * Kiểm + đánh dấu trong transaction nên không nhận được hai lần.
 */
export async function claimDailyWeekReward(uid: string, request: ClaimDailyWeekRequest, now = new Date()): Promise<ClaimDailyWeekResponse> {
  const db = getAdminFirestore()
  const { current, previous } = weeksOf(now)
  const target = request.week === current.week ? current : request.week === previous.week ? previous : null
  if (!target) throw new HttpError(410, "week-closed")
  if (request.kind === "rank" && (target !== previous || isChallengeWeekOpen(previous.week, now))) throw new HttpError(409, "week-not-finished")

  // Hạng tính trước transaction (bảng tuần trước đã chốt, không còn đổi).
  let rank: number | null = null
  if (request.kind === "rank") {
    const total = (await entryRef(db, target.week, uid).get()).get("score")
    if (typeof total !== "number") throw new HttpError(409, "week-not-played")
    rank = await rankFor(db, target.week, total)
  }

  const userRef = db.collection(USERS_COLLECTION).doc(uid)
  const weekRef = dailyWeekRef(db, uid, target.week)
  return db.runTransaction(async (tx) => {
    const [userSnap, weekSnap, ...daySnaps] = await tx.getAll(userRef, weekRef, ...target.days.map((day) => dailyDayRef(db, uid, day)))
    const doc = weekDocSchema.parse(weekSnap.data() ?? {})
    let coins: number
    if (request.kind === "chest") {
      const stars = daySnaps.reduce((sum, snap) => sum + parseDailyDay(snap.data()).stars, 0)
      const chest = WEEK_STAR_CHESTS[request.index]
      if (stars < chest.stars) throw new HttpError(409, "chest-locked")
      if (doc.chests.includes(request.index)) throw new HttpError(409, "already-claimed")
      coins = chest.coins
    } else {
      if (doc.rankClaimedAt) throw new HttpError(409, "already-claimed")
      coins = weekRankCoins(rank)
    }

    const stamp = FieldValue.serverTimestamp()
    tx.set(
      weekRef,
      request.kind === "chest" ? { chests: [...doc.chests, request.index], updatedAt: stamp } : { rankClaimedAt: stamp, rankCoins: coins, rank },
      { merge: true }
    )
    const stored = parseStoredPlayer(userSnap.data())
    tx.set(userRef, { coins: stored.coins + coins, updatedAt: stamp }, { merge: true })
    return { coins, totalCoins: stored.coins + coins }
  })
}
