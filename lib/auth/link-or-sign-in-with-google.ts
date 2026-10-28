import { FirebaseError } from "firebase/app"
import { GoogleAuthProvider, linkWithPopup, signInWithCredential, signInWithPopup, signOut } from "firebase/auth"

import { getFirebaseAuth } from "@/lib/firebase/firebase-client-app"

import { useFirebaseAuthStore } from "./firebase-auth-store"

export type GoogleLinkOutcome = "linked" | "switched" | "cancelled"

const CANCELLED_CODES = new Set(["auth/popup-closed-by-user", "auth/cancelled-popup-request", "auth/user-cancelled"])

/**
 * Gắn Google vào tài khoản khách hiện tại (giữ nguyên uid + dữ liệu).
 * Nếu Google đó đã gắn với tài khoản khác thì không gộp được: hỏi người chơi rồi chuyển sang tài khoản đó.
 */
export async function linkOrSignInWithGoogle(confirmSwitchAccount: () => Promise<boolean>): Promise<GoogleLinkOutcome> {
  const auth = getFirebaseAuth()
  const provider = new GoogleAuthProvider()
  const user = auth.currentUser

  try {
    if (!user) {
      await signInWithPopup(auth, provider)
      return "switched"
    }
    const result = await linkWithPopup(user, provider)
    // Link không bắn onAuthStateChanged → tự cập nhật store.
    useFirebaseAuthStore.getState().setUser(result.user)
    return "linked"
  } catch (error) {
    if (!(error instanceof FirebaseError)) throw error
    if (CANCELLED_CODES.has(error.code)) return "cancelled"
    if (error.code !== "auth/credential-already-in-use") throw error

    const credential = GoogleAuthProvider.credentialFromError(error)
    if (!credential) throw error
    if (!(await confirmSwitchAccount())) return "cancelled"
    await signInWithCredential(auth, credential)
    return "switched"
  }
}

/** Đăng xuất Google; provider sẽ tự tạo tài khoản khách mới để tiếp tục chơi. */
export async function signOutToGuest(): Promise<void> {
  await signOut(getFirebaseAuth())
}
