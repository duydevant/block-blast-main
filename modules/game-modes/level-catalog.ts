import type { GameState, GameVariant } from "@/modules/block-puzzle/engine/game-types"

import { BOARD_PATTERNS, type BoardPatternId } from "./board-patterns"

/** Mục tiêu đơn điệu (chỉ tăng) → đạt rồi là giữ, server chỉ cần xem trạng thái cuối ván. */
export type LevelGoalKind = "score" | "lines"

export interface LevelDefinition {
  id: number
  pattern: BoardPatternId
  goal: { kind: LevelGoalKind; target: number }
  /** Seed cố định: mọi người gặp cùng chuỗi khối (màn là một câu đố, không phải may rủi). */
  seed: number
  moveLimit: number
}

const level = (id: number, pattern: BoardPatternId, kind: LevelGoalKind, target: number, seed: number, moveLimit: number): LevelDefinition => ({
  id,
  pattern,
  goal: { kind, target },
  seed,
  moveLimit,
})

/**
 * Seed + giới hạn nước được chọn bằng bot (`chooseMove`): bot đạt mục tiêu với ~70% số nước cho phép,
 * test `level-catalog.test.ts` chạy lại bot để đảm bảo màn nào cũng giải được.
 */
export const LEVELS: readonly LevelDefinition[] = [
  level(1, "empty", "lines", 3, 7001, 8),
  level(2, "empty", "score", 250, 7998, 29),
  level(3, "corners", "lines", 5, 8996, 16),
  level(4, "centerBlock", "score", 400, 9992, 42),
  level(5, "empty", "lines", 8, 10989, 33),
  level(6, "cross", "lines", 6, 11986, 19),
  level(7, "stairs", "score", 600, 12983, 37),
  level(8, "pillars", "lines", 8, 13980, 30),
  level(9, "frame", "score", 700, 14984, 50),
  level(10, "diagonal", "lines", 10, 15974, 37),
  level(11, "checker", "score", 900, 16974, 54),
  level(12, "bottomHeavy", "lines", 10, 17969, 30),
  level(13, "twinBars", "score", 1000, 18967, 81),
  level(14, "ring", "lines", 12, 19962, 46),
  level(15, "corners", "score", 1200, 20979, 58),
  level(16, "cross", "lines", 14, 21957, 36),
  level(17, "pillars", "score", 1400, 22955, 92),
  level(18, "stairs", "lines", 16, 23952, 50),
  level(19, "ring", "score", 1600, 24950, 93),
  level(20, "checker", "lines", 20, 25946, 56),
]

export const LEVEL_COUNT = LEVELS.length

export function findLevel(id: number): LevelDefinition | undefined {
  return LEVELS[id - 1]?.id === id ? LEVELS[id - 1] : undefined
}

export function levelVariant(definition: LevelDefinition): GameVariant {
  return { startBoard: BOARD_PATTERNS[definition.pattern], moveLimit: definition.moveLimit }
}

/** Tiến độ mục tiêu của ván hiện tại. */
export function levelGoalProgress(definition: LevelDefinition, game: Pick<GameState, "score" | "linesCleared">): number {
  return definition.goal.kind === "score" ? game.score : (game.linesCleared ?? 0)
}

export function isLevelGoalMet(definition: LevelDefinition, game: Pick<GameState, "score" | "linesCleared">): boolean {
  return levelGoalProgress(definition, game) >= definition.goal.target
}

export type LevelStars = 0 | 1 | 2 | 3

/** Qua màn = 1 sao; dùng ≤ 80% số nước = 2 sao; ≤ 60% = 3 sao. */
export function starsForLevel(definition: LevelDefinition, game: Pick<GameState, "score" | "linesCleared" | "moveCount">): LevelStars {
  if (!isLevelGoalMet(definition, game) || game.moveCount > definition.moveLimit) return 0
  const used = game.moveCount / definition.moveLimit
  return used <= 0.6 ? 3 : used <= 0.8 ? 2 : 1
}

/** Màn mở khi đã qua màn trước (màn 1 luôn mở). */
export function isLevelUnlocked(id: number, stars: Readonly<Record<string, number>>): boolean {
  return id === 1 || (stars[String(id - 1)] ?? 0) > 0
}

/** Xu thưởng cho mỗi sao **mới** đạt được ở một màn (lần đầu qua màn 1 sao = 20 xu...). */
export const COINS_PER_LEVEL_STAR = 20
