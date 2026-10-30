import type { GameVariant } from "@/modules/block-puzzle/engine/game-types"
import type { PlayerTierId } from "@/modules/progression/player-form-rules"

import { BOARD_PATTERNS, type BoardPatternId } from "./board-patterns"

/**
 * Đấu trường (Arena-lite, giống Arena của Minesweeper): 5 loại × 5 cấp. Trả xu để mở một lượt; lượt có số lần thử và
 * hạn giờ; đạt mục tiêu → thưởng. Cấp cao cần Bậc kỹ năng. Điểm Đấu trường = tổng cấp cao nhất đã qua của mỗi loại
 * (tối đa 25), không cộng dồn mỗi lần chơi. Biến thể luôn suy từ catalog theo session — client không gửi biến thể.
 * Số liệu là đề xuất ban đầu — chỉnh bằng `npm run arena-balance`.
 */
export const ARENA_TYPES = ["speed", "pure", "obstacle", "combo", "endurance"] as const
export type ArenaType = (typeof ARENA_TYPES)[number]
export const ARENA_LEVEL_COUNT = 5
export const MAX_ARENA_POINTS = ARENA_TYPES.length * ARENA_LEVEL_COUNT

export type ArenaGoal = { kind: "score"; target: number } | { kind: "lines"; target: number } | { kind: "combo"; target: number }

export interface ArenaLevelDefinition {
  type: ArenaType
  /** 1..5 */
  level: number
  entryCoins: number
  rewardCoins: number
  rewardXp: number
  /** Bậc tối thiểu để mở cấp này (null = ai cũng mở được). */
  requiredTier: PlayerTierId | null
  goal: ArenaGoal
  /** Đồng hồ mỗi lần thử (chỉ loại Tốc độ). */
  attemptTimeMs: number | null
  /** Số lần thử của lượt (Bền bỉ: số ván phải đạt liên tiếp). */
  attempts: number
  /** Hạn của cả lượt kể từ lúc mở. */
  windowMs: number
  variant: GameVariant
}

const MINUTE = 60_000
const ENTRY = [30, 60, 100, 180, 300]
const REWARD = [75, 150, 250, 450, 750]
const XP = [40, 80, 120, 160, 200]
const REQUIRED_TIER: (PlayerTierId | null)[] = [null, null, "gold", "platinum", "diamond"]
const OBSTACLE_BOARDS: BoardPatternId[] = ["cross", "pillars", "ring", "checker", "frame"]
const OBSTACLE_MOVES = [25, 30, 35, 40, 45]

type LevelSpec = Pick<ArenaLevelDefinition, "goal" | "attemptTimeMs" | "attempts" | "windowMs" | "variant">

/** Thông số theo loại, `index` = cấp − 1. */
const SPECS: Record<ArenaType, (index: number) => LevelSpec> = {
  speed: (index) => ({
    goal: { kind: "score", target: [800, 1500, 2500, 3500, 5000][index] },
    attemptTimeMs: [2, 2, 3, 3, 4][index] * MINUTE,
    attempts: 3,
    windowMs: 30 * MINUTE,
    variant: {},
  }),
  pure: (index) => ({
    goal: { kind: "score", target: [800, 1500, 2500, 4000, 6000][index] },
    attemptTimeMs: null,
    attempts: 3,
    windowMs: 60 * MINUTE,
    variant: { noPowerUps: true, noRevive: true },
  }),
  obstacle: (index) => ({
    goal: { kind: "lines", target: [6, 8, 12, 15, 18][index] },
    attemptTimeMs: null,
    attempts: 3,
    windowMs: 60 * MINUTE,
    variant: { startBoard: BOARD_PATTERNS[OBSTACLE_BOARDS[index]], moveLimit: OBSTACLE_MOVES[index] },
  }),
  combo: (index) => ({
    goal: { kind: "combo", target: [6, 9, 13, 17, 22][index] },
    attemptTimeMs: null,
    attempts: 3,
    windowMs: 60 * MINUTE,
    variant: {},
  }),
  endurance: (index) => ({
    goal: { kind: "score", target: [600, 800, 1200, 1800, 2500][index] },
    attemptTimeMs: null,
    attempts: [3, 3, 3, 4, 4][index],
    windowMs: 24 * 60 * MINUTE,
    variant: {},
  }),
}

export function findArenaLevel(type: string, level: number): ArenaLevelDefinition | undefined {
  if (!(ARENA_TYPES as readonly string[]).includes(type) || !Number.isInteger(level) || level < 1 || level > ARENA_LEVEL_COUNT) return undefined
  const index = level - 1
  return {
    type: type as ArenaType,
    level,
    entryCoins: ENTRY[index],
    rewardCoins: REWARD[index],
    rewardXp: XP[index],
    requiredTier: REQUIRED_TIER[index],
    ...SPECS[type as ArenaType](index),
  }
}

/** Điểm Đấu trường từ map loại → cấp cao nhất đã qua. */
export function arenaPoints(levels: Readonly<Record<string, number>>): number {
  return ARENA_TYPES.reduce((sum, type) => sum + Math.min(ARENA_LEVEL_COUNT, levels[type] ?? 0), 0)
}
