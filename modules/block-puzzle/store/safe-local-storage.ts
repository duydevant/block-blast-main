import type { StateStorage } from "zustand/middleware"

/** Dự phòng khi localStorage bị chặn (iframe portal, chặn cookie bên thứ ba, hết dung lượng). */
const memoryFallback = new Map<string, string>()

function browserStorage(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage
  } catch {
    return null
  }
}

/** localStorage không bao giờ throw: lỗi đọc/ghi rơi về bộ nhớ tạm, game vẫn chơi được (chỉ không lưu lâu dài). */
export const safeLocalStorage: StateStorage = {
  getItem: (name) => {
    try {
      const value = browserStorage()?.getItem(name)
      if (value !== null && value !== undefined) return value
    } catch {}
    return memoryFallback.get(name) ?? null
  },
  setItem: (name, value) => {
    memoryFallback.set(name, value)
    try {
      browserStorage()?.setItem(name, value)
    } catch {}
  },
  removeItem: (name) => {
    memoryFallback.delete(name)
    try {
      browserStorage()?.removeItem(name)
    } catch {}
  },
}
