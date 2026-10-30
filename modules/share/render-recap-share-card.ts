/** Ảnh tổng kết năm 1080×1080 vẽ bằng code (không asset, không uid): tiêu đề + lưới 6 ô số liệu. */
export interface RecapShareCardContent {
  siteName: string
  /** VD "Năm 2026 của Duy". */
  title: string
  /** Tối đa 6 ô: giá trị to + nhãn nhỏ. */
  stats: { value: string; label: string }[]
  footer: string
}

const SIZE = 1080
const COLUMNS = 2
const TILE_COLORS = ["#2ec4b6", "#4ea8ff", "#ffb547", "#ff7eb6", "#c86bfa", "#9ad94a"]

export async function renderRecapShareCard(content: RecapShareCardContent): Promise<Blob> {
  const canvas = document.createElement("canvas")
  canvas.width = SIZE
  canvas.height = SIZE
  const ctx = canvas.getContext("2d")
  if (!ctx) throw new Error("canvas-unavailable")

  const font = getComputedStyle(document.body).fontFamily || "sans-serif"
  const gradient = ctx.createLinearGradient(0, 0, SIZE, SIZE)
  gradient.addColorStop(0, "#3a2580")
  gradient.addColorStop(1, "#110e27")
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, SIZE, SIZE)

  ctx.textAlign = "center"
  ctx.fillStyle = "#c4b5fd"
  ctx.font = `700 40px ${font}`
  ctx.fillText(content.siteName, SIZE / 2, 90)
  ctx.fillStyle = "#ffffff"
  ctx.font = `800 72px ${font}`
  ctx.fillText(content.title, SIZE / 2, 190)

  const margin = 70
  const gap = 30
  const top = 250
  const tileWidth = (SIZE - margin * 2 - gap * (COLUMNS - 1)) / COLUMNS
  const tileHeight = 200
  content.stats.slice(0, 6).forEach((stat, index) => {
    const x = margin + (index % COLUMNS) * (tileWidth + gap)
    const y = top + Math.floor(index / COLUMNS) * (tileHeight + gap)
    ctx.fillStyle = "rgba(255,255,255,0.08)"
    ctx.beginPath()
    ctx.roundRect(x, y, tileWidth, tileHeight, 36)
    ctx.fill()
    ctx.fillStyle = TILE_COLORS[index % TILE_COLORS.length]
    ctx.font = `800 84px ${font}`
    ctx.fillText(stat.value, x + tileWidth / 2, y + 112)
    ctx.fillStyle = "#e9e5ff"
    ctx.font = `600 34px ${font}`
    ctx.fillText(stat.label, x + tileWidth / 2, y + 165)
  })

  ctx.fillStyle = "#a99fe0"
  ctx.font = `500 34px ${font}`
  ctx.fillText(content.footer, SIZE / 2, SIZE - 50)

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("canvas-export-failed"))), "image/png")
  })
}
