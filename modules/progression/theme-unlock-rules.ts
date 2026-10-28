import { BLOCK_THEME_IDS, type BlockThemeId } from "@/modules/block-puzzle/render/block-color-palette"

/** Cách có được một theme. Theme chỉ là đồ ngắm — không ảnh hưởng điểm hay bảng xếp hạng. */
export type ThemeUnlock =
  | { kind: "free" }
  | { kind: "level"; level: number }
  | { kind: "coins"; price: number }
  /** Chỉ có qua mời bạn (người mời và người được mời). */
  | { kind: "referral" }

export const THEME_UNLOCKS: Record<BlockThemeId, ThemeUnlock> = {
  // 4 theme cũ giữ miễn phí để không lấy lại đồ người chơi đã có.
  classic: { kind: "free" },
  candy: { kind: "free" },
  ocean: { kind: "free" },
  neon: { kind: "free" },
  sunset: { kind: "level", level: 5 },
  forest: { kind: "coins", price: 300 },
  galaxy: { kind: "coins", price: 800 },
  gold: { kind: "referral" },
}

/** Theme mời bạn tặng cho cả hai bên. */
export const REFERRAL_THEME: BlockThemeId = "gold"

export function isBlockThemeId(value: string): value is BlockThemeId {
  return (BLOCK_THEME_IDS as string[]).includes(value)
}

export interface ThemeOwnership {
  level: number
  unlockedThemes: readonly string[]
}

/** Chưa tải được profile → chỉ theme miễn phí. */
export const NO_THEME_OWNERSHIP: ThemeOwnership = { level: 1, unlockedThemes: [] }

export function isThemeOwned(themeId: BlockThemeId, owner: ThemeOwnership): boolean {
  const unlock = THEME_UNLOCKS[themeId]
  if (unlock.kind === "free") return true
  if (unlock.kind === "level") return owner.level >= unlock.level
  return owner.unlockedThemes.includes(themeId)
}
