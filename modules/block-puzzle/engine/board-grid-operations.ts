import { BOARD_CELL_COUNT, BOARD_SIZE, type BoardCells, type ShapeDef } from "./game-types"

export function cellIndex(row: number, col: number): number {
  return row * BOARD_SIZE + col
}

export function createEmptyBoard(): number[] {
  return new Array<number>(BOARD_CELL_COUNT).fill(0)
}

export function isBoardEmpty(board: BoardCells): boolean {
  return board.every((cell) => cell === 0)
}

/** (row, col) là vị trí góc trên-trái của khối trên bàn. */
export function canPlace(board: BoardCells, shape: ShapeDef, row: number, col: number): boolean {
  // Toạ độ lẻ (0.5, NaN) vẫn qua được bounds check và làm khối tràn sang hàng sau.
  if (!Number.isInteger(row) || !Number.isInteger(col)) return false
  if (row < 0 || col < 0 || row + shape.height > BOARD_SIZE || col + shape.width > BOARD_SIZE) return false
  return shape.cells.every(([dr, dc]) => board[cellIndex(row + dr, col + dc)] === 0)
}

export function placeCells(
  board: BoardCells,
  shape: ShapeDef,
  row: number,
  col: number,
  colorId: number
): { board: number[]; placedCells: number[] } {
  const next = [...board]
  const placedCells = shape.cells.map(([dr, dc]) => cellIndex(row + dr, col + dc))
  for (const index of placedCells) next[index] = colorId
  return { board: next, placedCells }
}

export function findFullLines(board: BoardCells): { rows: number[]; cols: number[] } {
  const rows: number[] = []
  const cols: number[] = []
  for (let i = 0; i < BOARD_SIZE; i++) {
    let rowFull = true
    let colFull = true
    for (let j = 0; j < BOARD_SIZE; j++) {
      if (board[cellIndex(i, j)] === 0) rowFull = false
      if (board[cellIndex(j, i)] === 0) colFull = false
    }
    if (rowFull) rows.push(i)
    if (colFull) cols.push(i)
  }
  return { rows, cols }
}

/** Xoá hàng + cột cùng lúc; ô nằm ở giao điểm chỉ tính một lần. */
export function clearLines(
  board: BoardCells,
  rows: readonly number[],
  cols: readonly number[]
): { board: number[]; clearedCells: number[] } {
  const cleared = new Set<number>()
  for (const row of rows) for (let c = 0; c < BOARD_SIZE; c++) cleared.add(cellIndex(row, c))
  for (const col of cols) for (let r = 0; r < BOARD_SIZE; r++) cleared.add(cellIndex(r, col))

  const next = [...board]
  for (const index of cleared) next[index] = 0
  return { board: next, clearedCells: [...cleared].sort((a, b) => a - b) }
}

export function canShapeFitAnywhere(board: BoardCells, shape: ShapeDef): boolean {
  for (let row = 0; row <= BOARD_SIZE - shape.height; row++) {
    for (let col = 0; col <= BOARD_SIZE - shape.width; col++) {
      if (canPlace(board, shape, row, col)) return true
    }
  }
  return false
}
