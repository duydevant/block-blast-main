import "server-only"

import { FieldValue, type Firestore } from "firebase-admin/firestore"
import { z } from "zod"

import { previousSeasonKey, seasonBounds, seasonKeyFor } from "@/lib/vn-calendar"
import { missionBandForTier } from "@/modules/progression/daily-mission-catalog"
import { formFromRecent, tierForForm } from "@/modules/progression/player-form-rules"
import { COINS_PER_LEVEL_UP, levelForXp } from "@/modules/progression/player-level-curve"
import { seasonMissionStatuses, seasonMissionsFor } from "@/modules/progression/season-mission-catalog"
import {
  type PreviousSeasonStatus,
  SEASON_GRACE_MS,
  seasonBadgeId,
  type SeasonClaimResponse,
  seasonRankCoins,
  type SeasonStatusResponse,
} from "@/modules/progression/season-rules"
import { getAdminFirestore } from "@/server/firebase/firebase-admin-app"
import { HttpError } from "@/server/http/authenticated-json-route"
import { seasonBoardId } from "@/server/leaderboards/leaderboard-board-ids"
import { leaderboardRef } from "@/server/leaderboards/leaderboard-documents"
import { LEADERBOARD_ENTRIES_SUBCOLLECTION, parseStoredPlayer, type StoredPlayer, USERS_COLLECTION } from "@/server/profile/stored-player-document"
import { hasOpenReports } from "@/server/reports/report-store"

import { parseSeasonDoc, type SeasonDoc, seasonRef } from "./season-documents"

/** Thưởng hạng mùa từ top này trở lên bị giữ khi có báo cáo gian lận chưa xử lý (như thử thách tuần). */
const REVIEWED_RANK_LIMIT = 10

export const seasonClaimRequestSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("mission"), season: z.string().regex(/^\d{4}-\d{2}$/), missionId: z.string().max(64) }),
  z.object({ kind: z.literal("rank") }),
])

/** Mức nhiệm vụ mùa: đã chốt thì giữ, chưa thì theo Bậc hiện tại. */
const bandOf = (doc: SeasonDoc, stored: StoredPlayer) => doc.band ?? missionBandForTier(tierForForm(formFromRecent(stored.recentFormScores)))

/** Hạng bảng điểm mùa = số người điểm cao hơn + 1 (null = không có điểm trên bảng). */
async function seasonRankFor(db: Firestore, season: string, uid: string): Promise<number | null> {
  const entries = leaderboardRef(db, seasonBoardId(season)).collection(LEADERBOARD_ENTRIES_SUBCOLLECTION)
  const score = (await entries.doc(uid).get()).get("score")
  if (typeof score !== "number") return null
  return (await entries.where("score", ">", score).count().get()).data().count + 1
}

const isSeasonClosed = (season: string, now: Date) => now.getTime() >= seasonBounds(season).endMs + SEASON_GRACE_MS

export async function getSeasonStatus(uid: string, now = new Date()): Promise<SeasonStatusResponse> {
  const db = getAdminFirestore()
  const season = seasonKeyFor(now)
  const previousKey = previousSeasonKey(season)
  const [userSnap, currentSnap, previousSnap] = await db.getAll(db.collection(USERS_COLLECTION).doc(uid), seasonRef(db, uid, season), seasonRef(db, uid, previousKey))
  const stored = parseStoredPlayer(userSnap.data())
  const current = parseSeasonDoc(currentSnap.data())
  const previousDoc = parseSeasonDoc(previousSnap.data())

  let previous: PreviousSeasonStatus | null = null
  if (previousSnap.exists && previousDoc.games > 0) {
    const rank = await seasonRankFor(db, previousKey, uid)
    previous = {
      season: previousKey,
      games: previousDoc.games,
      peakTier: previousDoc.peakTier,
      rank,
      rankCoins: seasonRankCoins(rank, previousDoc.games),
      badge: seasonBadgeId(previousKey, previousDoc.peakTier, previousDoc.games),
      claimable: isSeasonClosed(previousKey, now),
      claimed: previousDoc.rankClaimed,
    }
  }
  return {
    season,
    endsAt: seasonBounds(season).endMs,
    daysLeft: Math.max(0, Math.ceil((seasonBounds(season).endMs - now.getTime()) / (24 * 60 * 60 * 1000))),
    games: current.games,
    peakTier: current.peakTier,
    missions: seasonMissionStatuses(seasonMissionsFor(season, bandOf(current, stored)), current.progress, current.claimedMissions),
    previous,
  }
}

