import { canShapeFitAnywhere } from "../engine/board-grid-operations"
import { BOARD_SIZE, STASH_SLOT, type GameState } from "../engine/game-types"
import { findShape } from "../engine/piece-shape-catalog"
import type { DragState } from "../input/pointer-drag-controller"
import { BOARD_COLORS } from "./block-color-palette"
import { drawBlock, drawEmptyCell, drawGhostCell } from "./block-cell-painter"
import { trayPieceOrigin, type CanvasLayout } from "./canvas-layout-metrics"
import { computePlacementPreview } from "./drag-placement-preview"
import { drawEffects, getCanvasFontFamily } from "./effects-painter"
import type { GameEffect } from "./effects-timeline"

export interface RenderView {
  game: GameState
  drag: DragState | null
  effects: readonly GameEffect[]
  now: number
  /** Nhãn ô cất (đã dịch): "Cất" + điều kiện mở khi còn khoá. */
  holdLabel: string
  holdLockedLabel: string
}

function drawBoard(ctx: CanvasRenderingContext2D, layout: CanvasLayout, view: RenderView) {
  const { board, cellSize } = layout
  const pad = cellSize * 0.11
  ctx.beginPath()
  ctx.roundRect(board.x - pad, board.y - pad, board.width + pad * 2, board.height + pad * 2, cellSize * 0.3)
  ctx.fillStyle = BOARD_COLORS.panel
  ctx.fill()
  ctx.lineWidth = cellSize * 0.07
  ctx.strokeStyle = BOARD_COLORS.panelEdge
  ctx.stroke()

  const preview = computePlacementPreview(view.game, view.drag)
  const highlighted = new Set<number>()
  if (preview) {
    for (const row of preview.rows) for (let c = 0; c < BOARD_SIZE; c++) highlighted.add(row * BOARD_SIZE + c)
    for (const col of preview.cols) for (let r = 0; r < BOARD_SIZE; r++) highlighted.add(r * BOARD_SIZE + col)
  }
  const ghost = new Set(preview?.ghostCells)

  view.game.board.forEach((colorId, index) => {
    const x = board.x + (index % BOARD_SIZE) * cellSize
    const y = board.y + Math.floor(index / BOARD_SIZE) * cellSize
    // Dòng sắp xoá đổi sang màu khối đang kéo để báo trước.
    if (colorId && preview && highlighted.has(index)) drawBlock(ctx, x, y, cellSize, preview.colorId)
    else if (colorId) drawBlock(ctx, x, y, cellSize, colorId)
    else drawEmptyCell(ctx, x, y, cellSize)

    if (preview && ghost.has(index)) {
      drawGhostCell(ctx, x, y, cellSize, preview.colorId)
      if (highlighted.has(index)) drawBlock(ctx, x, y, cellSize, preview.colorId, 0.85)
    }
  })

  if (highlighted.size > 0) {
    ctx.fillStyle = BOARD_COLORS.lineHighlight
    for (const index of highlighted) {
      ctx.fillRect(board.x + (index % BOARD_SIZE) * cellSize, board.y + Math.floor(index / BOARD_SIZE) * cellSize, cellSize, cellSize)
    }
  }
}

function drawTray(ctx: CanvasRenderingContext2D, layout: CanvasLayout, view: RenderView) {
  const panel = layout.trayPanel
  ctx.beginPath()
  ctx.roundRect(panel.x, panel.y, panel.width, panel.height, layout.cellSize * 0.5)
  ctx.fillStyle = BOARD_COLORS.slot
  ctx.fill()

  const size = layout.cellSize * layout.trayScale
  view.game.tray.forEach((piece, slot) => {
    if (!piece || view.drag?.slot === slot) return
    const shape = findShape(piece.shapeId)
    if (!shape) return
    const origin = trayPieceOrigin(layout, slot, shape)
    // Khối không còn chỗ đặt thì làm mờ để người chơi biết.
    const alpha = canShapeFitAnywhere(view.game.board, shape) ? 1 : 0.3
    for (const [dr, dc] of shape.cells) drawBlock(ctx, origin.x + dc * size, origin.y + dr * size, size, piece.colorId, alpha)
  })
}

function drawDraggedPiece(ctx: CanvasRenderingContext2D, layout: CanvasLayout, view: RenderView) {
  const drag = view.drag
  const piece = drag && (drag.slot === STASH_SLOT ? view.game.stash : view.game.tray[drag.slot])
  const shape = piece && findShape(piece.shapeId)
  if (!drag || !piece || !shape) return
  for (const [dr, dc] of shape.cells) {
    drawBlock(ctx, drag.pieceX + dc * layout.cellSize, drag.pieceY + dr * layout.cellSize, layout.cellSize, piece.colorId, 0.95)
  }
}

