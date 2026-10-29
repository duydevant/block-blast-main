import { canPlace, clearLines, createEmptyBoard, findFullLines, isBoardEmpty, placeCells } from "./board-grid-operations"
import { STASH_SLOT, type BoardCells, type GameAction, type GameState, type GameVariant, type MoveResult, type TraySlots } from "./game-types"
import { hasAnyMove } from "./move-availability"
import { findShape } from "./piece-shape-catalog"
import { dealOpeningTray } from "./opening-tray-generator"
import { dealTray } from "./piece-tray-generator"
import { isStashUnlocked, POWER_UP_RULES, replaceTray, revive, stashPiece } from "./power-up-rules"
import { nextComboState, scoreForMove } from "./score-and-combo-rules"
import { normalizeSeed } from "./seeded-random-generator"

export { hasAnyMove, STASH_SLOT }


/** Đã dùng hết số nước của màn (chế độ có giới hạn nước). */
export function isOutOfMoves(state: Pick<GameState, "moveLimit" | "moveCount">): boolean {
  return state.moveLimit !== undefined && state.moveCount >= state.moveLimit
}

/** Hết ván: hết nước của màn, hoặc không khối nào (kể cả khối cất) còn chỗ đặt. */
function computeGameOver(state: Pick<GameState, "moveLimit" | "moveCount" | "endedEarly">, board: BoardCells, tray: TraySlots, stash: GameState["stash"]): boolean {
  return Boolean(state.endedEarly) || isOutOfMoves(state) || !hasAnyMove(board, tray, stash)
}

export function createNewGame(seed: number, variant: GameVariant = {}): GameState {
  const board = variant.startBoard ? [...variant.startBoard] : createEmptyBoard()
  // Ván thường bàn trống → khay mở đầu ngẫu nhiên "nổ to". Màn chơi (thiết kế + kiểm theo seed) và bàn dựng sẵn
  // → bộ chia thông minh theo bàn như cũ.
  const opening = variant.moveLimit === undefined && isBoardEmpty(board)
  const deal = opening ? dealOpeningTray(normalizeSeed(seed), 1) : dealTray(board, 0, normalizeSeed(seed), 1)
  return {
    board,
    tray: deal.tray,
    score: 0,
    combo: 0,
    movesSinceClear: 0,
    moveCount: 0,
    isGameOver: false,
    rngState: deal.rngState,
    nextPieceUid: deal.nextPieceUid,
    generatorState: deal.generatorState,
    stash: null,
    stashUnlocked: false,
    replaceCharges: variant.noPowerUps ? 0 : (variant.replaceCharges ?? POWER_UP_RULES.replaceChargesPerGame),
    reviveUsed: variant.noRevive ?? false,
    ...(variant.noPowerUps ? { noPowerUps: true } : {}),
    ...(variant.moveLimit !== undefined ? { moveLimit: variant.moveLimit } : {}),
    linesCleared: 0,
    lastMove: null,
  }
}

function applyPlacement(state: GameState, slot: number, row: number, col: number): GameState {
  if (state.isGameOver) return state
  const piece = slot === STASH_SLOT ? state.stash : state.tray[slot]
  const shape = piece && findShape(piece.shapeId)
  if (!piece || !shape || !canPlace(state.board, shape, row, col)) return state

  const placed = placeCells(state.board, shape, row, col, piece.colorId)
  const lines = findFullLines(placed.board)
  const cleared = clearLines(placed.board, lines.rows, lines.cols)
  const linesCleared = lines.rows.length + lines.cols.length
  const boardCleared = linesCleared > 0 && isBoardEmpty(cleared.board)
  const comboState = nextComboState(state, linesCleared)
  const points = scoreForMove({ placedCellCount: placed.placedCells.length, linesCleared, combo: comboState.combo, boardCleared })
  const score = state.score + points

  let tray: TraySlots = state.tray.map((item, index) => (index === slot ? null : item))
  const stash = slot === STASH_SLOT ? null : (state.stash ?? null)
  let { rngState, nextPieceUid, generatorState } = state
  if (tray.every((item) => item === null)) {
    const deal = dealTray(cleared.board, score, rngState, nextPieceUid, generatorState, stash)
    ;({ tray, rngState, nextPieceUid, generatorState } = deal)
  }

  const lastMove: MoveResult = {
    colorId: piece.colorId,
    placedCells: placed.placedCells,
    clearedRows: lines.rows,
    clearedCols: lines.cols,
    clearedCells: cleared.clearedCells,
    points,
    combo: comboState.combo,
    boardCleared,
  }

  const next: GameState = {
    ...state,
    board: cleared.board,
    tray,
    score,
    combo: comboState.combo,
    movesSinceClear: comboState.movesSinceClear,
    moveCount: state.moveCount + 1,
    linesCleared: (state.linesCleared ?? 0) + linesCleared,
    isGameOver: computeGameOver({ moveLimit: state.moveLimit, moveCount: state.moveCount + 1 }, cleared.board, tray, stash),
    stash,
    rngState,
    nextPieceUid,
    generatorState,
    lastMove,
  }
  return { ...next, stashUnlocked: isStashUnlocked(next) }
}

/**
 * Chuẩn hoá state khôi phục từ save (đã qua validate kiểu dữ liệu): xoá dòng đầy sẵn không tính điểm,
 * chia lại khay rỗng, sửa uid, bỏ lastMove để không phát lại hiệu ứng, tính lại game over.
 */
export function normalizeRestoredState(state: GameState): GameState {
  const lines = findFullLines(state.board)
  const board = clearLines(state.board, lines.rows, lines.cols).board
  const maxUid = Math.max(state.stash?.uid ?? 0, ...state.tray.map((piece) => piece?.uid ?? 0))
  let nextPieceUid = Math.max(state.nextPieceUid, maxUid + 1)
  let { tray, rngState, generatorState } = state

  if (tray.every((piece) => piece === null)) {
    const deal = dealTray(board, state.score, rngState, nextPieceUid, generatorState, state.stash)
    ;({ tray, rngState, nextPieceUid, generatorState } = deal)
  }

  return { ...state, board, tray, rngState, nextPieceUid, generatorState, lastMove: null,
    stashUnlocked: isStashUnlocked(state), isGameOver: computeGameOver(state, board, tray, state.stash) }
}

/** Reducer thuần: nước đi không hợp lệ trả lại đúng tham chiếu state cũ. */
export function gameReducer(state: GameState, action: GameAction): GameState {
  switch (action.type) {
    case "NEW_GAME":
      return createNewGame(action.seed)
    case "RESTORE":
      return normalizeRestoredState(action.state)
    case "PLACE_PIECE":
      return applyPlacement(state, action.slot, action.row, action.col)
    case "STASH_PIECE":
      return stashPiece(state, action.slot)
    case "REPLACE_TRAY":
      return replaceTray(state)
    case "REVIVE":
      return revive(state)
    default: {
      const unknownAction: never = action
      void unknownAction
      return state
    }
  }
}
