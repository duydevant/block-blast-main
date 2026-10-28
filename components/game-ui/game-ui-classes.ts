/**
 * Bộ class giao diện game dùng chung (theo bản thiết kế: nền tím đậm, nút "dày" có bóng đáy, mỗi chế độ một màu).
 * Class phải là chuỗi tĩnh để Tailwind sinh được — thêm màu mới thì thêm cả chuỗi ở đây.
 */

/** Nút to có bóng đáy (cảm giác bấm được), chữ font tròn. */
const CHUNKY =
  "inline-flex items-center justify-center gap-2 rounded-2xl font-heading font-extrabold transition active:translate-y-0.5 disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-5 [&_svg]:shrink-0"

export const CHUNKY_BUTTON = {
  /** Hành động chính (chơi, ván mới). */
  primary: `${CHUNKY} bg-[#ffb547] text-[#2a1600] shadow-[0_5px_0_#b8561d] hover:brightness-105 active:shadow-[0_2px_0_#b8561d]`,
  /** Hồi sinh / thành công. */
  success: `${CHUNKY} bg-[#2ec4b6] text-[#04211e] shadow-[0_5px_0_#138a80] hover:brightness-105 active:shadow-[0_2px_0_#138a80]`,
  /** Nút phụ trên nền tím. */
  secondary: `${CHUNKY} bg-[#2a2459] text-white shadow-[0_4px_0_#1a1540] hover:bg-[#332c6b] active:shadow-[0_2px_0_#1a1540]`,
} as const

/** Màu riêng từng chế độ: nền thẻ, viền/nhấn, chữ phụ, chữ trên nút nhấn. */
export const MODE_THEME = {
  daily: {
    card: "bg-[#3a2412] border-2 border-[#ff8a3d]",
    icon: "bg-[#ff8a3d] text-[#2a1600]",
    soft: "text-[#ffd9b8]",
    accentText: "text-[#ff8a3d]",
    button: `${CHUNKY} bg-[#ff8a3d] text-[#2a1600] shadow-[0_5px_0_#b8561d] hover:brightness-105`,
  },
  levels: {
    card: "bg-[#13284a]",
    icon: "bg-[#4ea8ff] text-[#061a33]",
    soft: "text-[#a9cdf5]",
    accentText: "text-[#4ea8ff]",
    button: `${CHUNKY} bg-[#4ea8ff] text-[#061a33] shadow-[0_5px_0_#2369c4] hover:brightness-105`,
  },
  duel: {
    card: "bg-[#3d1530]",
    icon: "bg-[#ff7eb6] text-[#3a0620]",
    soft: "text-[#f5b3d1]",
    accentText: "text-[#ff7eb6]",
    button: `${CHUNKY} bg-[#ff7eb6] text-[#3a0620] shadow-[0_5px_0_#c94480] hover:brightness-105`,
  },
  event: {
    card: "bg-[#2a1748]",
    icon: "bg-[#c86bfa] text-[#22062f]",
    soft: "text-[#dcb6f5]",
    accentText: "text-[#c86bfa]",
    button: `${CHUNKY} bg-[#c86bfa] text-[#22062f] shadow-[0_5px_0_#8a35bf] hover:brightness-105`,
  },
  ranking: {
    card: "bg-[#10322f]",
    icon: "bg-[#2ec4b6] text-[#04211e]",
    soft: "text-[#9fe3db]",
    accentText: "text-[#2ec4b6]",
    button: `${CHUNKY} bg-[#2ec4b6] text-[#04211e] shadow-[0_5px_0_#138a80] hover:brightness-105`,
  },
} as const

export type GameMode = keyof typeof MODE_THEME

/** Thẻ/ô nền tím chuẩn. */
export const PANEL = "rounded-3xl bg-card text-card-foreground"
/** Viên thuốc nhỏ (chip số liệu). */
export const PILL = "inline-flex items-center gap-1.5 rounded-full bg-secondary px-3 py-1.5 text-sm font-bold"
/** Nút vuông chỉ có icon (quay lại, menu). */
export const ICON_TILE =
  "inline-flex size-11 shrink-0 items-center justify-center rounded-2xl bg-[#221d4a] text-[#e3defc] transition hover:bg-[#2c2660] [&_svg]:size-5.5"
