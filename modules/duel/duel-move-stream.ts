"use client"

import { useEffect, useRef } from "react"
import { toast } from "sonner"

import { isRealtimeDatabaseConfigured } from "@/lib/firebase/firebase-client-app"
import { useI18n } from "@/lib/i18n"
import { withoutActionTime } from "@/modules/block-puzzle/engine/recorded-action-timing"
import { useBlockPuzzleGameStore } from "@/modules/block-puzzle/store/block-puzzle-game-store"
import { useSignedInUid } from "@/modules/player-profile/use-player-profile-query"

import { DUEL_END_ACTION } from "./duel-move-replay"
import { subscribeRealtime } from "./duel-realtime"
import { DUEL_RTDB_PATH, duelMoveKey, duelRoundKey } from "./duel-types"

/** Lượt ghi nước đi đang chờ RTDB xác nhận — chấm ván chỉ sau khi nước cuối đã lên server. */
const pendingWrites = new Set<Promise<void>>()
/** Đợi nước đi lên RTDB tối đa từng này trước khi nhờ server chấm (mạng chậm thì vẫn gọi, server chấm lại sau). */
const FLUSH_TIMEOUT_MS = 4_000

/** Chờ các nước đi đang ghi lên RTDB xong (hoặc hết thời gian chờ). */
export async function flushDuelMoves(): Promise<void> {
  const writes = Promise.allSettled([...pendingWrites])
  await Promise.race([writes, new Promise((resolve) => window.setTimeout(resolve, FLUSH_TIMEOUT_MS))])
}

/**
 * Ghi từng nước đi của ván đấu đang chơi lên `duels/{id}/moves/{round}/{uid}/{seq}` ngay khi đi, kèm giờ server
 * (rules ép đúng `now`, chặn ghi ngoài giờ ván). Đối thủ + người xem dựng lại bàn từ đây, server chấm từ đây.
 * Khoá `seq` = vị trí trong log ván nên tải lại trang chỉ ghi tiếp phần còn thiếu. Ván bị chốt sớm (bỏ trận /
 * hết giờ) thì ghi thêm nước "dừng" để server biết người này đã dừng.
 */
export function useDuelMoveStream(): void {
  const uid = useSignedInUid()
  const duelId = useBlockPuzzleGameStore((state) => (state.variantRun?.kind === "duel" ? state.variantRun.duelId : null))
  const round = useBlockPuzzleGameStore((state) => (state.variantRun?.kind === "duel" ? state.variantRun.round : null))
  const { t } = useI18n()
  const translate = useRef(t)
  useEffect(() => {
    translate.current = t
  }, [t])

  useEffect(() => {
    if (!duelId || round === null || !uid || !isRealtimeDatabaseConfigured()) return
    const base = `${DUEL_RTDB_PATH}/${duelId}/moves/${duelRoundKey(round)}/${uid}`
    return subscribeRealtime(({ get, ref, serverTimestamp, set }, db) => {
      let written = -1
      let stopped = false
      let warned = false
      const write = (index: number, action: unknown) => {
        const pending = set(ref(db, `${base}/${duelMoveKey(index)}`), { a: action, at: serverTimestamp() }).catch((error: unknown) => {
          console.warn("[duel] move write rejected", error)
          // Sau hạn chót / sau khi ván đã chốt thì bị từ chối là đúng; còn giữa ván (VD rules RTDB chưa cập nhật)
          // thì nước đi không được tính → báo một lần cho người chơi biết thay vì thua 0 điểm trong im lặng.
          const run = useBlockPuzzleGameStore.getState().variantRun
          const midRound = run?.kind === "duel" && Date.now() + run.clockOffset < run.endsAt - 2_000
          if (midRound && !warned) {
            warned = true
            toast.error(translate.current("duel.moveRejected"))
          }
        })
        pendingWrites.add(pending)
        void pending.finally(() => pendingWrites.delete(pending))
      }
      const pushNew = () => {
        if (written < 0 || stopped) return
        const { actionLog, game } = useBlockPuzzleGameStore.getState()
        // RTDB rules từ chối field lạ → bỏ thời điểm `t` của log local.
        for (; written < actionLog.length; written++) write(written, withoutActionTime(actionLog[written]))
        if (game?.endedEarly && written === actionLog.length) write(written++, DUEL_END_ACTION)
      }
      // Nước đã lên RTDB trước đó (tải lại trang giữa ván) → ghi tiếp từ chỗ còn thiếu (thử lại khi mạng lỗi).
      const loadWritten = (attempt: number) => {
        get(ref(db, base))
          .then((snapshot) => {
            written = snapshot.exists() ? Object.keys(snapshot.val() as object).length : 0
            pushNew()
          })
          .catch((error: unknown) => {
            console.warn("[duel] read own moves failed", error)
            if (!stopped && attempt < 5) window.setTimeout(() => loadWritten(attempt + 1), 2_000 * (attempt + 1))
          })
      }
      loadWritten(0)
      const unsubscribe = useBlockPuzzleGameStore.subscribe((state, previous) => {
        if (state.actionLog !== previous.actionLog || state.game?.endedEarly !== previous.game?.endedEarly) pushNew()
      })
      return () => {
        stopped = true
        unsubscribe()
      }
    })
  }, [duelId, round, uid])
}
