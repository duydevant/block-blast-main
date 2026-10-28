"use client"

import { useEffect, useState } from "react"

import { isRealtimeDatabaseConfigured } from "@/lib/firebase/firebase-client-app"
import { useSignedInUid } from "@/modules/player-profile/use-player-profile-query"

import { subscribeRealtime } from "./duel-realtime"
import { DUEL_RTDB_PATH } from "./duel-types"

/**
 * Ai đang mở phòng / ván đấu (người chơi + người xem): mỗi máy ghi `duels/{id}/online/{uid}`, tự xoá khi mất kết nối.
 * Trả danh sách uid đang online (null = chưa tải) — người xem = online trừ hai người chơi; đối thủ vắng = mất kết nối.
 * `announce: false` = chỉ đọc (component phụ cùng màn đã có chỗ khác báo online).
 */
export function useDuelOnline(duelId: string | null, announce = true): string[] | null {
  const uid = useSignedInUid()
  const [online, setOnline] = useState<{ key: string; uids: string[] } | null>(null)
  const key = duelId && uid ? `${duelId}:${uid}` : null

  useEffect(() => {
    if (!key || !duelId || !uid || !isRealtimeDatabaseConfigured()) return
    return subscribeRealtime(({ onDisconnect, onValue, ref, remove, serverTimestamp, set }, db) => {
      const mine = ref(db, `${DUEL_RTDB_PATH}/${duelId}/online/${uid}`)
      if (announce) {
        void onDisconnect(mine)
          .remove()
          .then(() => set(mine, serverTimestamp()))
          .catch((error: unknown) => console.warn("[duel] announce online failed", error))
      }
      const stop = onValue(ref(db, `${DUEL_RTDB_PATH}/${duelId}/online`), (snapshot) =>
        setOnline({ key, uids: Object.keys((snapshot.val() as Record<string, number> | null) ?? {}) })
      )
      return () => {
        stop()
        if (announce) void remove(mine).catch(() => undefined)
      }
    })
  }, [key, duelId, uid, announce])

  return online?.key === key ? online.uids : null
}
