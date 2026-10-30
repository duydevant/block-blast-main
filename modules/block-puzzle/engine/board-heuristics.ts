import { BOARD_SIZE, type BoardCells } from "./game-types"

/** Ô trống bị bao kín 4 phía — càng nhiều càng khó đặt khối to (dùng cho bot cân bằng và phân tích sau ván). */
export function countIsolatedHoles(board: BoardCells): number {
  let holes = 0
  for (let row = 0; row < BOARD_SIZE; row++)
    for (let col = 0; col < BOARD_SIZE; col++) {
      if (board[row * BOARD_SIZE + col]) continue
      const blocked = [[row - 1, col], [row + 1, col], [row, col - 1], [row, col + 1]]
        .every(([r, c]) => r < 0 || c < 0 || r >= BOARD_SIZE || c >= BOARD_SIZE || board[r * BOARD_SIZE + c] !== 0)
      if (blocked) holes++
    }
  return holes
}
