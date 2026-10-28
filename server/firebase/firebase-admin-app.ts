import "server-only"

import { cert, getApp, getApps, initializeApp, type App } from "firebase-admin/app"
import { getAuth } from "firebase-admin/auth"
import { getDatabase } from "firebase-admin/database"
import { getFirestore } from "firebase-admin/firestore"

const ADMIN_APP_NAME = "block-puzzle-admin"

/** Admin SDK khởi tạo lười từ env server (FIREBASE_ADMIN_*), dùng lại qua các request/hot reload. */
function getAdminApp(): App {
  if (getApps().some((app) => app.name === ADMIN_APP_NAME)) return getApp(ADMIN_APP_NAME)

  const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID
  const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL
  // Env lưu key một dòng với "\n" escape → đổi lại thành xuống dòng thật.
  const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, "\n")
  if (!projectId || !clientEmail || !privateKey) {
    throw new Error("Missing FIREBASE_ADMIN_* environment variables (see docs/firebase-setup-guide.md)")
  }

  // Realtime DB (presence) dùng chung URL public với client; thiếu thì chỉ RTDB không dùng được.
  const databaseURL = process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL || undefined
  return initializeApp({ credential: cert({ projectId, clientEmail, privateKey }), projectId, databaseURL }, ADMIN_APP_NAME)
}

export function getAdminAuth() {
  return getAuth(getAdminApp())
}

export function getAdminFirestore() {
  return getFirestore(getAdminApp())
}

export function getAdminDatabase() {
  return getDatabase(getAdminApp())
}
