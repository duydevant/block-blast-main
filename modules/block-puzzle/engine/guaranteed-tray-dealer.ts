import type { BoardCells, TrayGeneratorState, TrayPiece } from "./game-types"
import { findShape } from "./piece-shape-catalog"
import { dealTray, type DealResult, INITIAL_GENERATOR_STATE } from "./piece-tray-generator"
import { canPlaceAllInSomeOrder } from "./tray-solvability-search"

/**
 * Chế độ "Không bế tắc" (≈ No-Guessing của Minesweeper): mọi khay chia ra đều có ít nhất một thứ tự + vị trí
 * đặt hết cả 3 khối. Thua vẫn có thể xảy ra — do đặt sai, không do khay xấu.
 */
export const GUARANTEED_TRAY_RULES = {
  /** Số lần chia lại bằng bộ chia thường trước khi ép bộ chọn theo bàn (smart). */
  attempts: 4,
  /** Ngân sách tìm kiếm mỗi lần kiểm khay (giống bộ phân tích). Hết ngân sách → coi như đặt được. */
  searchBudget: 6000,
} as const

const shapesOf = (tray: readonly TrayPiece[]) => tray.map((piece) => findShape(piece.shapeId)!)

/**
 * Chia như bộ chia Classic, kiểm khay; khay vô nghiệm thì chia lại (rng + túi tiến tiếp → tất định theo seed).
 * Sau `attempts` lần vẫn vô nghiệm → ép lượt smart (chọn tuần tự theo bàn, có mô phỏng xoá dòng).
 */
export function dealGuaranteedTray(
  board: BoardCells,
  score: number,
  rngState: number,
  nextPieceUid: number,
  previous: TrayGeneratorState = INITIAL_GENERATOR_STATE,
  stash: TrayPiece | null = null
): DealResult {
  let deal = dealTray(board, score, rngState, nextPieceUid, previous, stash)
  for (let attempt = 1; ; attempt++) {
    if (canPlaceAllInSomeOrder(board, shapesOf(deal.tray), GUARANTEED_TRAY_RULES.searchBudget) !== false) return deal
    if (attempt >= GUARANTEED_TRAY_RULES.attempts) break
    deal = dealTray(board, score, deal.rngState, nextPieceUid, deal.generatorState, stash)
  }
  return dealTray(board, score, deal.rngState, nextPieceUid, { ...deal.generatorState, stepsBeforeSmart: 2 }, stash)
}
