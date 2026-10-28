import { BOARD_SIZE, type BoardCells, type ShapeDef } from "./game-types"

/**
 * Bàn dạng bitmask cho các vòng tìm kiếm nóng (bộ chia khối): mỗi hàng là 1 số 8 bit, bit c = cột c.
 * Nhanh hơn nhiều so với mảng 64 ô vì đặt/kiểm tra/xoá dòng chỉ là phép bit trên 8 số.
 */
export type BoardRows = number[]

const FULL_ROW = (1 << BOARD_SIZE) - 1

export function toBoardRows(board: BoardCells): BoardRows {
  const rows = new Array<number>(BOARD_SIZE).fill(0)
  for (let i = 0; i < board.length; i++) if (board[i]) rows[Math.floor(i / BOARD_SIZE)] |= 1 << i % BOARD_SIZE
  return rows
}

const shapeRowCache = new WeakMap<ShapeDef, number[]>()

/** Mask từng hàng của khối, căn sát cột 0. */
export function shapeRows(shape: ShapeDef): number[] {
  let rows = shapeRowCache.get(shape)
  if (!rows) {
    rows = new Array<number>(shape.height).fill(0)
    for (const [row, col] of shape.cells) rows[row] |= 1 << col
    shapeRowCache.set(shape, rows)
  }
  return rows
}

export function canPlaceRows(board: BoardRows, mask: readonly number[], row: number, col: number): boolean {
  for (let r = 0; r < mask.length; r++) if (board[row + r] & (mask[r] << col)) return false
  return true
}

/** Mọi vị trí đặt hợp lệ (row, col) theo thứ tự trên-trái xuống, cùng thứ tự với `listPlacements`. */
export function placementsRows(board: BoardRows, shape: ShapeDef): [number, number][] {
  const mask = shapeRows(shape)
  const result: [number, number][] = []
  for (let row = 0; row <= BOARD_SIZE - shape.height; row++)
    for (let col = 0; col <= BOARD_SIZE - shape.width; col++) if (canPlaceRows(board, mask, row, col)) result.push([row, col])
  return result
}

/** Đặt khối rồi xoá hàng/cột đầy; trả bàn mới và số dòng đã xoá. */
export function placeRowsAndClear(board: BoardRows, mask: readonly number[], row: number, col: number): { rows: BoardRows; linesCleared: number } {
  const rows = board.slice()
  for (let r = 0; r < mask.length; r++) rows[row + r] |= mask[r] << col
  let fullCols = FULL_ROW
  for (const value of rows) fullCols &= value
  let linesCleared = 0
  for (let bits = fullCols; bits; bits &= bits - 1) linesCleared++
  for (let r = 0; r < BOARD_SIZE; r++) {
    if (rows[r] === FULL_ROW) {
      linesCleared++
      rows[r] = 0
    } else {
      rows[r] &= ~fullCols & FULL_ROW
    }
  }
  return { rows, linesCleared }
}
