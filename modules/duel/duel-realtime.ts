"use client"

import type { Database } from "firebase/database"

import { getFirebaseApp } from "@/lib/firebase/firebase-client-app"
import { holdRealtimeConnection } from "@/modules/realtime/realtime-connection"

export type RealtimeSdk = typeof import("firebase/database")

/**
 * Dùng Realtime DB trong một effect: tải SDK lười, giữ kết nối trong lúc dùng (ref-count chung với presence),
 * `setup` trả hàm dọn listener. Trả hàm huỷ cho cleanup của effect (gọi trước khi SDK tải xong cũng an toàn).
 */
export function subscribeRealtime(setup: (sdk: RealtimeSdk, db: Database) => () => void): () => void {
  let disposed = false
  let cleanup = () => {}
  void import("firebase/database")
    .then((sdk) => {
      if (disposed) return
      const db = sdk.getDatabase(getFirebaseApp())
      const release = holdRealtimeConnection(db, sdk.goOnline, sdk.goOffline)
      const stop = setup(sdk, db)
      cleanup = () => {
        stop()
        release()
      }
    })
    .catch((error: unknown) => console.warn("[duel] realtime init failed", error))
  return () => {
    disposed = true
    cleanup()
  }
}
