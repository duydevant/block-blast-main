import { z } from "zod"

import { STASH_SLOT, TRAY_SIZE } from "@/modules/block-puzzle/engine/game-types"
import { CHALLENGE_ID_PATTERN } from "@/modules/challenge/challenge-types"
import { DUEL_ID_PATTERN } from "@/modules/duel/duel-types"
import { LEVEL_COUNT } from "@/modules/game-modes/level-catalog"
import { MAX_RECORDED_ACTIONS, type RecordedGameAction } from "@/modules/block-puzzle/engine/replay-recorded-game-actions"

const boardIndex = z.number().int().min(-8).max(15)

/** Toạ độ ngoài bàn để reducer tự từ chối; ở đây chỉ chặn kiểu dữ liệu và giá trị vô lý. */
const recordedActionSchema: z.ZodType<RecordedGameAction> = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("PLACE_PIECE"),
    slot: z.union([z.number().int().min(0).max(TRAY_SIZE - 1), z.literal(STASH_SLOT)]),
    row: boardIndex,
    col: boardIndex,
  }),
  z.object({ type: z.literal("STASH_PIECE"), slot: z.number().int().min(0).max(TRAY_SIZE - 1) }),
  z.object({ type: z.literal("REPLACE_TRAY") }),
  z.object({ type: z.literal("REVIVE") }),
])

/** Firestore auto-ID: 20 ký tự chữ/số. */
export const gameIdSchema = z.string().regex(/^[A-Za-z0-9]{20}$/)

export const startRankedGameRequestSchema = z.object({
  mode: z.enum(["classic", "daily", "challenge", "event", "level", "duel"]).default("classic"),
  stashUnlocked: z.boolean().default(false),
  challengeId: z.string().regex(CHALLENGE_ID_PATTERN).optional(),
  levelId: z.number().int().min(1).max(LEVEL_COUNT).optional(),
  duelId: z.string().regex(DUEL_ID_PATTERN).optional(),
})

export const submitRankedGameRequestSchema = z.object({
  gameId: gameIdSchema,
  actions: z.array(recordedActionSchema).max(MAX_RECORDED_ACTIONS),
})

/** MAX_RECORDED_ACTIONS (10.000) × ~50 byte JSON ≈ 500KB, cộng phần dư. */
export const MAX_REQUEST_BODY_BYTES = 640 * 1024
