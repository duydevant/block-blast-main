import { canPlace, clearLines, findFullLines, placeCells } from "./board-grid-operations"
import { placeRowsAndClear, placementsRows, shapeRows, toBoardRows, type BoardRows } from "./board-bitmask-operations"
import { BOARD_SIZE, type BoardCells, type ShapeDef } from "./game-types"

export interface SimulatedPlacement {
  board: number[]
  linesCleared: number
}

/** Đặt khối rồi xoá dòng đầy, không tính điểm — dùng cho mô phỏng của bộ chia khối và bot. */
export function simulatePlacement(board: BoardCells, shape: ShapeDef, row: number, col: number): SimulatedPlacement {
  const placed = placeCells(board, shape, row, col, 1).board
  const lines = findFullLines(placed)
  const linesCleared = lines.rows.length + lines.cols.length
  return { board: linesCleared ? clearLines(placed, lines.rows, lines.cols).board : placed, linesCleared }
}

/** Mọi vị trí đặt hợp lệ của khối, duyệt từ trên-trái xuống. */
export function listPlacements(board: BoardCells, shape: ShapeDef): { row: number; col: number }[] {
  const result: { row: number; col: number }[] = []
  for (let row = 0; row <= BOARD_SIZE - shape.height; row++)
    for (let col = 0; col <= BOARD_SIZE - shape.width; col++)
      if (canPlace(board, shape, row, col)) result.push({ row, col })
  return result
}

/** Khối này có vị trí nào xoá được ít nhất một dòng ngay không. */
export function clearsLineImmediately(board: BoardCells, shape: ShapeDef): boolean {
  const rows = toBoardRows(board)
  const mask = shapeRows(shape)
  return placementsRows(rows, shape).some(([row, col]) => placeRowsAndClear(rows, mask, row, col).linesCleared > 0)
}

/** Vị trí xoá được nhiều dòng nhất (hoà thì lấy vị trí đầu tiên); null nếu không đặt được. */
export function bestPlacement(board: BoardCells, shape: ShapeDef): (SimulatedPlacement & { row: number; col: number }) | null {
  let best: (SimulatedPlacement & { row: number; col: number }) | null = null
  for (const { row, col } of listPlacements(board, shape)) {
    const result = simulatePlacement(board, shape, row, col)
    if (!best || result.linesCleared > best.linesCleared) best = { ...result, row, col }
  }
  return best
}

/** Ngân sách số lần thử đặt; truyền cùng một object cho nhiều lần gọi để chia chung một giới hạn. */
export interface SearchBudget {
  remaining: number
}

/**
 * Có tồn tại thứ tự + vị trí để đặt hết các khối không (có tính xoá dòng giữa các nước).
 * Trả "unknown" khi hết `budget` lần thử đặt — bàn rất rối, người gọi tự quyết.
 * Chạy trên bitmask (`board-bitmask-operations.ts`) vì đây là vòng nóng của bộ chia khối.
 */
export function canPlaceAllInSomeOrder(board: BoardCells, shapes: readonly ShapeDef[], budget: number | SearchBudget): boolean | "unknown" {
  const counter = typeof budget === "number" ? { remaining: budget } : budget
  // Trạng thái (bàn, khối còn lại) đã chắc chắn thất bại — đặt A rồi B thường ra cùng bàn với B rồi A.
  const failed = new Set<string>()
  const search = (current: BoardRows, left: readonly ShapeDef[]): boolean | "unknown" => {
    if (left.length === 0) return true
    const key = `${current.join(",")}|${left.map((shape) => shape.id).join(",")}`
    if (failed.has(key)) return false
    let sawUnknown = false
    for (let i = 0; i < left.length; i++) {
      if (left.findIndex((shape) => shape.id === left[i].id) !== i) continue
      const rest = left.filter((_, index) => index !== i)
      const mask = shapeRows(left[i])
      for (const [row, col] of placementsRows(current, left[i])) {
        if (--counter.remaining < 0) return "unknown"
        const outcome = search(placeRowsAndClear(current, mask, row, col).rows, rest)
        if (outcome === true) return true
        if (outcome === "unknown") sawUnknown = true
      }
    }
    if (sawUnknown) return "unknown"
    failed.add(key)
    return false
  }
  // Thử khối khó đặt (nhiều ô) trước: nhánh thất bại bị cắt sớm hơn. Thứ tự cố định nên key memo ổn định.
  const ordered = [...shapes].sort((a, b) => b.cells.length - a.cells.length || a.id.localeCompare(b.id))
  return search(toBoardRows(board), ordered)
}
