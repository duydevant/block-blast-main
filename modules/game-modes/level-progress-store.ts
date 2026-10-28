import { useEffect } from "react"
import { create } from "zustand"
import { createJSONStorage, persist } from "zustand/middleware"

import { safeLocalStorage } from "@/modules/block-puzzle/store/safe-local-storage"
import { usePlayerProfileQuery } from "@/modules/player-profile/use-player-profile-query"

import { LEVEL_COUNT } from "./level-catalog"

interface LevelProgressStore {
  /** Màn → số sao cao nhất đạt được trên máy này (kể cả chơi offline). */
  stars: Record<string, number>
  recordStars: (levelId: number, stars: number) => void
}

/** Sao màn chơi lưu trên máy; gộp với sao server đã xác nhận (profile) khi hiển thị. */
export const useLevelProgressStore = create<LevelProgressStore>()(
  persist(
    (set, get) => ({
      stars: {},
      recordStars: (levelId, stars) => {
        const key = String(levelId)
        if (stars <= (get().stars[key] ?? 0)) return
        set({ stars: { ...get().stars, [key]: stars } })
      },
    }),
    {
      name: "block-puzzle.levels",
      // Đọc localStorage sau khi mount (như các store khác) để HTML server/client khớp nhau.
      skipHydration: true,
      storage: createJSONStorage(() => safeLocalStorage),
      merge: (persisted, current) => {
        const saved = (persisted as { stars?: unknown } | undefined)?.stars
        const stars: Record<string, number> = {}
        if (saved && typeof saved === "object") {
          for (const [key, value] of Object.entries(saved)) {
            const id = Number(key)
            if (Number.isInteger(id) && id >= 1 && id <= LEVEL_COUNT && Number.isInteger(value) && value >= 1 && value <= 3) stars[key] = value
          }
        }
        return { ...current, stars }
      },
    }
  )
)

/** Sao từng màn: lấy cao hơn giữa máy này và server. */
export function useLevelStars(): Record<string, number> {
  useEffect(() => {
    void useLevelProgressStore.persist.rehydrate()
  }, [])
  const local = useLevelProgressStore((state) => state.stars)
  const server = usePlayerProfileQuery().data?.levelStars
  if (!server) return local
  const merged = { ...server }
  for (const [key, value] of Object.entries(local)) merged[key] = Math.max(merged[key] ?? 0, value)
  return merged
}
