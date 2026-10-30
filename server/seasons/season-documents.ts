import type { DocumentReference, DocumentSnapshot, FieldValue, Firestore, Transaction } from "firebase-admin/firestore"
import { z } from "zod"

import type { MissionBand } from "@/modules/progression/daily-mission-catalog"
import { PLAYER_TIER_IDS, type PlayerTier, tierRank } from "@/modules/progression/player-form-rules"
import {
  advanceSeasonMissions,
  type SeasonGameResult,
  seasonMissionProgressSchema,
  seasonMissionsFor,
} from "@/modules/progression/season-mission-catalog"
import { USERS_COLLECTION } from "@/server/profile/stored-player-document"

/** users/{uid}/seasons/{YYYY-MM}: số ván, Bậc cao nhất, nhiệm vụ mùa, đã nhận thưởng hạng chưa. */
export const SEASONS_SUBCOLLECTION = "seasons"

const count = z.number().int().nonnegative().catch(0)
const seasonDocSchema = z.object({
  /** Mức nhiệm vụ mùa, chốt ở ván đầu tiên của mùa. */
  band: z
    .number()
    .int()
    .min(0)
    .max(3)
    .transform((value) => value as MissionBand)
    .optional()
    .catch(undefined),
  games: count,
  progress: seasonMissionProgressSchema,
  claimedMissions: z.array(z.string()).catch([]),
  peakTier: z
    .string()
    .refine((value): value is PlayerTier => value === "unranked" || (PLAYER_TIER_IDS as readonly string[]).includes(value))
    .catch("unranked"),
  rankClaimed: z.boolean().catch(false),
})

export type SeasonDoc = z.infer<typeof seasonDocSchema>

export function parseSeasonDoc(data: unknown): SeasonDoc {
  const parsed = seasonDocSchema.safeParse(data ?? {})
  return parsed.success ? parsed.data : { band: undefined, games: 0, progress: {}, claimedMissions: [], peakTier: "unranked", rankClaimed: false }
}

export function seasonRef(db: Firestore, uid: string, season: string) {
  return db.collection(USERS_COLLECTION).doc(uid).collection(SEASONS_SUBCOLLECTION).doc(season)
}

/**
 * Cập nhật mùa sau một ván đã replay (thuần): +1 ván, Bậc cao nhất, tiến độ nhiệm vụ mùa. `bandIfNew` = mức theo Bậc
 * hiện tại, chỉ dùng khi mùa chưa chốt mức.
 */
export function seasonUpdatesFor(input: { season: string; doc: SeasonDoc; bandIfNew: MissionBand; game: SeasonGameResult }) {
  const band = input.doc.band ?? input.bandIfNew
  const peakTier = tierRank(input.game.tierAfter) > tierRank(input.doc.peakTier) ? input.game.tierAfter : input.doc.peakTier
  return {
    band,
    games: input.doc.games + 1,
    peakTier,
    progress: advanceSeasonMissions(seasonMissionsFor(input.season, band), input.doc.progress, input.game),
  }
}

/** Ghi tiến độ mùa của một ván (sau khi transaction đã đọc xong). */
export function writeSeasonProgress(
  tx: Transaction,
  input: { ref: DocumentReference; snap: DocumentSnapshot; season: string; bandIfNew: MissionBand; game: SeasonGameResult; stamp: FieldValue }
) {
  const updates = seasonUpdatesFor({ season: input.season, doc: parseSeasonDoc(input.snap.data()), bandIfNew: input.bandIfNew, game: input.game })
  tx.set(input.ref, { ...updates, updatedAt: input.stamp }, { merge: true })
}
