import { create } from "zustand"
import { createJSONStorage, persist } from "zustand/middleware"

import { BLOCK_THEME_IDS, DEFAULT_BLOCK_THEME, type BlockThemeId } from "../render/block-color-palette"
import { safeLocalStorage } from "./safe-local-storage"

export type ColorTheme = BlockThemeId

/** Khối nhấc lên trên ngón tay bao nhiêu khi kéo bằng cảm ứng. */
export const DRAG_LIFT_OPTIONS = ["low", "normal", "high"] as const
export type DragLift = (typeof DRAG_LIFT_OPTIONS)[number]
/** Số ô tương ứng từng mức nâng khối. */
export const DRAG_LIFT_CELLS: Record<DragLift, number> = { low: 1, normal: 1.6, high: 2.4 }

/** "system" = theo cài đặt giảm chuyển động của máy. */
export const REDUCE_MOTION_OPTIONS = ["system", "on", "off"] as const
export type ReduceMotion = (typeof REDUCE_MOTION_OPTIONS)[number]

interface BlockPuzzleSettingsStore {
  sound: boolean
  haptics: boolean
  seenTutorial: boolean
  hasHydrated: boolean
  colorTheme: ColorTheme
  dragLift: DragLift
  /** Vẽ thêm ký hiệu riêng cho từng màu khối (người khó phân biệt màu). */
  colorblindMarks: boolean
  reduceMotion: ReduceMotion
  /** Đổi màu các dòng sắp xoá khi đang kéo khối tới chỗ đặt được. */
  linePreview: boolean
  /** Ẩn emote của đối thủ trong phòng đấu 1v1. */
  hideOpponentEmotes: boolean
  setColorTheme: (value: ColorTheme) => void
  setSound: (value: boolean) => void
  setHaptics: (value: boolean) => void
  setDragLift: (value: DragLift) => void
  setColorblindMarks: (value: boolean) => void
  setReduceMotion: (value: ReduceMotion) => void
  setLinePreview: (value: boolean) => void
  setHideOpponentEmotes: (value: boolean) => void
  markTutorialSeen: () => void
}

const oneOf = <T extends string>(options: readonly T[], value: unknown, fallback: T): T =>
  options.includes(value as T) ? (value as T) : fallback
const booleanOr = (value: unknown, fallback: boolean) => (typeof value === "boolean" ? value : fallback)

/** Cài đặt tách khỏi save game để "ván mới" không reset âm thanh/rung. */
export const useBlockPuzzleSettingsStore = create<BlockPuzzleSettingsStore>()(
  persist(
    (set) => ({
      sound: true,
      haptics: true,
      seenTutorial: false,
      hasHydrated: false,
      colorTheme: DEFAULT_BLOCK_THEME,
      dragLift: "normal",
      colorblindMarks: false,
      reduceMotion: "system",
      linePreview: true,
      hideOpponentEmotes: false,
      setColorTheme: (colorTheme) => set({ colorTheme }),
      setSound: (sound) => set({ sound }),
      setHaptics: (haptics) => set({ haptics }),
      setDragLift: (dragLift) => set({ dragLift }),
      setColorblindMarks: (colorblindMarks) => set({ colorblindMarks }),
      setReduceMotion: (reduceMotion) => set({ reduceMotion }),
      setLinePreview: (linePreview) => set({ linePreview }),
      setHideOpponentEmotes: (hideOpponentEmotes) => set({ hideOpponentEmotes }),
      markTutorialSeen: () => set({ seenTutorial: true }),
    }),
    {
      name: "block-puzzle.settings",
      skipHydration: true,
      storage: createJSONStorage(() => safeLocalStorage),
      partialize: (state) => ({
        sound: state.sound,
        haptics: state.haptics,
        seenTutorial: state.seenTutorial,
        colorTheme: state.colorTheme,
        dragLift: state.dragLift,
        colorblindMarks: state.colorblindMarks,
        reduceMotion: state.reduceMotion,
        linePreview: state.linePreview,
        hideOpponentEmotes: state.hideOpponentEmotes,
      }),
      merge: (persisted, current) => {
        const saved = (persisted ?? {}) as Partial<BlockPuzzleSettingsStore>
        return {
          ...current,
          sound: booleanOr(saved.sound, current.sound),
          haptics: booleanOr(saved.haptics, current.haptics),
          seenTutorial: booleanOr(saved.seenTutorial, current.seenTutorial),
          colorTheme: oneOf(BLOCK_THEME_IDS, saved.colorTheme, current.colorTheme),
          dragLift: oneOf(DRAG_LIFT_OPTIONS, saved.dragLift, current.dragLift),
          colorblindMarks: booleanOr(saved.colorblindMarks, current.colorblindMarks),
          reduceMotion: oneOf(REDUCE_MOTION_OPTIONS, saved.reduceMotion, current.reduceMotion),
          linePreview: booleanOr(saved.linePreview, current.linePreview),
          hideOpponentEmotes: booleanOr(saved.hideOpponentEmotes, current.hideOpponentEmotes),
        }
      },
      onRehydrateStorage: () => () => useBlockPuzzleSettingsStore.setState({ hasHydrated: true }),
    }
  )
)

/** Có giảm chuyển động không: theo cài đặt, "system" thì theo máy (`prefers-reduced-motion`). */
export function resolveReducedMotion(mode: ReduceMotion, systemPrefersReduced: boolean): boolean {
  return mode === "on" || (mode === "system" && systemPrefersReduced)
}
