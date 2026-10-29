import type { GameState } from "../engine/game-types"
import type { CanvasLayout } from "../render/canvas-layout-metrics"
import {
  keyboardCommandForKey,
  keyboardDragState,
  type KeyboardCursor,
  normalizeKeyboardCursor,
} from "./keyboard-placement-controller"
import type { DragState } from "./pointer-drag-controller"

export interface KeyboardPlacementOptions {
  canvas: HTMLCanvasElement
  getLayout: () => CanvasLayout | null
  getGame: () => GameState | null
  /** Con trỏ bàn phím đổi → DragState để vẽ (null = thoát chế độ bàn phím). */
  onDragChange: (drag: DragState | null, cursor: KeyboardCursor | null) => void
  onPlace: (slot: number, row: number, col: number) => boolean
  onStash: (slot: number) => boolean
  onReplace: () => boolean
  onPickUp: () => void
  onInvalid: () => void
}

export interface KeyboardPlacement {
  detach: () => void
  /** Thoát chế độ bàn phím (VD người chơi bắt đầu kéo bằng chuột / ngón tay). */
  cancel: () => void
  /** Tính lại con trỏ sau khi state/bố cục đổi (đặt khối, khay mới, đổi kích thước). */
  refresh: () => void
  isActive: () => boolean
}

/** Phím chỉ được xử lý khi canvas đang focus (listener gắn trên canvas). */
export function attachKeyboardPlacement(options: KeyboardPlacementOptions): KeyboardPlacement {
  const { canvas } = options
  let cursor: KeyboardCursor | null = null

  const publish = (next: KeyboardCursor | null) => {
    const game = options.getGame()
    const layout = options.getLayout()
    cursor = game ? normalizeKeyboardCursor(game, next) : null
    options.onDragChange(layout && game ? keyboardDragState(layout, game, cursor) : null, cursor)
  }

  const handleKeyDown = (event: KeyboardEvent) => {
    if (event.isComposing || event.altKey || event.ctrlKey || event.metaKey) return
    const game = options.getGame()
    if (!game) return
    const command = keyboardCommandForKey(game, cursor, event.key, event.shiftKey)
    if (command.kind === "none") return
    event.preventDefault()
    // Giữ phím: chỉ mũi tên được lặp; Enter/Space/S/R lặp sẽ đặt/cất/đổi liên tiếp ngoài ý muốn.
    if (event.repeat && command.kind !== "cursor") return

    switch (command.kind) {
      case "cursor": {
        const pickedNewPiece = command.cursor !== null && command.cursor.slot !== cursor?.slot
        publish(command.cursor)
        if (pickedNewPiece) options.onPickUp()
        return
      }
      case "place":
        if (!options.onPlace(command.slot, command.row, command.col)) options.onInvalid()
        return
      case "stash":
        if (!options.onStash(command.slot)) options.onInvalid()
        return
      case "replace":
        if (!options.onReplace()) options.onInvalid()
        return
      case "invalid":
        options.onInvalid()
    }
  }

  // Rời canvas (Tab ra ngoài) thì ẩn bóng khối của bàn phím.
  const handleBlur = () => {
    if (cursor) publish(null)
  }

  canvas.addEventListener("keydown", handleKeyDown)
  canvas.addEventListener("blur", handleBlur)

  return {
    detach: () => {
      canvas.removeEventListener("keydown", handleKeyDown)
      canvas.removeEventListener("blur", handleBlur)
    },
    cancel: () => {
      cursor = null
    },
    refresh: () => {
      if (cursor) publish(cursor)
    },
    isActive: () => cursor !== null,
  }
}
