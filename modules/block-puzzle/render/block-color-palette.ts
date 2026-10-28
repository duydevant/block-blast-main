import { BLOCK_COLOR_COUNT } from "../engine/game-types"

export interface BlockColor {
  base: string
  light: string
  dark: string
}

export type BlockStyle = "glossy" | "flat" | "neon"

export interface BlockTheme {
  style: BlockStyle
  /** Index 1..BLOCK_COLOR_COUNT theo colorId; index 0 không dùng. */
  colors: readonly BlockColor[]
}

const color = (base: string, light: string, dark: string): BlockColor => ({ base, light, dark })
const UNUSED = color("#000000", "#000000", "#000000")

/** Bộ theme riêng của game; thêm theme = thêm một entry ở đây + id trong settings store. */
export const BLOCK_THEMES = {
  classic: {
    style: "glossy",
    colors: [UNUSED,
      color("#ff6b6b", "#ffa3a3", "#c23b4b"), color("#ffb547", "#ffd98f", "#c97a1c"),
      color("#9ad94a", "#c8f28a", "#5f9a22"), color("#2ec4b6", "#7fe8dd", "#138a80"),
      color("#4ea8ff", "#9fd0ff", "#2369c4"), color("#7b6cff", "#b4abff", "#4a3cc4"),
      color("#c86bfa", "#e5adff", "#8a35bf"), color("#ff7eb6", "#ffb8d7", "#c94480")],
  },
  candy: {
    style: "glossy",
    colors: [UNUSED,
      color("#ff9aa2", "#ffd0d4", "#d9606b"), color("#ffdac1", "#fff0e5", "#d9a17a"),
      color("#e2f0cb", "#f6fbec", "#a9c482"), color("#b5ead7", "#e3f8f0", "#73bfa3"),
      color("#9ad1ff", "#d4ecff", "#5c9fd6"), color("#c7ceea", "#e9ecf8", "#8e98c9"),
      color("#e0bbe4", "#f3e2f5", "#ad7fb3"), color("#ffc8dd", "#ffe6ef", "#d98aa9")],
  },
  ocean: {
    style: "flat",
    colors: [UNUSED,
      color("#0ead69", "#4fd49a", "#087a49"), color("#00b4d8", "#5fd6ee", "#0083a0"),
      color("#0077b6", "#4aa3d6", "#005282"), color("#48cae4", "#90e0ef", "#1d98b3"),
      color("#3a86ff", "#82b1ff", "#1f5fcc"), color("#06d6a0", "#5ef0c8", "#049c74"),
      color("#118ab2", "#5fb4d3", "#0b6482"), color("#90e0ef", "#caf0f8", "#58b3c7")],
  },
  neon: {
    style: "neon",
    colors: [UNUSED,
      color("#ff3cac", "#ff8fd0", "#a3156b"), color("#ffe74c", "#fff3a3", "#a89618"),
      color("#3cff9d", "#9effcd", "#18a862"), color("#2bd2ff", "#93e9ff", "#1586a6"),
      color("#784ba0", "#b48ad9", "#4a2c66"), color("#ff8a3c", "#ffbf93", "#a8521b"),
      color("#2b86c5", "#7fbbe6", "#1a5480"), color("#f9f871", "#fcfcb8", "#a3a24a")],
  },
  // Theme phần thưởng (mở bằng cấp/xu/mời bạn — xem modules/progression/theme-unlock-rules.ts).
  sunset: {
    style: "glossy",
    colors: [UNUSED,
      color("#ff5e5b", "#ff9e9c", "#c2302e"), color("#ff9f43", "#ffc994", "#c96d17"),
      color("#ffd166", "#ffe6a8", "#c99a2e"), color("#f78fb3", "#fbc3d7", "#c2587d"),
      color("#c56cf0", "#e0aef7", "#8a3bb5"), color("#ff7f50", "#ffb397", "#c4502a"),
      color("#e15f41", "#ee9a87", "#a83a22"), color("#f3a683", "#f8cbb6", "#bd7553")],
  },
  forest: {
    style: "flat",
    colors: [UNUSED,
      color("#6a994e", "#9cc283", "#46692f"), color("#a7c957", "#cde08f", "#76913a"),
      color("#386641", "#6b9973", "#21452a"), color("#bc6c25", "#d9995f", "#874813"),
      color("#dda15e", "#ecc697", "#a87437"), color("#8d9f3b", "#b8c776", "#617024"),
      color("#4f772d", "#80a35c", "#33521a"), color("#c9b26b", "#e0d2a2", "#94803f")],
  },
  galaxy: {
    style: "neon",
    colors: [UNUSED,
      color("#b388ff", "#d9c4ff", "#6a3fc4"), color("#40c4ff", "#9be2ff", "#1a85b3"),
      color("#ff4081", "#ff9fbf", "#b3194f"), color("#7c4dff", "#b9a1ff", "#4a24b8"),
      color("#18ffff", "#9effff", "#0fa8a8"), color("#ea80fc", "#f5c0fd", "#a640b8"),
      color("#536dfe", "#a3b2ff", "#2a3fb8"), color("#ffd740", "#ffeba0", "#b39220")],
  },
  gold: {
    style: "glossy",
    colors: [UNUSED,
      color("#ffd700", "#ffeb80", "#b39700"), color("#f4c430", "#f9e08f", "#b08a17"),
      color("#e6be8a", "#f2dcbd", "#a8864f"), color("#d4af37", "#e8d08a", "#977b1f"),
      color("#ffbf00", "#ffdd80", "#b38600"), color("#c9a227", "#e2c97a", "#8f7215"),
      color("#ffe066", "#fff0b3", "#b39c3d"), color("#b8860b", "#d9b354", "#7d5a05")],
  },
} as const satisfies Record<string, BlockTheme>

export type BlockThemeId = keyof typeof BLOCK_THEMES
export const BLOCK_THEME_IDS = Object.keys(BLOCK_THEMES) as BlockThemeId[]
export const DEFAULT_BLOCK_THEME: BlockThemeId = "classic"

export const BOARD_COLORS = {
  panel: "#15122d",
  panelEdge: "#3b3375",
  emptyCell: "#221e45",
  emptyCellEdge: "#2b2655",
  lineHighlight: "rgba(255, 255, 255, 0.16)",
  slot: "#1f1b40",
  slotEdge: "#3f3780",
  slotIcon: "#8f86d6",
  textShadow: "rgba(0, 0, 0, 0.45)",
} as const

export function blockColor(colorId: number, theme: BlockTheme = BLOCK_THEMES[DEFAULT_BLOCK_THEME]): BlockColor {
  const index = colorId >= 1 && colorId <= BLOCK_COLOR_COUNT ? colorId : 1
  return theme.colors[index] ?? theme.colors[1]
}
