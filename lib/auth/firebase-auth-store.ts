import type { User } from "firebase/auth"
import { create } from "zustand"

export interface SignedInPlayer {
  uid: string
  isAnonymous: boolean
  email: string | null
  photoURL: string | null
  /** Tên từ Google (nếu có) — chỉ để gợi ý, tên hiển thị thật nằm ở profile cloud. */
  providerName: string | null
}

interface FirebaseAuthState {
  /** disabled = thiếu config Firebase; error = không đăng nhập khách được (mất mạng...). */
  status: "loading" | "ready" | "error" | "disabled"
  player: SignedInPlayer | null
  setUser: (user: User | null) => void
  setStatus: (status: FirebaseAuthState["status"]) => void
}

export function toSignedInPlayer(user: User): SignedInPlayer {
  return {
    uid: user.uid,
    isAnonymous: user.isAnonymous,
    email: user.email,
    photoURL: user.photoURL,
    providerName: user.displayName,
  }
}

/** Trạng thái đăng nhập Firebase cho UI. Không persist — Firebase Auth tự lưu phiên. */
export const useFirebaseAuthStore = create<FirebaseAuthState>()((set) => ({
  status: "loading",
  player: null,
  setUser: (user) => set({ player: user ? toSignedInPlayer(user) : null, status: user ? "ready" : "loading" }),
  setStatus: (status) => set({ status }),
}))
