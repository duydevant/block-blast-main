"use client"

import { useEffect, useMemo, useState } from "react"

import type { GameState, RulesVersion } from "@/modules/block-puzzle/engine/game-types"
import { isRealtimeDatabaseConfigured } from "@/lib/firebase/firebase-client-app"

import { subscribeRealtime } from "./duel-realtime"
import { applyDuelMove, duelStartState } from "./duel-move-replay"
import { duelMoveKey, DUEL_RTDB_PATH } from "./duel-types"

export interface DuelBoard {
  state: GameState
  /** Số nước đã thấy. */
  moves: number
}

/**
 * Bàn trực tiếp của một người trong ván đấu (cho đối thủ và người xem): nghe nước đi trên RTDB theo thứ tự
 * và áp dần vào bàn dựng từ seed (engine tất định → bàn y hệt bàn người chơi đang thấy). null khi chưa có seed.
 */
export function useDuelBoard(
  duelId: string | null,
  roundKey: string | null,
  seed: number | null,
  uid: string | null,
  rulesVersion?: RulesVersion
): DuelBoard | null {
  const key = duelId && roundKey && seed !== null && uid ? `${duelId}/${roundKey}/${uid}/${seed}/${rulesVersion ?? 1}` : null
  const start = useMemo(() => (seed === null ? null : duelStartState(seed, rulesVersion)), [seed, rulesVersion])
  const [board, setBoard] = useState<{ key: string; value: DuelBoard } | null>(null)

  useEffect(() => {
    if (!key || seed === null || !isRealtimeDatabaseConfigured()) return
    return subscribeRealtime(({ onChildAdded, ref }, db) => {
      // Áp từng nước theo khoá 0000, 0001…; chỗ hở / nước sai thì dừng (giống server chấm).
      let state = duelStartState(seed, rulesVersion)
      let moves = 0
      let broken = false
      return onChildAdded(
        ref(db, `${DUEL_RTDB_PATH}/${duelId}/moves/${roundKey}/${uid}`),
        (snapshot) => {
          if (broken) return
          const next = snapshot.key === duelMoveKey(moves) ? applyDuelMove(state, snapshot.val()) : null
          if (!next) {
            broken = true
            return
          }
          state = next
          moves++
          setBoard({ key, value: { state, moves } })
        },
        (error) => console.warn("[duel] moves listener failed", error)
      )
    })
  }, [key, duelId, roundKey, seed, uid, rulesVersion])

  if (board?.key === key) return board.value
  return start && key ? { state: start, moves: 0 } : null
}
