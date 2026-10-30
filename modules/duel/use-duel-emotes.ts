"use client"

import { useCallback, useEffect, useRef, useState } from "react"

import { isRealtimeDatabaseConfigured } from "@/lib/firebase/firebase-client-app"
import { useSignedInUid } from "@/modules/player-profile/use-player-profile-query"

import { EMOTE_COOLDOWN_MS, emoteCooldownLeft, EMOTE_SHOW_MS, newEmoteFrom } from "./duel-emote-rules"
import { subscribeRealtime } from "./duel-realtime"
import { DUEL_RTDB_PATH } from "./duel-types"

/** Emote đang hiện của một người; `key` đổi mỗi emote để animation chạy lại. */
export interface VisibleEmote {
  e: number
  key: number
}

export interface DuelEmotes {
  /** uid → emote đang hiện (đã ẩn sau EMOTE_SHOW_MS). */
  visible: Record<string, VisibleEmote>
  /** Gửi emote (chỉ người chơi của phòng; rules RTDB chặn người xem). */
  send: (index: number) => void
  coolingDown: boolean
}

/**
 * Emote trong phòng đấu: nghe `duels/{id}/emotes` (bản ghi đầu tiên chỉ làm mốc, không hiện lại emote cũ),
 * mỗi emote mới hiện ~2 s. Gửi ghi `{ e, at: serverTimestamp }` của chính mình, cách nhau ≥ 3 s.
 */
export function useDuelEmotes(duelId: string | null): DuelEmotes {
  const uid = useSignedInUid()
  const [visible, setVisible] = useState<Record<string, VisibleEmote>>({})
  const [coolingDown, setCoolingDown] = useState(false)
  const sendRef = useRef<((index: number) => Promise<void>) | null>(null)
  const lastSentAt = useRef<number | null>(null)

  useEffect(() => {
    if (!duelId || !uid || !isRealtimeDatabaseConfigured()) return
    const lastAt = new Map<string, number>()
    const timers = new Set<number>()
    let baseline = true
    const stop = subscribeRealtime(({ onValue, ref, serverTimestamp, set }, db) => {
      sendRef.current = (index) => set(ref(db, `${DUEL_RTDB_PATH}/${duelId}/emotes/${uid}`), { e: index, at: serverTimestamp() })
      const unsubscribe = onValue(ref(db, `${DUEL_RTDB_PATH}/${duelId}/emotes`), (snapshot) => {
        const all = (snapshot.val() as Record<string, unknown> | null) ?? {}
        for (const [player, value] of Object.entries(all)) {
          const emote = newEmoteFrom(lastAt.get(player) ?? null, value)
          if (!emote) continue
          lastAt.set(player, emote.at)
          if (baseline) continue
          setVisible((current) => ({ ...current, [player]: { e: emote.e, key: emote.at } }))
          const timer = window.setTimeout(() => {
            timers.delete(timer)
            setVisible((current) => {
              if (current[player]?.key !== emote.at) return current
              const rest = { ...current }
              delete rest[player]
              return rest
            })
          }, EMOTE_SHOW_MS)
          timers.add(timer)
        }
        baseline = false
      })
      return () => {
        unsubscribe()
        sendRef.current = null
      }
    })
    return () => {
      stop()
      timers.forEach((timer) => window.clearTimeout(timer))
    }
  }, [duelId, uid])

  const send = useCallback((index: number) => {
    const now = Date.now()
    if (!sendRef.current || emoteCooldownLeft(lastSentAt.current, now) > 0) return
    lastSentAt.current = now
    setCoolingDown(true)
    window.setTimeout(() => setCoolingDown(false), EMOTE_COOLDOWN_MS)
    void sendRef.current(index).catch((error: unknown) => console.warn("[duel] emote failed", error))
  }, [])

  return { visible, send, coolingDown }
}
