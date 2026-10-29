import { unlockAudio, type SoundName } from "../audio/sound-effects-player"
import { attachKeyboardPlacement, type KeyboardPlacement } from "../input/attach-keyboard-placement"
import type { KeyboardCursor } from "../input/keyboard-placement-controller"
import { attachPointerDragController, type DragState, type PointerDragController } from "../input/pointer-drag-controller"
import type { CanvasLayout } from "../render/canvas-layout-metrics"
import { useBlockPuzzleGameStore } from "../store/block-puzzle-game-store"
import { DRAG_LIFT_CELLS, useBlockPuzzleSettingsStore } from "../store/block-puzzle-settings-store"

export interface GameCanvasInputOptions {
  canvas: HTMLCanvasElement
  getLayout: () => CanvasLayout | null
  /** Khối đang kéo (chuột/cảm ứng) hoặc con trỏ bàn phím đổi; `cursor` khác null = đang chơi bằng bàn phím. */
  onDragChange: (drag: DragState | null, cursor: KeyboardCursor | null) => void
  sound: (name: SoundName) => void
  haptic: (pattern: number | number[]) => void
}

export interface GameCanvasInputs {
  pointer: PointerDragController
  keyboard: KeyboardPlacement
  detach: () => void
}

/**
 * Gắn hai cách điều khiển màn chơi chính: kéo thả (Pointer Events) và bàn phím (khi canvas focus).
 * Bắt đầu kéo bằng chuột / ngón tay thì bỏ con trỏ bàn phím.
 */
export function attachGameCanvasInputs(options: GameCanvasInputOptions): GameCanvasInputs {
  const { canvas, getLayout, onDragChange, sound, haptic } = options
  const store = () => useBlockPuzzleGameStore.getState()
  const getGame = () => store().game

  const keyboard = attachKeyboardPlacement({
    canvas,
    getLayout,
    getGame,
    onDragChange,
    onPlace: (slot, row, col) => store().placePiece(slot, row, col),
    onStash: (slot) => store().stashPiece(slot),
    onReplace: () => store().replaceTray(),
    onPickUp: () => {
      unlockAudio()
      sound("pick")
    },
    onInvalid: () => sound("invalid"),
  })

  const pointer = attachPointerDragController({
    canvas,
    getLayout,
    getGame,
    getTouchLiftCells: () => DRAG_LIFT_CELLS[useBlockPuzzleSettingsStore.getState().dragLift],
    onDragChange: (next) => {
      if (next) keyboard.cancel()
      onDragChange(next, null)
    },
    onPickUp: () => {
      unlockAudio()
      sound("pick")
      haptic(8)
    },
    onDrop: (slot, row, col) => store().placePiece(slot, row, col),
    onStash: (slot) => store().stashPiece(slot),
    onInvalidDrop: () => sound("invalid"),
  })

  return {
    pointer,
    keyboard,
    detach: () => {
      pointer.detach()
      keyboard.detach()
    },
  }
}
