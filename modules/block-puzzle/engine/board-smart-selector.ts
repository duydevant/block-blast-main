import type { BoardCells, CellOffset } from "./game-types"

// Each byte describes one row from bottom to top, with bit zero at the right.
// Duplicate rotations are intentional: their order determines equal-score ties.
const VARIANT_ROWS: readonly (readonly number[])[] = [
  [1], [1], [1], [1],
  [1, 1], [3], [1, 1], [3],
  [2, 3], [3, 2], [3, 1], [1, 3],
  [3, 3], [3, 3], [3, 3], [3, 3],
  [7], [1, 1, 1], [7], [1, 1, 1],
  [7, 1], [1, 1, 3], [4, 7], [3, 2, 2],
  [7, 2], [1, 3, 1], [2, 7], [2, 3, 2],
  [7, 7], [3, 3, 3], [7, 7], [3, 3, 3],
  [7, 4, 4], [7, 1, 1], [1, 1, 7], [4, 4, 7],
  [7, 7, 7], [7, 7, 7], [7, 7, 7], [7, 7, 7],
  [15], [1, 1, 1, 1], [15], [1, 1, 1, 1],
  [2, 1], [1, 2], [2, 1], [1, 2],
  [3, 6], [2, 3, 1], [3, 6], [2, 3, 1],
  [31], [1, 1, 1, 1, 1], [31], [1, 1, 1, 1, 1],
  [1, 7], [2, 2, 3], [7, 4], [3, 1, 1],
]

const VARIANTS = VARIANT_ROWS.map((rows) => ({
  rows,
  width: Math.max(...rows.map((row) => 32 - Math.clz32(row))),
  height: rows.length,
}))

/** Geometry in ordinary screen coordinates, corresponding to selector indices 0..59. */
export const NATIVE_SHAPE_CELLS: readonly (readonly CellOffset[])[] = VARIANTS.map(({ rows, width, height }) =>
  rows.flatMap((bits, y) => Array.from({ length: width }, (_, x) => x)
    .filter((x) => bits & (1 << x))
    .map((x): CellOffset => [height - 1 - y, width - 1 - x]))
)

const LONGEST_RUN = Array.from({ length: 256 }, (_, bits) => {
  let best = 0
  let run = 0
  for (let x = 0; x < 8; x++) {
    run = bits & (1 << x) ? run + 1 : 0
    best = Math.max(best, run)
  }
  return best
})

function clearAndScore(rows: number[], first: boolean): number {
  let columnsToClear = 255
  let lines = 0
  for (const row of rows) columnsToClear &= row
  for (let x = 0; x < 8; x++) if (columnsToClear & (1 << x)) lines++
  for (let y = 0; y < 8; y++) {
    if (rows[y] === 255) {
      lines++
      rows[y] = 0
    } else rows[y] &= ~columnsToClear
  }
  let rowCount = 0
  let rowTotal = 0
  let columnCount = 0
  let columnTotal = 0
  for (const row of rows) {
    if (row) {
      rowCount++
      rowTotal += LONGEST_RUN[row]
    }
  }
  for (let x = 0; x < 8; x++) {
    let column = 0
    for (let y = 0; y < 8; y++) column |= ((rows[y] >>> x) & 1) << y
    if (column) {
      columnCount++
      columnTotal += LONGEST_RUN[column]
    }
  }
  // Match float32 arithmetic before truncation; double precision changes some ties.
  const rowMean = rowCount ? Math.fround(rowTotal / rowCount) : 0
  const columnMean = columnCount ? Math.fround(columnTotal / columnCount) : 0
  const structure = Math.trunc(Math.fround(Math.fround(rowMean + columnMean) * 100))
  return structure + 110 * lines * lines + (first && !rowCount ? 500 : 0)
}

/** Greedily choose three shapes, simulating the selected placement and clear each time. */
export function findSmartShapeIndices(board: BoardCells): readonly number[] {
  if (board.length !== 64) throw new RangeError("Smart selector expects an 8×8 board")
  let rows = Array.from({ length: 8 }, (_, y) => {
    let row = 0
    for (let x = 0; x < 8; x++) if (board[(7 - y) * 8 + 7 - x]) row |= 1 << x
    return row
  })
  const result: number[] = []
  for (let slot = 0; slot < 3; slot++) {
    let bestScore = -100_000_000
    let selected = 0
    let nextRows: number[] | undefined
    for (let index = 0; index < VARIANTS.length; index++) {
      const shape = VARIANTS[index]
      for (let y = 0; y <= 8 - shape.height; y++) {
        for (let x = 0; x <= 8 - shape.width; x++) {
          if (shape.rows.some((row, dy) => rows[y + dy] & (row << x))) continue
          const candidate = rows.slice()
          shape.rows.forEach((row, dy) => { candidate[y + dy] |= row << x })
          const score = clearAndScore(candidate, slot === 0)
          if (score > bestScore) {
            bestScore = score
            selected = index
            nextRows = candidate
          }
        }
      }
    }
    result.push(selected)
    // The native no-placement result is index zero at (0,0), followed by a clear.
    if (!nextRows) {
      nextRows = rows.slice()
      nextRows[0] |= 1
      clearAndScore(nextRows, false)
    }
    rows = nextRows
  }
  return result
}
