import { type FieldValue, Timestamp } from "firebase-admin/firestore"
import { z } from "zod"

import { encodeActions } from "@/modules/block-puzzle/engine/recorded-action-codec"
import type { RecordedGameAction, ReplaySummary } from "@/modules/block-puzzle/engine/replay-recorded-game-actions"
import { guestTagFromUid, type RankedGameMode } from "@/modules/player-profile/player-profile-types"
import { PLAYER_TIER_IDS, type PlayerTier, type PlayerTierId } from "@/modules/progression/player-form-rules"
import type { GameReplayResponse } from "@/modules/replay/replay-types"

/** gameReplays/{gameId}: log nước đi (nén) của ván đáng xem lại. TTL policy trên `expireAt` (null = giữ mãi). */
export const GAME_REPLAYS_COLLECTION = "gameReplays"
/** Replay không phải kỷ lục cá nhân / top mọi lúc giữ bấy lâu. */
export const REPLAY_TTL_MS = 90 * 24 * 60 * 60 * 1000

export const replayExpiry = (nowMs: number) => Timestamp.fromMillis(nowMs + REPLAY_TTL_MS)

export function replayDocFor(input: {
  uid: string
  mode: RankedGameMode
  seed: number
  stashUnlocked: boolean
  levelId: number | null
  actions: readonly RecordedGameAction[]
  summary: ReplaySummary
  displayName: string | null
  tier: PlayerTier
  playerTag: string | null
  createdAt: FieldValue | Timestamp
  /** null = không tự xoá (kỷ lục cá nhân, top mọi lúc). */
  expireAt: Timestamp | null
  /** Giữ vì top bảng mọi lúc đang link tới (không bỏ ghim khi có kỷ lục cá nhân mới). */
  pinnedByBoard?: boolean
  /** Người chơi tự lưu (đếm giới hạn MAX_SAVED_REPLAYS). */
  saved?: boolean
}) {
  const { summary } = input
  return {
    uid: input.uid,
    mode: input.mode,
    seed: input.seed,
    stashUnlocked: input.stashUnlocked,
    levelId: input.levelId,
    actions: encodeActions(input.actions),
    score: summary.score,
    moveCount: summary.moveCount,
    runStats: summary.runStats,
    displayName: input.displayName,
    tier: input.tier === "unranked" ? null : input.tier,
    playerTag: input.playerTag,
    createdAt: input.createdAt,
    expireAt: input.expireAt,
    pinnedByBoard: input.pinnedByBoard ?? false,
    saved: input.saved ?? false,
  }
}

const count = z.number().int().nonnegative()
const storedReplaySchema = z.object({
  uid: z.string(),
  mode: z.enum(["classic", "daily", "challenge", "level", "duel", "logic", "arena", "ranked"]),
  seed: count,
  stashUnlocked: z.boolean(),
  levelId: z.number().int().positive().nullable().catch(null),
  actions: z.array(count),
  score: count,
  moveCount: count,
  runStats: z
    .object({
      clearMoves: count,
      multiClears: z.tuple([count, count, count]),
      maxLinesInMove: count,
      bestCombo: count,
      boardClears: count,
      stashUses: count,
      replaceUses: count,
      reviveUsed: z.boolean(),
    })
    .nullable()
    .catch(null),
  displayName: z.string().nullable().catch(null),
  tier: z
    .string()
    .refine((value): value is PlayerTierId => PLAYER_TIER_IDS.includes(value as PlayerTierId))
    .nullable()
    .catch(null),
  playerTag: z.string().nullable().catch(null),
  createdAt: z.instanceof(Timestamp).optional(),
})

/** Doc → response công khai (bỏ uid). Doc hỏng → null. */
export function toReplayResponse(id: string, data: unknown): GameReplayResponse | null {
  const parsed = storedReplaySchema.safeParse(data)
  if (!parsed.success) return null
  const { uid, createdAt, ...rest } = parsed.data
  return { id, ...rest, guestTag: guestTagFromUid(uid), createdAt: createdAt?.toMillis() ?? 0 }
}
