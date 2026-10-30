import { z } from "zod"

import { CHALLENGE_ID_PATTERN } from "@/modules/challenge/challenge-types"
import { DUEL_ID_PATTERN } from "@/modules/duel/duel-types"
import { LEVEL_COUNT } from "@/modules/game-modes/level-catalog"
import { recordedActionSchema } from "@/modules/block-puzzle/engine/recorded-action-schema"
import { MAX_RECORDED_ACTIONS } from "@/modules/block-puzzle/engine/replay-recorded-game-actions"

/** Firestore auto-ID: 20 ký tự chữ/số. */
export const gameIdSchema = z.string().regex(/^[A-Za-z0-9]{20}$/)

export const startRankedGameRequestSchema = z.object({
  mode: z.enum(["classic", "daily", "challenge", "level", "duel", "logic", "arena"]).default("classic"),
  stashUnlocked: z.boolean().default(false),
  challengeId: z.string().regex(CHALLENGE_ID_PATTERN).optional(),
  levelId: z.number().int().min(1).max(LEVEL_COUNT).optional(),
  duelId: z.string().regex(DUEL_ID_PATTERN).optional(),
  arenaRunId: z.string().regex(/^[A-Za-z0-9]{20}$/).optional(),
  /** Luật cao nhất client chơi được (JS cũ không gửi = v1) — server không cấp ván luật mới cho client cũ. */
  rulesVersion: z.literal(2).optional().catch(undefined),
})

/** POST /api/ranked/match: body tuỳ chọn (client cũ không gửi body). */
export const startRankedMatchRequestSchema = z.object({
  rulesVersion: z.literal(2).optional().catch(undefined),
})

export const submitRankedGameRequestSchema = z.object({
  gameId: gameIdSchema,
  actions: z.array(recordedActionSchema).max(MAX_RECORDED_ACTIONS),
  /** Thời điểm từng nước (epoch ms) — chỉ để phát hiện bot / phát lại theo nhịp; sai dạng thì bỏ, không từ chối ván. */
  times: z.array(z.number().finite().nonnegative()).max(MAX_RECORDED_ACTIONS).optional().catch(undefined),
})

/** MAX_RECORDED_ACTIONS (10.000) × ~65 byte JSON (kèm `t` + mảng times) ≈ 650KB, cộng phần dư. */
export const MAX_REQUEST_BODY_BYTES = 800 * 1024
