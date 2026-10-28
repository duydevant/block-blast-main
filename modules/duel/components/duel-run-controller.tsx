"use client"

import { useEffect } from "react"

import { useBlockPuzzleGameStore } from "@/modules/block-puzzle/store/block-puzzle-game-store"

import { settleDuelRoom } from "../duel-actions"
import { flushDuelMoves, useDuelMoveStream } from "../duel-move-stream"
import { duelRoundKey } from "../duel-types"
import { useDuelBoard } from "../use-duel-board"
import { useDuelOnline } from "../use-duel-online"
import { useDuelRoom, useServerNow } from "../use-duel-room"
import type { DuelRun } from "./duel-hud"

/** Hỏi lại server mỗi từng này khi ván đã có thể chốt mà chưa thấy kết quả (lời gọi trước lỗi mạng…). */
const SETTLE_RETRY_MS = 5_000

/**
 * Phần chạy ngầm của ván đấu trên màn chơi (không vẽ gì): ghi nước đi lên RTDB, báo đang online, hết giờ → chốt
 * ván của mình; nhờ server chấm khi mình dừng, khi đối thủ đã vượt mình lúc mình đã dừng, hoặc khi mình vừa vượt
 * điểm của đối thủ đã dừng; ván đã có kết quả → dừng ván đang chơi.
 */
export function DuelRunController({ run }: { run: DuelRun }) {
  useDuelMoveStream()
  useDuelOnline(run.duelId)
  const room = useDuelRoom(run.duelId)
  const now = useServerNow(room.offsetKnown ? room.serverOffset : run.clockOffset, 500)
  const opponent = useDuelBoard(run.duelId, duelRoundKey(run.round), run.seed, run.opponent.uid)
  const score = useBlockPuzzleGameStore((state) => state.game?.score ?? 0)
  const over = useBlockPuzzleGameStore((state) => state.game?.isGameOver ?? false)
  const endVariantRun = useBlockPuzzleGameStore((state) => state.endVariantRun)

  const roundState = room.state?.round === run.round ? room.state : null
  const decided = roundState?.status === "finished"
  const timeUp = now >= run.endsAt
  const opponentOver = opponent?.state.isGameOver ?? false
  const opponentScore = opponent?.state.score ?? 0
  // Mình đã dừng (chấm một lần; ván chốt được khi đối thủ cũng dừng / đã vượt mình), hoặc đối thủ đã dừng mà mình
  // vượt điểm (thắng chắc). Đổi tình huống → gọi lại; ván đã chốt được thì thử lại tới khi có kết quả.
  const settleReason = decided
    ? null
    : over
      ? opponentOver || opponentScore > score
        ? "decidable"
        : "stopped"
      : opponentOver && score > opponentScore
        ? "clinch"
        : null

  useEffect(() => {
    if ((timeUp || decided) && !over) endVariantRun()
  }, [timeUp, decided, over, endVariantRun])

  useEffect(() => {
    if (!settleReason) return
    const settle = () =>
      void flushDuelMoves()
        .then(() => settleDuelRoom(run.duelId))
        .catch((error: unknown) => console.warn("[duel] settle failed", error))
    settle()
    if (settleReason === "stopped") return
    const timer = window.setInterval(settle, SETTLE_RETRY_MS)
    return () => window.clearInterval(timer)
  }, [settleReason, run.duelId, run.round])

  return null
}
