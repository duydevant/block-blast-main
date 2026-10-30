"use client"

import { useEffect, useState } from "react"

import { isRealtimeDatabaseConfigured } from "@/lib/firebase/firebase-client-app"
import { useSignedInUid } from "@/modules/player-profile/use-player-profile-query"

import { subscribeRealtime } from "./duel-realtime"
import { DUEL_RTDB_PATH, type DuelState, duelRoundKey } from "./duel-types"

export interface DuelRoom {
  /** null = đang tải hoặc phòng chưa có trên RTDB. */
  state: DuelState | null
  /** Lệch giờ máy so với server (ms) để đếm ngược/hết giờ đúng với hạn chót của server. */
  serverOffset: number
  /** Đã nhận lệch giờ từ RTDB (chưa có thì dùng lệch giờ tính từ API). */
  offsetKnown: boolean
}

/** RTDB không lưu null/object rỗng/mảng rỗng → field vắng mặt; điền lại cho đúng kiểu DuelState. */
function normalizeDuelState(raw: Partial<DuelState> | null | undefined): DuelState | null {
  if (!raw?.id || !raw.host || !raw.status) return null
  const round = raw.round ?? 0
  return {
    id: raw.id,
    version: raw.version ?? 0,
    status: raw.status,
    host: { uid: raw.host.uid, name: raw.host.name ?? null },
    guest: raw.guest ? { uid: raw.guest.uid, name: raw.guest.name ?? null } : null,
    round,
    roundKey: raw.roundKey ?? duelRoundKey(round),
    seed: raw.seed ?? null,
    startAt: raw.startAt ?? null,
    endsAt: raw.endsAt ?? null,
    results: raw.results ?? {},
    winnerUid: raw.winnerUid ?? null,
    endReason: raw.endReason ?? null,
    series: raw.series ?? {},
    ready: Object.values(raw.ready ?? []),
    history: Object.values(raw.history ?? []).map((item) => ({ ...item, scores: item.scores ?? {}, winnerUid: item.winnerUid ?? null })),
    started: Object.values(raw.started ?? []),
    ...(raw.rulesVersion === 2 ? { rulesVersion: 2 } : {}),
  }
}

const EMPTY_ROOM: DuelRoom = { state: null, serverOffset: 0, offsetKnown: false }

/** Nghe trạng thái phòng trên RTDB (do server ghi) + lệch giờ server. Nước đi nghe riêng (`useDuelBoard`). */
export function useDuelRoom(duelId: string | null): DuelRoom {
  const uid = useSignedInUid()
  const [room, setRoom] = useState<{ key: string; value: DuelRoom } | null>(null)
  const key = duelId && uid ? `${duelId}:${uid}` : null

  useEffect(() => {
    if (!key || !duelId || !isRealtimeDatabaseConfigured()) return
    return subscribeRealtime(({ onValue, ref }, db) => {
      const stopRoom = onValue(
        ref(db, `${DUEL_RTDB_PATH}/${duelId}/state`),
        (snapshot) => {
          const state = normalizeDuelState(snapshot.val() as Partial<DuelState> | null)
          setRoom((previous) => ({ key, value: { ...(previous?.key === key ? previous.value : EMPTY_ROOM), state } }))
        },
        (error) => console.warn("[duel] room listener failed", error)
      )
      const stopOffset = onValue(ref(db, ".info/serverTimeOffset"), (snapshot) => {
        const serverOffset = Number(snapshot.val()) || 0
        setRoom((previous) => ({ key, value: { ...(previous?.key === key ? previous.value : EMPTY_ROOM), serverOffset, offsetKnown: true } }))
      })
      return () => {
        stopRoom()
        stopOffset()
      }
    })
  }, [key, duelId])

  return room?.key === key ? room.value : EMPTY_ROOM
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
