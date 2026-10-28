import { BLOCK_THEMES, BOARD_COLORS } from "@/modules/block-puzzle/render/block-color-palette"

/** Màu 4 khối trên icon, lấy từ theme mặc định để icon khớp với game. */
const ICON_BLOCKS = [1, 5, 3, 7].map((colorId) => BLOCK_THEMES.classic.colors[colorId])

/**
 * Icon app vẽ bằng JSX cho `next/og` (favicon, apple-icon, icon PWA).
 * `maskable`: nền tràn viền, hình nằm trong vùng an toàn ~60% để launcher cắt tròn/vuông tuỳ ý.
 */
export function AppIconArtwork({ size, maskable = false }: { size: number; maskable?: boolean }) {
  const grid = Math.round(size * (maskable ? 0.5 : 0.62))
  const gap = Math.round(grid * 0.08)
  const cell = Math.floor((grid - gap) / 2)
  const radius = Math.round(cell * 0.2)

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: BOARD_COLORS.panel,
        borderRadius: maskable ? 0 : Math.round(size * 0.22),
      }}
    >
      <div style={{ display: "flex", flexWrap: "wrap", width: cell * 2 + gap, gap }}>
        {ICON_BLOCKS.map((color, index) => (
          <div
            key={index}
            style={{
              width: cell,
              height: cell,
              borderRadius: radius,
              background: `linear-gradient(${color.light}, ${color.base} 60%)`,
              boxShadow: `inset 0 -${Math.max(1, Math.round(cell * 0.12))}px 0 ${color.dark}`,
            }}
          />
        ))}
      </div>
    </div>
  )
}
