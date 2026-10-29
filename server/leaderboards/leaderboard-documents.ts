import type { Firestore } from "firebase-admin/firestore"
import { z } from "zod"

import type { LeaderboardRow } from "@/modules/leaderboard/leaderboard-types"
import { PLAYER_TIER_IDS, type PlayerTierId } from "@/modules/progression/player-form-rules"
import { LEADERBOARDS_COLLECTION } from "@/server/profile/stored-player-document"

const topSchema = z.array(
  z.object({
    uid: z.string(),
    displayName: z.string().nullable().catch(null),
    score: z.number().int().nonnegative(),
    tier: z
      .string()
      .refine((value): value is PlayerTierId => PLAYER_TIER_IDS.includes(value as PlayerTierId))
      .optional()
      .catch(undefined),
  })
  // Bỏ hẳn key `tier` khi thiếu/không hợp lệ: ghi lại `undefined` vào Firestore sẽ làm hỏng cả transaction.
  .transform(({ tier, ...row }): LeaderboardRow => (tier ? { ...row, tier } : row))
)

export function leaderboardRef(db: Firestore, boardId: string) {
  return db.collection(LEADERBOARDS_COLLECTION).doc(boardId)
}

/** Doc snapshot chưa có/hỏng → bảng rỗng. */
export function parseLeaderboardTop(data: unknown): LeaderboardRow[] {
  const parsed = topSchema.safeParse((data as { top?: unknown } | undefined)?.top)
  return parsed.success ? parsed.data : []
}
