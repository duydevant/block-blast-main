"use client"

import { useCallback, useEffect, useRef, useState } from "react"

import { fetchDuelState } from "./duel-actions"
import { DUEL_MOVE_GRACE_MS, type DuelState, type DuelStateResponse, freshestDuelState } from "./duel-types"
import { useDuelRoom, useServerNow } from "./use-duel-room"

/** Lần hỏi lại server khi ván quá hạn mà chưa chốt (mirror RTDB có thể đã lỡ). */
const FINALIZE_RETRY_MS = 5_000

export interface DuelMatch {
  /** undefined = đang tải lần đầu; null = phòng không tồn tại. */
  state: DuelState | null | undefined
  /** Giờ hiện tại theo server. */
  now: number
  /** Nhận trạng thái từ một API khác (vào phòng, sẵn sàng…) như bản tải từ server. */
  accept: (response: DuelStateResponse) => void
}

/**
 * Theo dõi phòng cho trang phòng và bảng hết ván: RTDB realtime, API lần đầu (phòng chưa mirror / không có RTDB)
 * và mỗi 5 giây khi ván quá hạn ghi nước mà chưa chốt → server chấm và chốt ván.
 */
export function useDuelMatch(duelId: string, fallbackOffset = 0): DuelMatch {
  const room = useDuelRoom(duelId)
  const [fetched, setFetched] = useState<DuelState | null | undefined>(undefined)
  const [fetchedOffset, setFetchedOffset] = useState<number | null>(null)
  const now = useServerNow(room.offsetKnown ? room.serverOffset : (fetchedOffset ?? fallbackOffset))
  const lastFinalizeAt = useRef(0)

  const accept = useCallback((response: DuelStateResponse, sentAt = Date.now()) => {
    setFetched(response)
    setFetchedOffset(response.serverNow - (sentAt + Date.now()) / 2)
  }, [])

  const loadFromApi = useCallback(() => {
    const sentAt = Date.now()
    fetchDuelState(duelId)
      .then((response) => (response ? accept(response, sentAt) : setFetched(null)))
      .catch((error: unknown) => {
        console.warn("[duel] fetch failed", error)
        setFetched((previous) => previous ?? null)
      })
  }, [duelId, accept])
  useEffect(() => loadFromApi(), [loadFromApi])

  const freshest = freshestDuelState(room.state, fetched ?? null)
  const state = freshest ?? (fetched === undefined ? undefined : null)
  const endsAt = freshest?.endsAt ?? null
  const overdue = freshest?.status === "playing" && endsAt !== null && now > endsAt + DUEL_MOVE_GRACE_MS

  useEffect(() => {
    if (!overdue || now - lastFinalizeAt.current < FINALIZE_RETRY_MS) return
    lastFinalizeAt.current = now
    loadFromApi()
  }, [overdue, now, loadFromApi])

  return { state, now, accept }
}
