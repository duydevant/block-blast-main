import { BLOCK_THEMES, BOARD_COLORS } from "@/modules/block-puzzle/render/block-color-palette"

/**
 * Bàn mini minh hoạ (trang chủ, cách chơi): mỗi dòng là chuỗi ký tự — "1".."8" = màu khối,
 * "." = ô trống, "+" = ô gợi ý đặt khối (viền cam), "*" = ô đang xoá (sáng trắng).
 */
export function BlockBoardPreview({ rows, cellGap = 4, className = "" }: { rows: readonly string[]; cellGap?: number; className?: string }) {
  const size = rows.length
  const colors = BLOCK_THEMES.classic.colors
  return (
    <div
      aria-hidden="true"
      className={`grid rounded-2xl p-2 ${className}`}
      style={{ gridTemplateColumns: `repeat(${size}, minmax(0, 1fr))`, gap: cellGap, background: BOARD_COLORS.panel }}
    >
      {rows.join("").split("").map((char, index) => {
        const colorId = Number(char)
        const style: React.CSSProperties =
          char === "+"
            ? { border: "2px dashed #ffb547" }
            : char === "*"
              ? { background: "#ffffff", boxShadow: "0 0 10px #ffe9b5" }
              : colorId >= 1 && colorId <= 8
                ? { background: colors[colorId].base, boxShadow: `inset 0 -3px 0 ${colors[colorId].dark}` }
                : { background: BOARD_COLORS.emptyCell }
        return <span key={index} className="aspect-square rounded-[22%]" style={style} />
      })}
    </div>
  )
}
