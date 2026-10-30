import { STASH_SLOT, type GameState } from "@/modules/block-puzzle/engine/game-types"
import { findShape } from "@/modules/block-puzzle/engine/piece-shape-catalog"
import type { RecordedGameAction } from "@/modules/block-puzzle/engine/replay-recorded-game-actions"
import type { CanvasLayout } from "@/modules/block-puzzle/render/canvas-layout-metrics"

/** Viền cam nét đứt quanh các ô lời giải mẫu đặt khối kế tiếp (gợi ý bài học). */
export function drawLessonHint(ctx: CanvasRenderingContext2D, layout: CanvasLayout, game: GameState, hint: RecordedGameAction | null, now: number) {
  if (!hint || hint.type !== "PLACE_PIECE") return
  const piece = hint.slot === STASH_SLOT ? game.stash : game.tray[hint.slot]
  const shape = piece && findShape(piece.shapeId)
  if (!shape) return
  const { cellSize, board } = layout
  const inset = cellSize * 0.08
  ctx.save()
  ctx.strokeStyle = "#ffb547"
  ctx.lineWidth = Math.max(2, cellSize * 0.08)
  ctx.setLineDash([cellSize * 0.18, cellSize * 0.12])
  // Nhấp nháy nhẹ để gợi ý nổi trên bàn (không cần hiệu ứng riêng).
  ctx.globalAlpha = 0.65 + 0.35 * Math.sin(now / 260)
  for (const [r, c] of shape.cells) {
    const x = board.x + (hint.col + c) * cellSize + inset
    const y = board.y + (hint.row + r) * cellSize + inset
    ctx.strokeRect(x, y, cellSize - inset * 2, cellSize - inset * 2)
  }
  ctx.restore()
}
