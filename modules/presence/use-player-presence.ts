"use client"

import { useEffect } from "react"

import { getFirebaseApp, isRealtimeDatabaseConfigured } from "@/lib/firebase/firebase-client-app"
import { useSignedInUid } from "@/modules/player-profile/use-player-profile-query"
import { holdRealtimeConnection } from "@/modules/realtime/realtime-connection"

import { PRESENCE_PATH } from "./presence-paths"

/**
 * Đánh dấu "đang chơi" trên Realtime DB khi màn chơi mở và tab đang hiện.
 * Tab ẩn → xoá bản ghi + nhả kết nối (ngắt nếu không tính năng nào khác cần); mất mạng → RTDB tự xoá qua onDisconnect.
 * SDK database tải lười để không làm nặng bundle màn chơi.
 */
export function usePlayerPresence() {
  const uid = useSignedInUid()

  useEffect(() => {
    if (!uid || !isRealtimeDatabaseConfigured()) return
    let disposed = false
    let cleanup = () => {}

    void import("firebase/database")
      .then(({ getDatabase, goOffline, goOnline, onDisconnect, onValue, ref, remove, serverTimestamp, set }) => {
        if (disposed) return
        const db = getDatabase(getFirebaseApp())
        const presenceRef = ref(db, `${PRESENCE_PATH}/${uid}`)
        const warn = (error: unknown) => console.warn("[presence]", error)
        const visible = () => document.visibilityState === "visible"
        let release: (() => void) | null = visible() ? holdRealtimeConnection(db, goOnline, goOffline) : null

        // Đăng ký xoá khi mất kết nối rồi mới ghi, tránh để lại bản ghi "ma".
        const markPlaying = () => {
          onDisconnect(presenceRef)
            .remove()
            .then(() => set(presenceRef, serverTimestamp()))
            .catch(warn)
        }
        /** Xoá bản ghi rồi mới nhả kết nối (nhả trước thì lệnh xoá không tới server). */
        const leave = () => {
          const releaseHold = release
          release = null
          remove(presenceRef)
            .catch(warn)
            .finally(() => releaseHold?.())
        }

        // Mỗi lần (re)connect khi tab đang hiện thì ghi lại (RTDB đã xoá lúc mất kết nối).
        const stopListening = onValue(ref(db, ".info/connected"), (snapshot) => {
          if (snapshot.val() === true && visible() && release) markPlaying()
        })
        const onVisibilityChange = () => {
          if (!visible()) return leave()
          release ??= holdRealtimeConnection(db, goOnline, goOffline)
          // Đang online sẵn thì .info/connected không bắn lại → ghi trực tiếp.
          markPlaying()
        }
        document.addEventListener("visibilitychange", onVisibilityChange)

        cleanup = () => {
          document.removeEventListener("visibilitychange", onVisibilityChange)
          stopListening()
          leave()
        }
      })
      .catch((error: unknown) => console.warn("[presence] init failed", error))

    return () => {
      disposed = true
      cleanup()
    }
  }, [uid])
}
