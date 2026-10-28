import { findFullLines, placeCells } from "../engine/board-grid-operations"
import { STASH_SLOT, type GameState } from "../engine/game-types"
import { findShape } from "../engine/piece-shape-catalog"
import type { DragState } from "../input/pointer-drag-controller"

export interface PlacementPreview {
  colorId: number
  ghostCells: number[]
  /** Hàng/cột sẽ được xoá nếu thả ở vị trí snap hiện tại. */
  rows: number[]
  cols: number[]
}

/** Bóng khối + các dòng sắp xoá khi đang kéo tới vị trí hợp lệ. */
export function computePlacementPreview(game: GameState, drag: DragState | null): PlacementPreview | null {
  if (!drag?.snap) return null
  const piece = drag.slot === STASH_SLOT ? game.stash : game.tray[drag.slot]
  const shape = piece && findShape(piece.shapeId)
  if (!piece || !shape) return null

  const placed = placeCells(game.board, shape, drag.snap.row, drag.snap.col, piece.colorId)
  const lines = findFullLines(placed.board)
  return { colorId: piece.colorId, ghostCells: placed.placedCells, rows: lines.rows, cols: lines.cols }
}
