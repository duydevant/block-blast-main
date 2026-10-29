import { BOARD_SIZE, TRAY_SIZE, type ShapeDef } from "../engine/game-types"

export interface Rect {
  x: number
  y: number
  width: number
  height: number
}

export interface CanvasLayout {
  cssWidth: number
  cssHeight: number
  dpr: number
  cellSize: number
  board: Rect
  traySlots: Rect[]
  /** Nền khay (bao 3 slot). */
  trayPanel: Rect
  /** Ô "Cất" (nửa trái hàng dưới khay) — cũng là chỗ thả khối để cất. */
  stash: Rect
  /** Chỗ của nút HTML "Đổi khối" (nửa phải hàng dưới khay). */
  swapButton: Rect
  /** Có hàng "Cất | Đổi khối" dưới khay không (đấu 1v1 thì không: hai rect trên rỗng, bàn to hơn). */
  powerUps: boolean
  trayScale: number
}

/** Khối trong khay vẽ nhỏ lại, phóng to đủ cỡ khi kéo. */
export const TRAY_PIECE_SCALE = 0.5
/** Giới hạn DPR để canvas không quá nặng trên máy màn hình rất nét. */
const MAX_DPR = 2.5

/** Bố cục tính theo đơn vị "ô": [lề] bàn 8x8 [khoảng] khay 3 slot [khoảng] hàng "Cất | Đổi khối" [lề]. */
const UNITS = {
  sidePadding: 0.3,
  topPadding: 0.3,
  boardToTray: 0.5,
  trayHeight: 2.9,
  trayToActions: 0.3,
  actionHeight: 1.35,
  actionGap: 0.3,
  bottomPadding: 0.25,
} as const
const WIDTH_UNITS = BOARD_SIZE + UNITS.sidePadding * 2
const BASE_HEIGHT_UNITS = UNITS.topPadding + BOARD_SIZE + UNITS.boardToTray + UNITS.trayHeight + UNITS.bottomPadding
const ACTION_ROW_UNITS = UNITS.trayToActions + UNITS.actionHeight
/** Rect rỗng ngoài canvas: không vẽ, không bao giờ trúng khi chạm. */
const NO_RECT: Rect = { x: -1, y: -1, width: 0, height: 0 }

export function computeLayout(cssWidth: number, cssHeight: number, devicePixelRatio = 1, powerUps = true): CanvasLayout {
  const HEIGHT_UNITS = BASE_HEIGHT_UNITS + (powerUps ? ACTION_ROW_UNITS : 0)
  // Làm tròn xuống px nguyên để viền ô sắc nét.
  const cellSize = Math.max(0, Math.floor(Math.min(cssWidth / WIDTH_UNITS, cssHeight / HEIGHT_UNITS)))
  const boardSize = cellSize * BOARD_SIZE
  // Căn giữa cả khối nội dung theo hai chiều.
  const top = Math.max(0, (cssHeight - HEIGHT_UNITS * cellSize) / 2) + UNITS.topPadding * cellSize
  const board: Rect = { x: (cssWidth - boardSize) / 2, y: top, width: boardSize, height: boardSize }

  const trayY = board.y + boardSize + UNITS.boardToTray * cellSize
  const slotWidth = boardSize / TRAY_SIZE
  const traySlots = Array.from({ length: TRAY_SIZE }, (_, slot) => ({
    x: board.x + slot * slotWidth,
    y: trayY,
    width: slotWidth,
    height: UNITS.trayHeight * cellSize,
  }))

  const actionY = trayY + (UNITS.trayHeight + UNITS.trayToActions) * cellSize
  const actionWidth = (boardSize - UNITS.actionGap * cellSize) / 2
  const actionHeight = UNITS.actionHeight * cellSize
  return {
    cssWidth,
    cssHeight,
    dpr: Math.min(Math.max(devicePixelRatio, 1), MAX_DPR),
    cellSize,
    board,
    traySlots,
    trayPanel: { x: board.x, y: trayY, width: boardSize, height: UNITS.trayHeight * cellSize },
    stash: powerUps ? { x: board.x, y: actionY, width: actionWidth, height: actionHeight } : NO_RECT,
    swapButton: powerUps ? { x: board.x + boardSize - actionWidth, y: actionY, width: actionWidth, height: actionHeight } : NO_RECT,
    powerUps,
    trayScale: TRAY_PIECE_SCALE,
  }
}

function containsPoint(rect: Rect, x: number, y: number): boolean {
  return x >= rect.x && x < rect.x + rect.width && y >= rect.y && y < rect.y + rect.height
}

export function hitTestStash(layout: CanvasLayout, x: number, y: number): boolean {
  return containsPoint(layout.stash, x, y)
}

/** Trả về slot khay chứa điểm, -1 nếu không trúng. Cả ô slot là vùng chạm để dễ bấm trên mobile. */
export function hitTestTraySlot(layout: CanvasLayout, x: number, y: number): number {
  return layout.traySlots.findIndex((slot) => containsPoint(slot, x, y))
}

/** Vị trí góc trên-trái để vẽ khối nằm giữa slot khay với tỉ lệ thu nhỏ. */
export function trayPieceOrigin(layout: CanvasLayout, slot: number, shape: ShapeDef): { x: number; y: number } {
  const rect = layout.traySlots[slot]
  const size = layout.cellSize * layout.trayScale
  return {
    x: rect.x + (rect.width - shape.width * size) / 2,
    y: rect.y + (rect.height - shape.height * size) / 2,
  }
}

/**
 * Ô góc trên-trái trên bàn mà khối sẽ snap vào, khi khối đang được vẽ tại (pieceX, pieceY).
 * Luôn trả số nguyên; kiểm tra hợp lệ do engine (canPlace) quyết định.
 */
export function computeSnapCell(layout: CanvasLayout, pieceX: number, pieceY: number): { row: number; col: number } {
  // `|| 0` đổi -0 thành 0 (Math.round(-0.2) = -0).
  return {
    row: Math.round((pieceY - layout.board.y) / layout.cellSize) || 0,
    col: Math.round((pieceX - layout.board.x) / layout.cellSize) || 0,
  }
}
