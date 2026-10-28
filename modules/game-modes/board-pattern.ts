import { BOARD_CELL_COUNT, BOARD_SIZE, type BoardCells } from "@/modules/block-puzzle/engine/game-types"

/** Màu của ô dựng sẵn (đá) — một màu cố định để nhìn ra là chướng ngại; xoá được như khối thường. */
export const STONE_COLOR_ID = 8

/**
 * Bàn từ 8 dòng chữ: "#" = đá, "." = trống. Viết màn/sự kiện bằng hình vẽ dễ đọc hơn mảng số.
 * Sai kích thước → throw ngay lúc nạp module (lỗi soạn catalog, không phải lỗi người chơi).
 */
export function boardFromPattern(rows: readonly string[]): BoardCells {
  if (rows.length !== BOARD_SIZE || rows.some((row) => row.length !== BOARD_SIZE)) throw new Error("Board pattern must be 8×8")
  const cells = rows.flatMap((row) => [...row].map((char) => (char === "#" ? STONE_COLOR_ID : 0)))
  if (cells.length !== BOARD_CELL_COUNT) throw new Error("Board pattern must be 8×8")
  return cells
}

/** Có hàng/cột nào đầy sẵn không (đầy sẵn = nước đầu được xoá miễn phí → catalog không được có). */
export function hasFullLine(board: BoardCells): boolean {
  for (let line = 0; line < BOARD_SIZE; line++) {
    let rowFull = true
    let colFull = true
    for (let i = 0; i < BOARD_SIZE; i++) {
      rowFull &&= board[line * BOARD_SIZE + i] !== 0
      colFull &&= board[i * BOARD_SIZE + line] !== 0
    }
    if (rowFull || colFull) return true
  }
  return false
}
