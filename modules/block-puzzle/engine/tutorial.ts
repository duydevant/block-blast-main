import { cellIndex, clearLines, createEmptyBoard, findFullLines, isBoardEmpty, placeCells } from "./board-grid-operations"
import { BOARD_SIZE, type GameState, type MoveResult } from "./game-types"
import { findShape } from "./piece-shape-catalog"
import { scoreForMove } from "./score-and-combo-rules"

export type TutorialStage = 1 | 2 | 3

interface TutorialStageDef {
  /** Ô đã lấp sẵn (row, col). */
  filled: [number, number][]
  shapeId: string
  colorId: number
  /** Góc trên-trái nơi phải đặt khối. */
  target: { row: number; col: number }
}

const FILLER_COLOR = 6
const fullRowExcept = (row: number, skip: number[]) =>
  Array.from({ length: BOARD_SIZE }, (_, col) => col).filter((col) => !skip.includes(col)).map((col) => [row, col] as [number, number])
const fullColExcept = (col: number, skip: number[]) =>
  Array.from({ length: BOARD_SIZE }, (_, row) => row).filter((row) => !skip.includes(row)).map((row) => [row, col] as [number, number])

/** 3 bài: xoá 1 hàng → xoá hàng + cột cùng lúc → xoá 2 hàng một nước. */
const STAGES: Record<TutorialStage, TutorialStageDef> = {
  1: { filled: fullRowExcept(4, [3, 4]), shapeId: "line2-r0", colorId: 5, target: { row: 4, col: 3 } },
  2: { filled: [...fullRowExcept(5, [2, 3]), ...fullColExcept(2, [4, 5])], shapeId: "corner3-r0", colorId: 2, target: { row: 4, col: 2 } },
  3: { filled: [...fullRowExcept(6, [0, 1]), ...fullRowExcept(7, [0, 1])], shapeId: "square2", colorId: 4, target: { row: 6, col: 0 } },
}

export const TUTORIAL_SLOT = 1

export function tutorialTarget(stage: TutorialStage) {
  return STAGES[stage].target
}

/** State tạm cho tutorial — không đụng tới save của ván thật. */
export function createTutorialStage(stage: TutorialStage, score = 0): GameState {
  const def = STAGES[stage]
  const board = createEmptyBoard()
  for (const [row, col] of def.filled) board[cellIndex(row, col)] = FILLER_COLOR
  const tray = [null, { uid: stage, shapeId: def.shapeId, colorId: def.colorId }, null]
  return { board, tray, score, combo: stage - 1, movesSinceClear: 0, moveCount: stage - 1, isGameOver: false,
    rngState: 1, nextPieceUid: 4, stash: null, stashUnlocked: false, lastMove: null }
}

/** Chỉ chấp nhận đúng khối hướng dẫn tại đúng ô đích; sai thì trả null để UI báo thả lỗi. */
export function placeTutorialPiece(stage: TutorialStage, game: GameState, slot: number, row: number, col: number): GameState | null {
  const { target } = STAGES[stage]
  const piece = game.tray[TUTORIAL_SLOT]
  const shape = piece && findShape(piece.shapeId)
  if (slot !== TUTORIAL_SLOT || row !== target.row || col !== target.col || !piece || !shape) return null
  const placed = placeCells(game.board, shape, row, col, piece.colorId)
  const lines = findFullLines(placed.board)
  const cleared = clearLines(placed.board, lines.rows, lines.cols)
  const linesCleared = lines.rows.length + lines.cols.length
  const boardCleared = linesCleared > 0 && isBoardEmpty(cleared.board)
  const points = scoreForMove({ placedCellCount: shape.cells.length, linesCleared, combo: stage, boardCleared })
  const lastMove: MoveResult = { colorId: piece.colorId, placedCells: placed.placedCells, clearedRows: lines.rows, clearedCols: lines.cols,
    clearedCells: cleared.clearedCells, combo: stage, points, boardCleared }
  return { ...game, board: cleared.board, tray: [null, null, null], score: game.score + points, combo: stage, moveCount: stage, lastMove }
}
