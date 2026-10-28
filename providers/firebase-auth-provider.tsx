"use client"

import { onAuthStateChanged, signInAnonymously } from "firebase/auth"
import { useEffect } from "react"

import { useFirebaseAuthStore } from "@/lib/auth/firebase-auth-store"
import { getFirebaseAuth, isFirebaseConfigured } from "@/lib/firebase/firebase-client-app"

/** Thử đăng nhập khách lại sau khi có mạng trở lại. */
function retryWhenOnline(signIn: () => void): () => void {
  window.addEventListener("online", signIn)
  return () => window.removeEventListener("online", signIn)
}

/**
 * Luôn có một người dùng Firebase: chưa có thì tự đăng nhập khách (Anonymous).
 * Lỗi mạng/Auth chỉ đổi status, không chặn việc chơi (game vẫn chạy offline).
 */
export function FirebaseAuthProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const { setUser, setStatus } = useFirebaseAuthStore.getState()
    if (!isFirebaseConfigured()) {
      setStatus("disabled")
      return
    }

    const auth = getFirebaseAuth()
    const signInAsGuest = () => {
      if (auth.currentUser) return
      signInAnonymously(auth).catch((error: unknown) => {
        console.warn("[auth] anonymous sign-in failed", error)
        setStatus("error")
      })
    }

    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user)
      if (!user) signInAsGuest()
    })
    const stopRetry = retryWhenOnline(signInAsGuest)
    return () => {
      unsubscribe()
      stopRetry()
    }
  }, [])

  return children
}
