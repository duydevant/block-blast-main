import { canPlace } from "../engine/board-grid-operations"
import { BOARD_SIZE, STASH_SLOT, TRAY_SIZE, type GameState, type TrayPiece } from "../engine/game-types"
import { findShape } from "../engine/piece-shape-catalog"
import { isStashUnlocked } from "../engine/power-up-rules"
import type { CanvasLayout } from "../render/canvas-layout-metrics"
import type { DragState } from "./pointer-drag-controller"

/**
 * Chơi bằng bàn phím (WCAG 2.1.1): con trỏ = khối đang chọn + góc trên-trái trên bàn.
 * Logic thuần (không DOM) — canvas chỉ đổi phím → lệnh rồi gọi store.
 */
export interface KeyboardCursor {
  /** 0..2 = khay, STASH_SLOT = khối trong ô cất. */
  slot: number
  row: number
  col: number
}

export type KeyboardCommand =
  | { kind: "cursor"; cursor: KeyboardCursor | null }
  | { kind: "place"; slot: number; row: number; col: number }
  | { kind: "invalid" }
  | { kind: "stash"; slot: number }
  | { kind: "replace" }
  | { kind: "none" }

/** pointerId giả cho "kéo" bằng bàn phím (pointer thật luôn ≥ 0). */
export const KEYBOARD_POINTER_ID = -1

function pieceAt(game: GameState, slot: number): TrayPiece | null {
  return (slot === STASH_SLOT ? game.stash : game.tray[slot]) ?? null
}

/** Các slot đang có khối, theo thứ tự khay rồi ô cất (nếu đã mở). */
export function selectableSlots(game: GameState): number[] {
  const slots = Array.from({ length: TRAY_SIZE }, (_, slot) => slot).filter((slot) => game.tray[slot])
  if (game.stash && isStashUnlocked(game)) slots.push(STASH_SLOT)
  return slots
}

/** Giữ góc khối trong bàn (theo kích thước khối). */
function clampToBoard(game: GameState, cursor: KeyboardCursor): KeyboardCursor {
  const shape = findShape(pieceAt(game, cursor.slot)?.shapeId ?? "")
  if (!shape) return cursor
  const clamp = (value: number, max: number) => Math.min(Math.max(0, value), max)
  return { ...cursor, row: clamp(cursor.row, BOARD_SIZE - shape.height), col: clamp(cursor.col, BOARD_SIZE - shape.width) }
}

/** Chọn slot; giữ vị trí cũ nếu có, không thì đặt khối giữa bàn. */
function selectSlot(game: GameState, slot: number, previous: KeyboardCursor | null): KeyboardCursor | null {
  const shape = findShape(pieceAt(game, slot)?.shapeId ?? "")
  if (!shape) return previous
  const start = previous ?? { slot, row: Math.floor((BOARD_SIZE - shape.height) / 2), col: Math.floor((BOARD_SIZE - shape.width) / 2) }
  return clampToBoard(game, { ...start, slot })
}

/**
 * Sau khi state đổi (đặt khối, chia khay mới, ván mới…): slot đang chọn không còn khối → chọn slot kế tiếp còn khối.
 * Hết ván / không còn khối nào → null (thoát chế độ bàn phím).
 */
export function normalizeKeyboardCursor(game: GameState, cursor: KeyboardCursor | null): KeyboardCursor | null {
  if (!cursor || game.isGameOver) return null
  const slots = selectableSlots(game)
  if (slots.length === 0) return null
  if (slots.includes(cursor.slot)) return clampToBoard(game, cursor)
  const next = slots.find((slot) => slot > cursor.slot) ?? slots[0]
  return selectSlot(game, next, cursor)
}

/** Một phím → lệnh. `shiftKey` chỉ dùng cho Shift+Tab (đổi khối ngược lại). */
export function keyboardCommandForKey(game: GameState, cursor: KeyboardCursor | null, key: string, shiftKey = false): KeyboardCommand {
  if (game.isGameOver) return { kind: "none" }
  const lower = key.toLowerCase()

  if (key === "1" || key === "2" || key === "3") {
    const slot = Number(key) - 1
    return game.tray[slot] ? { kind: "cursor", cursor: selectSlot(game, slot, cursor) } : { kind: "invalid" }
  }
  if (key === "Tab") {
    const slots = selectableSlots(game)
    // Chưa chọn khối thì để Tab rời canvas như bình thường (không bẫy focus).
    if (!cursor || slots.length === 0) return { kind: "none" }
    const index = slots.indexOf(cursor.slot)
    const next = slots[(index + (shiftKey ? -1 : 1) + slots.length) % slots.length]
    return { kind: "cursor", cursor: selectSlot(game, next, cursor) }
  }
  if (lower === "r") return game.noPowerUps ? { kind: "none" } : { kind: "replace" }
  if (key === "Escape") return cursor ? { kind: "cursor", cursor: null } : { kind: "none" }

  const moves: Record<string, [number, number]> = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] }
  if (key in moves) {
    // Mũi tên khi chưa chọn → chọn khối đầu tiên.
    if (!cursor) {
      const first = selectableSlots(game)[0]
      return first === undefined ? { kind: "none" } : { kind: "cursor", cursor: selectSlot(game, first, null) }
    }
    const [dr, dc] = moves[key]
    return { kind: "cursor", cursor: clampToBoard(game, { ...cursor, row: cursor.row + dr, col: cursor.col + dc }) }
  }

  if (!cursor) return { kind: "none" }
  if (key === "Enter" || key === " ") {
    const shape = findShape(pieceAt(game, cursor.slot)?.shapeId ?? "")
    return shape && canPlace(game.board, shape, cursor.row, cursor.col)
      ? { kind: "place", slot: cursor.slot, row: cursor.row, col: cursor.col }
      : { kind: "invalid" }
  }
  if (lower === "s") {
    const canStash = !game.noPowerUps && cursor.slot >= 0 && !game.stash && isStashUnlocked(game)
    return canStash ? { kind: "stash", slot: cursor.slot } : { kind: "invalid" }
  }
  return { kind: "none" }
}

/** Con trỏ bàn phím → DragState để renderer vẽ khối + bóng + dòng sắp xoá như khi kéo bằng chuột. */
export function keyboardDragState(layout: CanvasLayout, game: GameState, cursor: KeyboardCursor | null): DragState | null {
  if (!cursor) return null
  const piece = pieceAt(game, cursor.slot)
  const shape = piece && findShape(piece.shapeId)
  if (!piece || !shape) return null
  return {
    slot: cursor.slot,
    uid: piece.uid,
    pointerId: KEYBOARD_POINTER_ID,
    liftY: 0,
    pieceX: layout.board.x + cursor.col * layout.cellSize,
    pieceY: layout.board.y + cursor.row * layout.cellSize,
    snap: canPlace(game.board, shape, cursor.row, cursor.col) ? { row: cursor.row, col: cursor.col } : null,
  }
}