/** Nhận thưởng nhiệm vụ mùa (mùa này hoặc mùa trước) / thưởng hạng + huy hiệu mùa trước. Kiểm + đánh dấu trong transaction. */
export async function claimSeasonReward(uid: string, request: z.infer<typeof seasonClaimRequestSchema>, now = new Date()): Promise<SeasonClaimResponse> {
  const db = getAdminFirestore()
  const current = seasonKeyFor(now)
  const season = request.kind === "rank" ? previousSeasonKey(current) : request.season
  if (season !== current && season !== previousSeasonKey(current)) throw new HttpError(410, "season-closed")
  if (request.kind === "rank" && !isSeasonClosed(season, now)) throw new HttpError(409, "season-not-finished")

  // Hạng tính trước transaction (bảng mùa trước đã chốt, không còn đổi).
  const rank = request.kind === "rank" ? await seasonRankFor(db, season, uid) : null
  if (rank !== null && rank <= REVIEWED_RANK_LIMIT && (await hasOpenReports(db, uid))) throw new HttpError(409, "under-review")

  const userRef = db.collection(USERS_COLLECTION).doc(uid)
  const docRef = seasonRef(db, uid, season)
  return db.runTransaction(async (tx) => {
    const [userSnap, seasonSnap] = await tx.getAll(userRef, docRef)
    const stored = parseStoredPlayer(userSnap.data())
    const doc = parseSeasonDoc(seasonSnap.data())
    const stamp = FieldValue.serverTimestamp()
    let coins = 0
    let xp = 0
    let badge: string | null = null

    if (request.kind === "mission") {
      const mission = seasonMissionStatuses(seasonMissionsFor(season, bandOf(doc, stored)), doc.progress, doc.claimedMissions).find((item) => item.id === request.missionId)
      if (!mission) throw new HttpError(404, "mission-not-found")
      if (mission.claimed) throw new HttpError(409, "already-claimed")
      if (mission.progress < mission.target) throw new HttpError(409, "mission-not-done")
      coins = mission.coins
      xp = mission.xp
      tx.set(docRef, { claimedMissions: FieldValue.arrayUnion(mission.id), updatedAt: stamp }, { merge: true })
    } else {
      if (doc.games === 0) throw new HttpError(409, "season-not-played")
      if (doc.rankClaimed) throw new HttpError(409, "already-claimed")
      coins = seasonRankCoins(rank, doc.games)
      badge = seasonBadgeId(season, doc.peakTier, doc.games)
      tx.set(docRef, { rankClaimed: true, rank, rankCoins: coins, updatedAt: stamp }, { merge: true })
    }

    // XP nhiệm vụ có thể làm lên cấp → cộng xu lên cấp như lúc nộp ván.
    const levelCoins = (levelForXp(stored.xp + xp) - levelForXp(stored.xp)) * COINS_PER_LEVEL_UP
    const totalCoins = stored.coins + coins + levelCoins
    tx.set(
      userRef,
      { coins: totalCoins, xp: stored.xp + xp, ...(badge ? { seasonBadges: FieldValue.arrayUnion(badge) } : {}), updatedAt: stamp },
      { merge: true }
    )
    return { coins: coins + levelCoins, xp, badge, totalCoins }
  })
}
