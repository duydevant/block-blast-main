import { canShapeFitAnywhere } from "./board-grid-operations"
import type { BoardCells, TrayPiece, TraySlots } from "./game-types"
import { findShape } from "./piece-shape-catalog"

/** Hết nước khi không khối nào trong khay (và ô cất) đặt được ở bất kỳ đâu. */
export function hasAnyMove(board: BoardCells, tray: TraySlots, stash: TrayPiece | null = null): boolean {
  return [...tray, stash].some((piece) => {
    const shape = piece && findShape(piece.shapeId)
    return shape ? canShapeFitAnywhere(board, shape) : false
  })
}
