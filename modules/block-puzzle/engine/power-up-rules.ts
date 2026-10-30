import { BOARD_SIZE, type BoardCells, type GameState } from "./game-types"
import { hasAnyMove } from "./move-availability"
import { dealTrayForState } from "./deal-tray-for-state"

export const POWER_UP_RULES = {
  /** Ô cất khối mở khi điểm đạt mốc này. Store giữ trạng thái đã mở cho các ván sau (reducer NEW_GAME thì không). */
  stashUnlockScore: 300,
  /** Số lượt đổi khay mỗi ván mới. */
  replaceChargesPerGame: 2,
  /** Hồi sinh (1 lần/ván) xoá bấy nhiêu hàng và cột đầy nhất. */
  reviveRows: 2,
  reviveCols: 2,
} as const

export function isStashUnlocked(state: GameState): boolean {
  if (state.noPowerUps) return false
  return Boolean(state.stashUnlocked) || state.score >= POWER_UP_RULES.stashUnlockScore
}

/** Cất một khối từ khay. Cất khối cuối cùng thì khay được chia lại ngay. */
export function stashPiece(state: GameState, slot: number): GameState {
  if (state.isGameOver || !isStashUnlocked(state) || state.stash) return state
  const piece = state.tray[slot]
  if (!piece) return state
  const tray = state.tray.map((item, index) => (index === slot ? null : item))
  const deal = tray.every((item) => item === null)
    ? dealTrayForState(state, state.board, state.score, piece)
    : { tray, rngState: state.rngState, nextPieceUid: state.nextPieceUid, generatorState: state.generatorState }
  return { ...state, ...deal, stash: piece, stashUnlocked: true, lastMove: null, isGameOver: !hasAnyMove(state.board, deal.tray, piece) }
}

/** Đổi cả khay lấy 3 khối mới, tốn một lượt. */
export function replaceTray(state: GameState): GameState {
  const charges = state.replaceCharges ?? POWER_UP_RULES.replaceChargesPerGame
  if (state.isGameOver || state.noPowerUps || charges <= 0) return state
  const deal = dealTrayForState(state, state.board, state.score, state.stash)
  return { ...state, ...deal, replaceCharges: charges - 1, lastMove: null, isGameOver: !hasAnyMove(state.board, deal.tray, state.stash) }
}

/** Chỉ số các dòng đầy nhất (hoà thì dòng gần giữa bàn trước). */
function fullestLines(board: BoardCells, count: number, isRow: boolean): number[] {
  const filled = (line: number) => {
    let total = 0
    for (let i = 0; i < BOARD_SIZE; i++) if (board[isRow ? line * BOARD_SIZE + i : i * BOARD_SIZE + line]) total++
    return total
  }
  const center = (BOARD_SIZE - 1) / 2
  return Array.from({ length: BOARD_SIZE }, (_, line) => line)
    .sort((a, b) => filled(b) - filled(a) || Math.abs(a - center) - Math.abs(b - center) || a - b)
    .slice(0, count)
}

/** Hồi sinh một lần mỗi ván: dọn các hàng/cột đầy nhất (không tính điểm) rồi chia khay mới. */
export function revive(state: GameState): GameState {
  // Màn chơi (có giới hạn nước) không có hồi sinh: thua thì chơi lại màn.
  if (!state.isGameOver || state.reviveUsed || state.moveLimit !== undefined) return state
  const rows = new Set(fullestLines(state.board, POWER_UP_RULES.reviveRows, true))
  const cols = new Set(fullestLines(state.board, POWER_UP_RULES.reviveCols, false))
  const board = state.board.map((cell, index) => (rows.has(Math.floor(index / BOARD_SIZE)) || cols.has(index % BOARD_SIZE) ? 0 : cell))
  const deal = dealTrayForState(state, board, state.score, state.stash)
  return { ...state, ...deal, board, reviveUsed: true, combo: 0, movesSinceClear: 0, lastMove: null,
    isGameOver: !hasAnyMove(board, deal.tray, state.stash) }
}
