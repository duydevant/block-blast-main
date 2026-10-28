"use client"

import { SwordsIcon, TimerIcon } from "lucide-react"
import { useEffect } from "react"

import { useI18n } from "@/lib/i18n"
import { useBlockPuzzleGameStore } from "@/modules/block-puzzle/store/block-puzzle-game-store"
import type { VariantRun } from "@/modules/game-modes/variant-run"
import { guestTagFromUid } from "@/modules/player-profile/player-profile-types"
import { useSignedInUid } from "@/modules/player-profile/use-player-profile-query"

import { reportDuelLiveScore, useDuelRoom, useServerNow } from "../use-duel-room"

type DuelRun = Extract<VariantRun, { kind: "duel" }>

export function formatDuelClock(ms: number): string {
  const seconds = Math.max(0, Math.ceil(ms / 1000))
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`
}

/**
 * HUD đấu 1v1: đồng hồ theo giờ server + điểm của mình và điểm trực tiếp của đối thủ.
 * Gửi điểm của mình lên RTDB mỗi khi đổi; hết giờ → chốt ván (sync nộp ngay để server replay).
 */
export function DuelHud({ run }: { run: DuelRun }) {
  const { t, formatNumber } = useI18n()
  const uid = useSignedInUid()
  const room = useDuelRoom(run.duelId)
  // Lệch giờ: RTDB nếu đã có, không thì lệch tính lúc server cấp ván (không bao giờ tin đồng hồ máy trần).
  const now = useServerNow(room.offsetKnown ? room.serverOffset : run.clockOffset)
  const score = useBlockPuzzleGameStore((state) => state.game?.score ?? 0)
  const over = useBlockPuzzleGameStore((state) => state.game?.isGameOver ?? false)
  const endVariantRun = useBlockPuzzleGameStore((state) => state.endVariantRun)
  const timeLeft = run.endsAt - now
  const timeUp = timeLeft <= 0

  useEffect(() => {
    if (timeUp) endVariantRun()
  }, [timeUp, endVariantRun])

  useEffect(() => {
    if (!uid) return
    reportDuelLiveScore(run.duelId, uid, { score, over }).catch((error: unknown) => console.warn("[duel] live score failed", error))
  }, [run.duelId, uid, score, over])

  const opponent = room.live[run.opponent.uid]
  const opponentName = run.opponent.name ?? t("profile.guestName", { tag: guestTagFromUid(run.opponent.uid) })

  return (
    <div className="mx-auto flex w-full max-w-xs items-center justify-between gap-3 rounded-full bg-white/8 px-4 py-1.5 text-xs font-semibold text-violet-100">
      <span className="flex items-center gap-1 text-amber-200 tabular-nums" aria-live="off">
        <TimerIcon className="size-3.5" aria-hidden="true" />
        {timeUp ? t("duel.timeUp") : formatDuelClock(timeLeft)}
      </span>
      <span className="flex min-w-0 items-center gap-1.5 truncate" aria-live="polite">
        <SwordsIcon className="size-3.5 shrink-0" aria-hidden="true" />
        <span className="truncate">{opponentName}</span>
        <strong className="text-white tabular-nums">{formatNumber(opponent?.score ?? 0)}</strong>
      </span>
    </div>
  )
}
