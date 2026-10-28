import { BOARD_SIZE, type BoardCells } from "@/modules/block-puzzle/engine/game-types"
import { BLOCK_THEMES, BOARD_COLORS, type BlockThemeId, blockColor } from "@/modules/block-puzzle/render/block-color-palette"

export interface ShareCardContent {
  siteName: string
  /** Dòng nhỏ phía trên điểm, VD "Thử thách 27/10" hoặc "Điểm". */
  label: string
  score: string
  /** Dòng dưới điểm, VD "Kỷ lục mới!" / "Vượt được không?". */
  caption: string
  footer: string
  /** null = không vẽ bàn (daily: tránh lộ chuỗi khối cho người chưa chơi). */
  board: BoardCells | null
  themeId: BlockThemeId
}

const SIZE = 1080

function roundedRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath()
  ctx.roundRect(x, y, w, h, r)
  ctx.fill()
}

function drawBoard(ctx: CanvasRenderingContext2D, board: BoardCells, themeId: BlockThemeId, x: number, y: number, size: number) {
  const theme = BLOCK_THEMES[themeId]
  const gap = size * 0.012
  const cell = (size - gap * (BOARD_SIZE + 1)) / BOARD_SIZE
  ctx.fillStyle = BOARD_COLORS.panel
  roundedRect(ctx, x, y, size, size, size * 0.04)
  for (let row = 0; row < BOARD_SIZE; row++) {
    for (let col = 0; col < BOARD_SIZE; col++) {
      const colorId = board[row * BOARD_SIZE + col]
      const cx = x + gap + col * (cell + gap)
      const cy = y + gap + row * (cell + gap)
      if (colorId === 0) {
        ctx.fillStyle = BOARD_COLORS.emptyCell
        roundedRect(ctx, cx, cy, cell, cell, cell * 0.18)
        continue
      }
      const color = blockColor(colorId, theme)
      ctx.fillStyle = color.dark
      roundedRect(ctx, cx, cy, cell, cell, cell * 0.18)
      ctx.fillStyle = color.base
      roundedRect(ctx, cx, cy, cell, cell * 0.86, cell * 0.18)
    }
  }
}

/** Ảnh vuông 1080×1080 vẽ hoàn toàn bằng code (không asset), dùng font đang dùng trên trang. */
export async function renderResultShareCard(content: ShareCardContent): Promise<Blob> {
  const canvas = document.createElement("canvas")
  canvas.width = SIZE
  canvas.height = SIZE
  const ctx = canvas.getContext("2d")
  if (!ctx) throw new Error("canvas-unavailable")

  const font = getComputedStyle(document.body).fontFamily || "sans-serif"
  const gradient = ctx.createLinearGradient(0, 0, 0, SIZE)
  gradient.addColorStop(0, "#2f2468")
  gradient.addColorStop(1, "#110e27")
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, SIZE, SIZE)

  ctx.textAlign = "center"
  ctx.fillStyle = "#c4b5fd"
  ctx.font = `700 44px ${font}`
  ctx.fillText(content.siteName, SIZE / 2, 96)

  const hasBoard = content.board !== null
  const scoreY = hasBoard ? 300 : 520
  ctx.fillStyle = "#e9e5ff"
  ctx.font = `600 40px ${font}`
  ctx.fillText(content.label, SIZE / 2, scoreY - 130)
  ctx.fillStyle = "#ffffff"
  ctx.font = `800 ${hasBoard ? 150 : 200}px ${font}`
  ctx.fillText(content.score, SIZE / 2, scoreY)
  ctx.fillStyle = "#fcd34d"
  ctx.font = `700 46px ${font}`
  ctx.fillText(content.caption, SIZE / 2, scoreY + (hasBoard ? 80 : 110))

  if (content.board) drawBoard(ctx, content.board, content.themeId, (SIZE - 560) / 2, 430, 560)

  ctx.fillStyle = "#a99fe0"
  ctx.font = `500 34px ${font}`
  ctx.fillText(content.footer, SIZE / 2, SIZE - 50)

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("canvas-export-failed"))), "image/png")
  })
}
