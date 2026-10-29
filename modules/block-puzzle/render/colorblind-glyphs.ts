import { BLOCK_COLOR_COUNT } from "../engine/game-types"

type Ctx2D = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D

/** Ký hiệu cho từng màu khối (colorId 1..8) — người khó phân biệt màu nhận khối bằng hình. */
export const COLORBLIND_GLYPHS = ["dot", "triangle", "square", "diamond", "star", "cross", "heart", "hexagon"] as const
export type ColorblindGlyph = (typeof COLORBLIND_GLYPHS)[number]

export function glyphForColor(colorId: number): ColorblindGlyph {
  const index = (((Math.floor(colorId) - 1) % BLOCK_COLOR_COUNT) + BLOCK_COLOR_COUNT) % BLOCK_COLOR_COUNT
  return COLORBLIND_GLYPHS[index]
}

/** Đa giác đều `sides` cạnh tâm (cx, cy), bán kính r, đỉnh đầu hướng lên. */
function regularPolygon(ctx: Ctx2D, cx: number, cy: number, r: number, sides: number, rotation = -Math.PI / 2) {
  for (let i = 0; i < sides; i++) {
    const angle = rotation + (i * Math.PI * 2) / sides
    const x = cx + Math.cos(angle) * r
    const y = cy + Math.sin(angle) * r
    if (i === 0) ctx.moveTo(x, y)
    else ctx.lineTo(x, y)
  }
  ctx.closePath()
}

function tracePath(ctx: Ctx2D, glyph: ColorblindGlyph, cx: number, cy: number, r: number) {
  switch (glyph) {
    case "dot":
      ctx.arc(cx, cy, r * 0.6, 0, Math.PI * 2)
      return
    case "triangle":
      return regularPolygon(ctx, cx, cy + r * 0.12, r, 3)
    case "square":
      ctx.rect(cx - r * 0.72, cy - r * 0.72, r * 1.44, r * 1.44)
      return
    case "diamond":
      return regularPolygon(ctx, cx, cy, r, 4)
    case "star":
      for (let i = 0; i < 10; i++) {
        const angle = -Math.PI / 2 + (i * Math.PI) / 5
        const radius = i % 2 === 0 ? r : r * 0.45
        const x = cx + Math.cos(angle) * radius
        const y = cy + Math.sin(angle) * radius
        if (i === 0) ctx.moveTo(x, y)
        else ctx.lineTo(x, y)
      }
      ctx.closePath()
      return
    case "cross": {
      // Một đường viền 12 đỉnh (không chồng hai hình chữ nhật) để nét viền không cắt ngang tâm.
      const a = r * 0.32
      const points = [[-a, -r], [a, -r], [a, -a], [r, -a], [r, a], [a, a], [a, r], [-a, r], [-a, a], [-r, a], [-r, -a], [-a, -a]]
      points.forEach(([dx, dy], i) => (i === 0 ? ctx.moveTo(cx + dx, cy + dy) : ctx.lineTo(cx + dx, cy + dy)))
      ctx.closePath()
      return
    }
    case "heart":
      ctx.moveTo(cx, cy + r * 0.85)
      ctx.bezierCurveTo(cx - r * 1.3, cy, cx - r * 0.75, cy - r * 1.05, cx, cy - r * 0.4)
      ctx.bezierCurveTo(cx + r * 0.75, cy - r * 1.05, cx + r * 1.3, cy, cx, cy + r * 0.85)
      ctx.closePath()
      return
    case "hexagon":
      return regularPolygon(ctx, cx, cy, r, 6, 0)
  }
}

/**
 * Vẽ ký hiệu giữa mặt khối (vùng mặt = cạnh `faceSize`, góc trên-trái `left, top`).
 * Nền trắng mờ + viền tối để nổi trên mọi màu/theme.
 */
export function drawColorblindGlyph(ctx: Ctx2D, left: number, top: number, faceSize: number, colorId: number) {
  const cx = left + faceSize / 2
  // Mặt khối chiếm ~90% chiều cao (phần dưới là bóng đáy).
  const cy = top + faceSize * 0.45
  const r = faceSize * 0.2
  ctx.save()
  ctx.beginPath()
  tracePath(ctx, glyphForColor(colorId), cx, cy, r)
  ctx.fillStyle = "rgba(255, 255, 255, 0.85)"
  ctx.fill()
  ctx.lineWidth = Math.max(1, faceSize * 0.045)
  ctx.strokeStyle = "rgba(20, 16, 48, 0.75)"
  ctx.stroke()
  ctx.restore()
}
