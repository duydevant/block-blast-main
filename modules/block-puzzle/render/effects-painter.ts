import { BOARD_SIZE } from "../engine/game-types"
import { blockColor, BOARD_COLORS } from "./block-color-palette"
import { drawBlock } from "./block-cell-painter"
import type { CanvasLayout } from "./canvas-layout-metrics"
import { easeOutCubic, effectProgress, type GameEffect } from "./effects-timeline"

const GRAVITY_CELLS_PER_SEC2 = 14

/** Canvas không hiểu CSS var, nên component truyền font family đã resolve vào đây. */
let canvasFontFamily = "system-ui, sans-serif"

export function getCanvasFontFamily(): string {
  return canvasFontFamily
}

export function setCanvasFontFamily(fontFamily: string) {
  if (fontFamily) canvasFontFamily = fontFamily
}

function cellOrigin(layout: CanvasLayout, index: number) {
  return {
    x: layout.board.x + (index % BOARD_SIZE) * layout.cellSize,
    y: layout.board.y + Math.floor(index / BOARD_SIZE) * layout.cellSize,
  }
}

function drawFlash(ctx: CanvasRenderingContext2D, layout: CanvasLayout, effect: Extract<GameEffect, { kind: "flash" }>, t: number) {
  ctx.fillStyle = `rgba(255, 255, 255, ${0.55 * (1 - t)})`
  for (const index of effect.cells) {
    const { x, y } = cellOrigin(layout, index)
    ctx.beginPath()
    ctx.roundRect(x + 2, y + 2, layout.cellSize - 4, layout.cellSize - 4, layout.cellSize * 0.16)
    ctx.fill()
  }
}

/** Ô bị xoá co lại + mờ dần, kèm chớp trắng lúc đầu. */
function drawClear(ctx: CanvasRenderingContext2D, layout: CanvasLayout, effect: Extract<GameEffect, { kind: "clear" }>, t: number) {
  const eased = easeOutCubic(t)
  const scale = 1 - eased * 0.7
  for (const cell of effect.cells) {
    const { x, y } = cellOrigin(layout, cell.index)
    const size = layout.cellSize * scale
    const offset = (layout.cellSize - size) / 2
    drawBlock(ctx, x + offset, y + offset, size, cell.colorId, 1 - eased)
    if (t < 0.35) {
      ctx.fillStyle = `rgba(255, 255, 255, ${0.6 * (1 - t / 0.35)})`
      ctx.fillRect(x + offset, y + offset, size, size)
    }
  }
}

function drawParticles(
  ctx: CanvasRenderingContext2D,
  layout: CanvasLayout,
  effect: Extract<GameEffect, { kind: "particles" }>,
  t: number
) {
  const seconds = (t * effect.duration) / 1000
  ctx.globalAlpha = 1 - t
  for (const particle of effect.particles) {
    const px = particle.x + particle.vx * seconds
    const py = particle.y + particle.vy * seconds + 0.5 * GRAVITY_CELLS_PER_SEC2 * seconds * seconds
    const size = particle.size * layout.cellSize
    ctx.fillStyle = blockColor(particle.colorId).light
    ctx.fillRect(layout.board.x + px * layout.cellSize - size / 2, layout.board.y + py * layout.cellSize - size / 2, size, size)
  }
  ctx.globalAlpha = 1
}

function drawFloatText(
  ctx: CanvasRenderingContext2D,
  layout: CanvasLayout,
  effect: Extract<GameEffect, { kind: "floatText" }>,
  t: number
) {
  const rise = easeOutCubic(t) * 0.9
  const pop = t < 0.15 ? 0.6 + (t / 0.15) * 0.4 : 1
  const fontSize = layout.cellSize * effect.scale * pop
  const x = layout.board.x + effect.x * layout.cellSize
  const y = layout.board.y + (effect.y - rise) * layout.cellSize

  ctx.globalAlpha = t > 0.7 ? 1 - (t - 0.7) / 0.3 : 1
  ctx.font = `800 ${fontSize}px ${canvasFontFamily}`
  ctx.textAlign = "center"
  ctx.textBaseline = "middle"
  ctx.lineWidth = Math.max(2, fontSize * 0.14)
  ctx.strokeStyle = BOARD_COLORS.textShadow
  ctx.strokeText(effect.text, x, y)
  ctx.fillStyle = "#ffffff"
  ctx.fillText(effect.text, x, y)
  ctx.globalAlpha = 1
}

/** Vẽ hiệu ứng đang chạy (bỏ qua hiệu ứng chưa tới giờ bắt đầu). */
export function drawEffects(ctx: CanvasRenderingContext2D, layout: CanvasLayout, effects: readonly GameEffect[], now: number) {
  for (const effect of effects) {
    if (now < effect.start) continue
    const t = effectProgress(effect, now)
    if (effect.kind === "flash") drawFlash(ctx, layout, effect, t)
    else if (effect.kind === "clear") drawClear(ctx, layout, effect, t)
    else if (effect.kind === "particles") drawParticles(ctx, layout, effect, t)
    else drawFloatText(ctx, layout, effect, t)
  }
}
