import { countIsolatedHoles } from "./board-heuristics"
import type { GameState, GameVariant } from "./game-types"
import { createNewGame, gameReducer } from "./game-state-reducer"
import { findShape } from "./piece-shape-catalog"
import { listPlacements, simulatePlacement } from "./tray-solvability-search"

/**
 * Bot tự chơi để đo cân bằng sau khi chỉnh `tray-generator-config.ts` / `score-and-combo-rules.ts`.
 * Bot tham lam, không phải người chơi giỏi nhất — chỉ dùng để so sánh trước/sau khi đổi số.
 */

/** Nước tốt nhất theo heuristic: xoá nhiều dòng, ít lỗ kín, bàn trống nhiều. */
export function chooseMove(game: GameState): { slot: number; row: number; col: number } | null {
  let best: { slot: number; row: number; col: number; value: number } | null = null
  game.tray.forEach((piece, slot) => {
    const shape = piece && findShape(piece.shapeId)
    if (!shape) return
    for (const { row, col } of listPlacements(game.board, shape)) {
      const result = simulatePlacement(game.board, shape, row, col)
      const filled = result.board.filter(Boolean).length
      const value = result.linesCleared * 100 - countIsolatedHoles(result.board) * 12 - filled
      if (!best || value > best.value) best = { slot, row, col, value }
    }
  })
  return best
}

export interface BalanceReport {
  games: number
  averageScore: number
  medianScore: number
  averageMoves: number
  /** Tỉ lệ nước có xoá dòng. */
  clearRate: number
  /** Tỉ lệ nước xoá dòng khi combo ≥ 2. */
  comboRate: number
  boardClears: number
  /** Số ván chạm `maxMoves` (bot chơi mãi không thua → luật quá dễ). */
  cappedGames: number
}

export function simulateGames({ games = 200, seed = 1, maxMoves = 600, variant }: { games?: number; seed?: number; maxMoves?: number; variant?: GameVariant } = {}): BalanceReport {
  const scores: number[] = []
  let moves = 0, clears = 0, combos = 0, boardClears = 0, cappedGames = 0
  for (let index = 0; index < games; index++) {
    let game = createNewGame(seed + index * 7919, variant)
    let gameMoves = 0
    while (!game.isGameOver && gameMoves < maxMoves) {
      const move = chooseMove(game)
      if (!move) break
      game = gameReducer(game, { type: "PLACE_PIECE", ...move })
      gameMoves++
      const last = game.lastMove!
      if (last.clearedCells.length) clears++
      if (last.clearedCells.length && last.combo >= 2) combos++
      if (last.boardCleared) boardClears++
    }
    if (gameMoves >= maxMoves) cappedGames++
    moves += gameMoves
    scores.push(game.score)
  }
  scores.sort((a, b) => a - b)
  return {
    games,
    averageScore: Math.round(scores.reduce((sum, value) => sum + value, 0) / games),
    medianScore: scores[Math.floor(games / 2)],
    averageMoves: Math.round(moves / games),
    clearRate: Number((clears / Math.max(1, moves)).toFixed(3)),
    comboRate: Number((combos / Math.max(1, moves)).toFixed(3)),
    boardClears,
    cappedGames,
  }
}
