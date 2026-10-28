import { getApp, getApps, initializeApp, type FirebaseApp } from "firebase/app"
import {
  browserLocalPersistence,
  browserPopupRedirectResolver,
  indexedDBLocalPersistence,
  inMemoryPersistence,
  initializeAuth,
  type Auth,
} from "firebase/auth"

// Phải đọc từng biến NEXT_PUBLIC_* trực tiếp để Next inline giá trị vào bundle client.
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL,
}

/** Realtime DB (presence) chỉ dùng khi có URL. */
export function isRealtimeDatabaseConfigured(): boolean {
  return isFirebaseConfigured() && Boolean(firebaseConfig.databaseURL)
}

/** Thiếu config (VD chạy test/local chưa có .env) → app chạy offline, không gọi Firebase. */
export function isFirebaseConfigured(): boolean {
  return Boolean(firebaseConfig.apiKey && firebaseConfig.authDomain && firebaseConfig.projectId && firebaseConfig.appId)
}

export function getFirebaseApp(): FirebaseApp {
  return getApps().length > 0 ? getApp() : initializeApp(firebaseConfig)
}

let authInstance: Auth | null = null

/**
 * Auth chỉ dùng ở client. Persistence xếp theo thứ tự ưu tiên: iframe/portal chặn IndexedDB
 * hoặc localStorage thì rơi xuống bộ nhớ tạm (mất tài khoản khách khi tải lại, nhưng vẫn chơi được).
 */
export function getFirebaseAuth(): Auth {
  authInstance ??= initializeAuth(getFirebaseApp(), {
    persistence: [indexedDBLocalPersistence, browserLocalPersistence, inMemoryPersistence],
    popupRedirectResolver: browserPopupRedirectResolver,
  })
  return authInstance
}
