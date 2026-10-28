import { create } from "zustand"

/** Sự kiện cài PWA của Chromium (chưa có trong lib.dom). */
export interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>
}

interface InstallPromptStore {
  /** Có giá trị khi trình duyệt cho phép cài (Chromium); null trên iOS/Firefox hoặc đã cài. */
  deferredPrompt: BeforeInstallPromptEvent | null
  setDeferredPrompt: (event: BeforeInstallPromptEvent | null) => void
}

export const useInstallPromptStore = create<InstallPromptStore>()((set) => ({
  deferredPrompt: null,
  setDeferredPrompt: (deferredPrompt) => set({ deferredPrompt }),
}))
