import { z } from "zod"

import { CHALLENGE_ID_PATTERN } from "@/modules/challenge/challenge-types"
import { DUEL_ID_PATTERN } from "@/modules/duel/duel-types"
import { LEVEL_COUNT } from "@/modules/game-modes/level-catalog"
import { recordedActionSchema } from "@/modules/block-puzzle/engine/recorded-action-schema"
import { MAX_RECORDED_ACTIONS } from "@/modules/block-puzzle/engine/replay-recorded-game-actions"

/** Firestore auto-ID: 20 ký tự chữ/số. */
export const gameIdSchema = z.string().regex(/^[A-Za-z0-9]{20}$/)

export const startRankedGameRequestSchema = z.object({
  mode: z.enum(["classic", "daily", "challenge", "level", "duel"]).default("classic"),
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
