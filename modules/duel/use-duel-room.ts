"use client"

import { useEffect, useState } from "react"

import { getFirebaseApp, isRealtimeDatabaseConfigured } from "@/lib/firebase/firebase-client-app"
import { useSignedInUid } from "@/modules/player-profile/use-player-profile-query"
import { holdRealtimeConnection } from "@/modules/realtime/realtime-connection"

import { DUEL_RTDB_PATH, type DuelLiveScore, type DuelState } from "./duel-types"

export interface DuelRoom {
  /** null = đang tải hoặc phòng chưa có trên RTDB. */
  state: DuelState | null
  live: Record<string, DuelLiveScore>
  /** Lệch giờ máy so với server (ms) để đếm ngược/hết giờ đúng với hạn chót của server. */
  serverOffset: number
  /** Đã nhận lệch giờ từ RTDB (chưa có thì dùng lệch giờ tính từ API). */
  offsetKnown: boolean
  loaded: boolean
}

/** RTDB không lưu null/object rỗng → field vắng mặt; điền lại cho đúng kiểu DuelState. */
function normalizeDuelState(raw: Partial<DuelState> | undefined): DuelState | null {
  if (!raw?.id || !raw.host || !raw.status) return null
  return {
    id: raw.id,
    status: raw.status,
    host: { uid: raw.host.uid, name: raw.host.name ?? null },
    guest: raw.guest ? { uid: raw.guest.uid, name: raw.guest.name ?? null } : null,
    startAt: raw.startAt ?? null,
    endsAt: raw.endsAt ?? null,
    results: raw.results ?? {},
    winnerUid: raw.winnerUid ?? null,
    rematchId: raw.rematchId ?? null,
    started: raw.started ?? [],
  }
}

const EMPTY_ROOM: DuelRoom = { state: null, live: {}, serverOffset: 0, offsetKnown: false, loaded: false }

/** Nghe phòng đấu trên RTDB (trạng thái do server ghi + điểm trực tiếp hai bên). SDK database tải lười. */
export function useDuelRoom(duelId: string | null): DuelRoom {
  const uid = useSignedInUid()
  const [room, setRoom] = useState<DuelRoom>(EMPTY_ROOM)

  useEffect(() => {
    if (!duelId || !uid || !isRealtimeDatabaseConfigured()) return
    let disposed = false
    let cleanup = () => {}
    void import("firebase/database")
      .then(({ getDatabase, goOffline, goOnline, onValue, ref }) => {
        if (disposed) return
        const db = getDatabase(getFirebaseApp())
        const release = holdRealtimeConnection(db, goOnline, goOffline)
        const stopRoom = onValue(
          ref(db, `${DUEL_RTDB_PATH}/${duelId}`),
          (snapshot) => {
            const value = (snapshot.val() ?? {}) as { state?: Partial<DuelState>; live?: Record<string, DuelLiveScore> }
            setRoom((previous) => ({ ...previous, state: normalizeDuelState(value.state), live: value.live ?? {}, loaded: true }))
          },
          (error) => {
            console.warn("[duel] room listener failed", error)
            setRoom((previous) => ({ ...previous, loaded: true }))
          }
        )
        const stopOffset = onValue(ref(db, ".info/serverTimeOffset"), (snapshot) => {
          const offset = Number(snapshot.val()) || 0
          setRoom((previous) => ({ ...previous, serverOffset: offset, offsetKnown: true }))
        })
        cleanup = () => {
          stopRoom()
          stopOffset()
          release()
        }
      })
      .catch((error: unknown) => console.warn("[duel] init failed", error))
    return () => {
      disposed = true
      cleanup()
      setRoom(EMPTY_ROOM)
    }
  }, [duelId, uid])

  return room
}

/** Ghi điểm trực tiếp của mình (chỉ hiển thị cho đối thủ; kết quả thật do server replay). */
export async function reportDuelLiveScore(duelId: string, uid: string, live: DuelLiveScore): Promise<void> {
  const { getDatabase, ref, set } = await import("firebase/database")
  await set(ref(getDatabase(getFirebaseApp()), `${DUEL_RTDB_PATH}/${duelId}/live/${uid}`), live)
}

/** Giờ hiện tại theo server, cập nhật mỗi `intervalMs` (cho đồng hồ đếm ngược). */
export function useServerNow(serverOffset: number, intervalMs = 250): number {
  const [now, setNow] = useState(() => Date.now() + serverOffset)
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now() + serverOffset), intervalMs)
    return () => window.clearInterval(timer)
  }, [serverOffset, intervalMs])
  return now
}
