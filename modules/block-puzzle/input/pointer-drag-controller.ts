import { canPlace } from "../engine/board-grid-operations"
import { STASH_SLOT, type GameState } from "../engine/game-types"
import { findShape } from "../engine/piece-shape-catalog"
import { computeSnapCell, hitTestStash, hitTestTraySlot, type CanvasLayout } from "../render/canvas-layout-metrics"

export interface DragState {
  slot: number
  /** uid khối đang kéo — nếu slot bị thay khối khác (ván mới) thì huỷ kéo. */
  uid: number
  pointerId: number
  /** Khối nhấc lên phía trên ngón tay bao nhiêu px (chỉ khi chạm), để ngón tay không che khối. */
  liftY: number
  /** Góc trên-trái của khối (cỡ thật) theo toạ độ CSS của canvas. */
  pieceX: number
  pieceY: number
  /** Ô snap hợp lệ trên bàn, null nếu thả ở đây không được. */
  snap: { row: number; col: number } | null
}

/** Số ô khối được nhấc lên trên ngón tay khi kéo bằng cảm ứng. */
const TOUCH_LIFT_IN_CELLS = 1.6

/**
 * Tính lại trạng thái kéo từ vị trí con trỏ — hàm thuần để test được.
 * Trả null nếu slot trống hoặc khối trong slot không còn là `expectedUid`.
 */
export function computeDragState(
  layout: CanvasLayout,
  game: GameState,
  slot: number,
  pointerId: number,
  x: number,
  y: number,
  liftY: number,
  expectedUid?: number
): DragState | null {
  const piece = slot === STASH_SLOT ? game.stash : game.tray[slot]
  const shape = piece && findShape(piece.shapeId)
  if (!piece || !shape || game.isGameOver) return null
  if (expectedUid !== undefined && piece.uid !== expectedUid) return null

  const pieceX = x - (shape.width * layout.cellSize) / 2
  const pieceY = y - (shape.height * layout.cellSize) / 2 - liftY
  const cell = computeSnapCell(layout, pieceX, pieceY)
  const snap = canPlace(game.board, shape, cell.row, cell.col) ? cell : null
  return { slot, uid: piece.uid, pointerId, liftY, pieceX, pieceY, snap }
}

export interface PointerDragControllerOptions {
  canvas: HTMLCanvasElement
  getLayout: () => CanvasLayout | null
  getGame: () => GameState | null
  onDragChange: (drag: DragState | null) => void
  onPickUp: (slot: number) => void
  /** Trả về true nếu đặt khối thành công. */
  onDrop: (slot: number, row: number, col: number) => boolean
  onStash?: (slot: number) => boolean
  onInvalidDrop: () => void
}

export interface PointerDragController {
  detach: () => void
  /** Huỷ kéo đang diễn ra (đổi kích thước, ván mới...). */
  cancelDrag: () => void
}

/**
 * Pointer Events (chuột + cảm ứng + bút). pointerdown nghe trên canvas, move/up/cancel nghe trên window
 * để thả ngoài canvas hay setPointerCapture lỗi vẫn kết thúc kéo đúng.
 */
export function attachPointerDragController(options: PointerDragControllerOptions): PointerDragController {
  const { canvas } = options
  let drag: DragState | null = null

  const localPoint = (event: PointerEvent) => {
    const rect = canvas.getBoundingClientRect()
    return { x: event.clientX - rect.left, y: event.clientY - rect.top }
  }

  const update = (next: DragState | null) => {
    drag = next
    options.onDragChange(next)
  }

  const handleDown = (event: PointerEvent) => {
    // Chỉ nút chính / ngón đầu tiên; bỏ chuột phải, chuột giữa, ngón thứ hai.
    if (event.button !== 0 || !event.isPrimary) return
    const layout = options.getLayout()
    const game = options.getGame()
    if (drag || !layout || !game || game.isGameOver) return
    const { x, y } = localPoint(event)
    const slot = game.stashUnlocked && game.stash && hitTestStash(layout, x, y) ? STASH_SLOT : hitTestTraySlot(layout, x, y)
    if (slot === -1 || !(slot === STASH_SLOT ? game.stash : game.tray[slot])) return

    event.preventDefault()
    try {
      canvas.setPointerCapture(event.pointerId)
    } catch {
      // Pointer không còn active — window listener vẫn bắt được pointerup.
    }
    const liftY = event.pointerType === "touch" ? layout.cellSize * TOUCH_LIFT_IN_CELLS : 0
    const next = computeDragState(layout, game, slot, event.pointerId, x, y, liftY)
    if (!next) return
    update(next)
    options.onPickUp(slot)
  }

  const handleMove = (event: PointerEvent) => {
    if (!drag || event.pointerId !== drag.pointerId) return
    const layout = options.getLayout()
    const game = options.getGame()
    if (!layout || !game) return update(null)
    const { x, y } = localPoint(event)
    update(computeDragState(layout, game, drag.slot, drag.pointerId, x, y, drag.liftY, drag.uid))
  }

  const handleUp = (event: PointerEvent) => {
    if (!drag || event.pointerId !== drag.pointerId) return
    const { slot, snap, uid, liftY } = drag
    update(null)
    const layout = options.getLayout()
    const game = options.getGame()
    if (!layout || !game || (slot === STASH_SLOT ? game.stash : game.tray[slot])?.uid !== uid) return
    const { x, y } = localPoint(event)
    if (slot >= 0 && game.stashUnlocked && !game.stash && hitTestStash(layout, x, y - liftY) && options.onStash?.(slot)) return
    if (snap && options.onDrop(slot, snap.row, snap.col)) return
    // Thả lại trong khay = huỷ kéo, không báo lỗi.
    if (hitTestTraySlot(layout, x, y) < 0 && !hitTestStash(layout, x, y)) options.onInvalidDrop()
  }

  const handleCancel = (event: PointerEvent) => {
    if (drag && event.pointerId === drag.pointerId) update(null)
  }

  const cancelDrag = () => {
    if (drag) update(null)
  }

  canvas.addEventListener("pointerdown", handleDown)
  window.addEventListener("pointermove", handleMove)
  window.addEventListener("pointerup", handleUp)
  window.addEventListener("pointercancel", handleCancel)
  window.addEventListener("blur", cancelDrag)

  return {
    cancelDrag,
    detach: () => {
      canvas.removeEventListener("pointerdown", handleDown)
      window.removeEventListener("pointermove", handleMove)
      window.removeEventListener("pointerup", handleUp)
      window.removeEventListener("pointercancel", handleCancel)
      window.removeEventListener("blur", cancelDrag)
    },
  }
}
