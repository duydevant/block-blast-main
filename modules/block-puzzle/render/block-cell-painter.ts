import { BLOCK_THEMES, BOARD_COLORS, blockColor, DEFAULT_BLOCK_THEME, type BlockThemeId } from "./block-color-palette"
import { drawColorblindGlyph } from "./colorblind-glyphs"

/** Khối vẽ hoàn toàn bằng code (không sprite) theo theme đang chọn. */
let activeTheme: BlockThemeId = DEFAULT_BLOCK_THEME
/** Vẽ thêm ký hiệu theo màu (cài đặt mù màu). */
let colorblindMarks = false

export function setBlockTheme(theme: BlockThemeId) {
  activeTheme = theme in BLOCK_THEMES ? theme : DEFAULT_BLOCK_THEME
}

export function setColorblindMarks(enabled: boolean) {
  colorblindMarks = enabled
}

type Ctx2D = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D

function roundedRect(ctx: Ctx2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath()
  ctx.roundRect(x, y, w, h, r)
}

/** Vẽ trực tiếp một khối (chậm hơn: gradient/shadow mỗi lần) — dùng để dựng ảnh cache. */
function paintBlock(ctx: Ctx2D, x: number, y: number, size: number, colorId: number, alpha = 1) {
  const theme = BLOCK_THEMES[activeTheme]
  const color = blockColor(colorId, theme)
  const inset = size * 0.04
  const s = size - inset * 2
  const radius = s * 0.2
  const left = x + inset
  const top = y + inset
  ctx.save()
  ctx.globalAlpha *= alpha

  if (theme.style === "neon") {
    // Viền phát sáng, lõi tối.
    roundedRect(ctx, left, top, s, s, radius)
    ctx.fillStyle = color.dark
    ctx.shadowColor = color.base
    ctx.shadowBlur = s * 0.35
    ctx.fill()
    ctx.shadowBlur = 0
    ctx.lineWidth = Math.max(1, s * 0.1)
    ctx.strokeStyle = color.light
    roundedRect(ctx, left + s * 0.08, top + s * 0.08, s * 0.84, s * 0.84, radius * 0.8)
    ctx.stroke()
  } else {
    // Thân khối + bóng đáy.
    roundedRect(ctx, left, top, s, s, radius)
    ctx.fillStyle = color.dark
    ctx.fill()
    roundedRect(ctx, left, top, s, s * 0.9, radius)
    if (theme.style === "glossy") {
      const gradient = ctx.createLinearGradient(0, top, 0, top + s)
      gradient.addColorStop(0, color.light)
      gradient.addColorStop(0.55, color.base)
      ctx.fillStyle = gradient
    } else {
      ctx.fillStyle = color.base
    }
    ctx.fill()
    // Vệt sáng góc trên.
    ctx.globalAlpha *= theme.style === "glossy" ? 0.55 : 0.3
    roundedRect(ctx, left + s * 0.16, top + s * 0.12, s * 0.42, s * 0.14, s * 0.07)
    ctx.fillStyle = "#ffffff"
    ctx.fill()
  }
  ctx.restore()
  if (colorblindMarks) {
    ctx.save()
    ctx.globalAlpha *= alpha
    drawColorblindGlyph(ctx, left, top, s, colorId)
    ctx.restore()
  }
}

/** Ảnh khối đã dựng sẵn theo (theme, màu, cỡ px thiết bị) — vẽ lại mỗi frame chỉ còn drawImage. */
const blockImageCache = new Map<string, { image: CanvasImageSource; pad: number }>()
/** Cỡ khối đổi liên tục khi có animation → giới hạn số ảnh, đầy thì xoá hết dựng lại. */
const MAX_CACHED_BLOCKS = 300

function createScratchCanvas(size: number): HTMLCanvasElement | OffscreenCanvas | null {
  if (typeof OffscreenCanvas !== "undefined") return new OffscreenCanvas(size, size)
  if (typeof document === "undefined") return null
  const canvas = document.createElement("canvas")
  canvas.width = size
  canvas.height = size
  return canvas
}

function cachedBlockImage(colorId: number, devicePixels: number) {
  const key = `${activeTheme}|${colorblindMarks ? "m" : ""}|${colorId}|${devicePixels}`
  let entry = blockImageCache.get(key)
  if (!entry) {
    // Chừa lề cho quầng sáng của theme neon.
    const pad = Math.ceil(devicePixels * 0.4)
    const canvas = createScratchCanvas(devicePixels + pad * 2)
    const ctx = canvas?.getContext("2d") as Ctx2D | null | undefined
    if (!canvas || !ctx) return null
    paintBlock(ctx, pad, pad, devicePixels, colorId)
    if (blockImageCache.size >= MAX_CACHED_BLOCKS) blockImageCache.clear()
    entry = { image: canvas, pad }
    blockImageCache.set(key, entry)
  }
  return entry
}

export function drawBlock(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, colorId: number, alpha = 1) {
  // Canvas chính đã setTransform(dpr) → quy cỡ CSS ra px thiết bị để ảnh cache nét.
  const scale = ctx.getTransform().a || 1
  const devicePixels = Math.round(size * scale)
  const entry = devicePixels >= 2 ? cachedBlockImage(colorId, devicePixels) : null
  if (!entry) return paintBlock(ctx, x, y, size, colorId, alpha)
  const pad = entry.pad / scale
  const drawn = devicePixels / scale + pad * 2
  ctx.save()
  ctx.globalAlpha *= alpha
  ctx.drawImage(entry.image, x - pad, y - pad, drawn, drawn)
  ctx.restore()
}

export function drawEmptyCell(ctx: CanvasRenderingContext2D, x: number, y: number, size: number) {
  const inset = size * 0.05
  roundedRect(ctx, x + inset, y + inset, size - inset * 2, size - inset * 2, size * 0.16)
  ctx.fillStyle = BOARD_COLORS.emptyCell
  ctx.fill()
  ctx.lineWidth = Math.max(1, size * 0.03)
  ctx.strokeStyle = BOARD_COLORS.emptyCellEdge
  ctx.stroke()
}

export function drawGhostCell(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, colorId: number) {
  drawBlock(ctx, x, y, size, colorId, 0.4)
}