/** Ổ khoá nhỏ vẽ bằng path, tâm (cx, cy). */
function drawPadlock(ctx: CanvasRenderingContext2D, cx: number, cy: number, size: number) {
  ctx.lineWidth = Math.max(1, size * 0.12)
  ctx.beginPath()
  ctx.arc(cx, cy - size * 0.1, size * 0.24, Math.PI, 0)
  ctx.stroke()
  ctx.beginPath()
  ctx.roundRect(cx - size * 0.36, cy - size * 0.1, size * 0.72, size * 0.55, size * 0.1)
  ctx.fill()
}

/** Biểu tượng khay (hộp có rãnh) cho ô cất đang trống. */
function drawTrayIcon(ctx: CanvasRenderingContext2D, cx: number, cy: number, size: number) {
  const half = size / 2
  ctx.lineWidth = Math.max(1.5, size * 0.11)
  ctx.lineJoin = "round"
  ctx.lineCap = "round"
  ctx.beginPath()
  ctx.moveTo(cx - half, cy + size * 0.05)
  ctx.lineTo(cx - half * 0.3, cy + size * 0.05)
  ctx.lineTo(cx - half * 0.15, cy + size * 0.25)
  ctx.lineTo(cx + half * 0.15, cy + size * 0.25)
  ctx.lineTo(cx + half * 0.3, cy + size * 0.05)
  ctx.lineTo(cx + half, cy + size * 0.05)
  ctx.moveTo(cx - half, cy + size * 0.05)
  ctx.lineTo(cx - half * 0.65, cy - half)
  ctx.lineTo(cx + half * 0.65, cy - half)
  ctx.lineTo(cx + half, cy + size * 0.05)
  ctx.lineTo(cx + half, cy + half)
  ctx.lineTo(cx - half, cy + half)
  ctx.closePath()
  ctx.stroke()
}

/**
 * Ô "Cất" (nửa trái hàng dưới khay): ghi rõ nhãn để người chơi biết công dụng.
 * Khoá → ổ khoá + "300 điểm" (viền nét đứt); trống → biểu tượng khay; có khối → khối thu nhỏ.
 */
function drawStash(ctx: CanvasRenderingContext2D, layout: CanvasLayout, view: RenderView) {
  const { x, y, width, height } = layout.stash
  const unlocked = Boolean(view.game.stashUnlocked)
  const radius = height * 0.32
  ctx.save()
  ctx.beginPath()
  ctx.roundRect(x, y, width, height, radius)
  ctx.fillStyle = BOARD_COLORS.slot
  ctx.fill()
  ctx.lineWidth = Math.max(1.5, height * 0.035)
  ctx.strokeStyle = BOARD_COLORS.slotEdge
  if (!unlocked) ctx.setLineDash([height * 0.12, height * 0.09])
  ctx.stroke()
  ctx.setLineDash([])

  const iconSize = height * 0.42
  const iconX = x + height * 0.55
  const cy = y + height / 2
  ctx.strokeStyle = BOARD_COLORS.slotIcon
  ctx.fillStyle = BOARD_COLORS.slotIcon
  const piece = view.game.stash
  const shape = piece && findShape(piece.shapeId)
  if (!unlocked) {
    drawPadlock(ctx, iconX, cy, iconSize)
  } else if (piece && shape && view.drag?.slot !== STASH_SLOT) {
    const size = Math.min(layout.cellSize * 0.24, (height * 0.7) / Math.max(shape.width, shape.height))
    const ox = iconX - (shape.width * size) / 2
    const oy = cy - (shape.height * size) / 2
    for (const [r, c] of shape.cells) drawBlock(ctx, ox + c * size, oy + r * size, size, piece.colorId)
  } else {
    drawTrayIcon(ctx, iconX, cy, iconSize)
  }

  const textX = x + height * 1.05
  const labelSize = Math.round(height * 0.3)
  ctx.textAlign = "left"
  ctx.textBaseline = "middle"
  ctx.fillStyle = "#ffffff"
  ctx.font = `800 ${labelSize}px ${getCanvasFontFamily()}`
  if (unlocked) {
    ctx.fillText(view.holdLabel, textX, cy)
  } else {
    ctx.fillText(view.holdLabel, textX, cy - labelSize * 0.5)
    ctx.fillStyle = BOARD_COLORS.slotIcon
    ctx.font = `600 ${Math.round(labelSize * 0.78)}px ${getCanvasFontFamily()}`
    ctx.fillText(view.holdLockedLabel, textX, cy + labelSize * 0.62)
  }
  ctx.restore()
}

/** Vẽ toàn bộ một frame. Thuần vẽ, không giữ state. */
export function renderFrame(ctx: CanvasRenderingContext2D, layout: CanvasLayout, view: RenderView) {
  ctx.setTransform(layout.dpr, 0, 0, layout.dpr, 0, 0)
  ctx.clearRect(0, 0, layout.cssWidth, layout.cssHeight)
  if (layout.cellSize <= 0) return

  drawBoard(ctx, layout, view)
  drawTray(ctx, layout, view)
  drawStash(ctx, layout, view)
  drawEffects(ctx, layout, view.effects, view.now)
  drawDraggedPiece(ctx, layout, view)
}
