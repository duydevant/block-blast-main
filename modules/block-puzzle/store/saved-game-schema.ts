import { z } from "zod"

import { BLOCK_COLOR_COUNT, BOARD_CELL_COUNT, TRAY_SIZE, type GameState } from "../engine/game-types"
import { findShape } from "../engine/piece-shape-catalog"
import { POWER_UP_RULES } from "../engine/power-up-rules"
import { PERFECT_CLEAR_CHAIN_RULES } from "../engine/score-and-combo-rules"
import { INITIAL_GENERATOR_STATE } from "../engine/piece-tray-generator"

const nonNegativeInt = z.number().int().nonnegative()

const trayPieceSchema = z.object({
  uid: nonNegativeInt,
  shapeId: z.string().refine((id) => findShape(id) !== undefined, "unknown shape"),
  colorId: z.number().int().min(1).max(BLOCK_COLOR_COUNT),
})

/** Chỉ số ván chỉ để hiển thị/thống kê (server tự replay) → hỏng thì bỏ, không bỏ cả ván. */
const runStatsSchema = z.object({
  clearMoves: nonNegativeInt,
  multiClears: z.tuple([nonNegativeInt, nonNegativeInt, nonNegativeInt]),
  maxLinesInMove: nonNegativeInt.max(16),
  bestCombo: nonNegativeInt,
  boardClears: nonNegativeInt,
  stashUses: nonNegativeInt,
  replaceUses: nonNegativeInt,
  reviveUsed: z.boolean(),
})

/** localStorage do người dùng kiểm soát → validate chặt trước khi RESTORE. */
const gameStateSchema = z.object({
  board: z.array(z.number().int().min(0).max(BLOCK_COLOR_COUNT)).length(BOARD_CELL_COUNT),
  tray: z.array(trayPieceSchema.nullable()).length(TRAY_SIZE),
  score: nonNegativeInt.max(Number.MAX_SAFE_INTEGER),
  combo: nonNegativeInt,
  movesSinceClear: nonNegativeInt,
  moveCount: nonNegativeInt,
  isGameOver: z.boolean(),
  rngState: z.number().int().min(0).max(0xffffffff),
  nextPieceUid: nonNegativeInt,
  stash: trayPieceSchema.nullable().optional(),
  stashUnlocked: z.boolean().optional(),
  // Biến thể có thể cho số lượt đổi khác mặc định.
  replaceCharges: nonNegativeInt.max(POWER_UP_RULES.replaceChargesPerGame * 5).optional(),
  reviveUsed: z.boolean().optional(),
  moveLimit: z.number().int().min(1).max(1000).optional(),
  endedEarly: z.boolean().optional(),
  noPowerUps: z.boolean().optional(),
  guaranteedTray: z.boolean().optional(),
  // Bài học: khay cố định còn lại (shapeId phải có trong catalog).
  fixedTrays: z
    .array(z.array(z.string().refine((id) => findShape(id) !== undefined, "unknown shape")).min(1).max(TRAY_SIZE))
    .max(32)
    .optional(),
  linesCleared: nonNegativeInt.optional(),
  runStats: runStatsSchema.optional().catch(undefined),
  // Luật v2 (chuỗi dọn sạch bàn + bộ chia theo điểm). Mất field này thì ván chơi tiếp theo luật khác → replay lệch.
  rulesVersion: z.literal(2).optional(),
  perfectChain: nonNegativeInt.max(10_000).optional(),
  movesSinceBoardClear: nonNegativeInt.max(PERFECT_CLEAR_CHAIN_RULES.chainWindowMoves + 1).optional(),
  generatorState: z.union([
    z.object({
      stepsBeforeSmart: z.number().int().min(-1).max(4),
      poolIndices: z.array(z.number().int().min(1).max(11)).max(10),
      currentPool: z.array(z.number().int().min(0).max(59)).max(21),
    }),
    // Keep existing v3 games; the retired weighted dealer's memory starts a fresh cycle.
    z.object({ recentFamilies: z.array(z.string().max(32)).max(TRAY_SIZE * 4) })
      .transform(() => ({ ...INITIAL_GENERATOR_STATE, poolIndices: [], currentPool: [] })),
  ]).optional(),
})

const bestScoreSchema = nonNegativeInt.max(Number.MAX_SAFE_INTEGER)

export interface SavedGame {
  game: GameState | null
  best: number
}

/**
 * Parse từng phần độc lập: ván hỏng không làm mất kỷ lục và ngược lại.
 * Phần không hợp lệ trả về mặc định (game = null, best = 0). `lastMove` không bao giờ được khôi phục.
 */
export function parseSavedGame(value: unknown): SavedGame {
  const record = typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {}
  const game = gameStateSchema.safeParse(record.game)
  const best = bestScoreSchema.safeParse(record.best)
  return {
    game: game.success ? { ...game.data, lastMove: null } : null,
    best: best.success ? best.data : 0,
  }
}
