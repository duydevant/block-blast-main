import { create } from "zustand"
import { createJSONStorage, persist } from "zustand/middleware"

import { BLOCK_THEME_IDS, DEFAULT_BLOCK_THEME, type BlockThemeId } from "../render/block-color-palette"
import { safeLocalStorage } from "./safe-local-storage"

export type ColorTheme = BlockThemeId

interface BlockPuzzleSettingsStore {
  sound: boolean
  haptics: boolean
  seenTutorial: boolean
  hasHydrated: boolean
  colorTheme: ColorTheme
  setColorTheme: (value: ColorTheme) => void
  setSound: (value: boolean) => void
  setHaptics: (value: boolean) => void
  markTutorialSeen: () => void
}

/** Cài đặt tách khỏi save game để "ván mới" không reset âm thanh/rung. */
export const useBlockPuzzleSettingsStore = create<BlockPuzzleSettingsStore>()(
  persist(
    (set) => ({
      sound: true,
      haptics: true,
      seenTutorial: false,
      hasHydrated: false,
      colorTheme: DEFAULT_BLOCK_THEME,
      setColorTheme: (colorTheme) => set({ colorTheme }),
      setSound: (sound) => set({ sound }),
      setHaptics: (haptics) => set({ haptics }),
      markTutorialSeen: () => set({ seenTutorial: true }),
    }),
    {
      name: "block-puzzle.settings",
      skipHydration: true,
      storage: createJSONStorage(() => safeLocalStorage),
      partialize: (state) => ({ sound: state.sound, haptics: state.haptics, seenTutorial: state.seenTutorial, colorTheme: state.colorTheme }),
      merge: (persisted, current) => {
        const saved = (persisted ?? {}) as Partial<BlockPuzzleSettingsStore>
        return {
          ...current,
          sound: typeof saved.sound === "boolean" ? saved.sound : current.sound,
          haptics: typeof saved.haptics === "boolean" ? saved.haptics : current.haptics,
          seenTutorial: typeof saved.seenTutorial === "boolean" ? saved.seenTutorial : current.seenTutorial,
          colorTheme: BLOCK_THEME_IDS.includes(saved.colorTheme as ColorTheme) ? saved.colorTheme! : current.colorTheme,
        }
      },
      onRehydrateStorage: () => () => useBlockPuzzleSettingsStore.setState({ hasHydrated: true }),
    }
  )
)
