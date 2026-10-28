"use client"

import { TimerIcon } from "lucide-react"

import { useI18n } from "@/lib/i18n"
import { useAnimatedNumber } from "@/modules/block-puzzle/components/use-animated-number"
import { useBlockPuzzleGameStore } from "@/modules/block-puzzle/store/block-puzzle-game-store"
import type { VariantRun } from "@/modules/game-modes/variant-run"
import { guestTagFromUid } from "@/modules/player-profile/player-profile-types"

import { duelRoundKey } from "../duel-types"
import { useDuelBoard } from "../use-duel-board"
import { useDuelRoom, useServerNow } from "../use-duel-room"

export type DuelRun = Extract<VariantRun, { kind: "duel" }>

export function formatDuelClock(ms: number): string {
  const seconds = Math.max(0, Math.ceil(ms / 1000))
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`
}

/** Một bên của bảng điểm: tên nhỏ + điểm to (cùng cỡ cho cả hai bên), dòng phụ khi đã hết nước. */
function DuelSide({ name, score, note, align, scoreClass }: { name: string; score: string; note: string | null; align: "start" | "end"; scoreClass: string }) {
  return (
    <div className={`flex min-w-0 flex-col leading-none ${align === "end" ? "items-end text-right" : "items-start text-left"}`}>
      <span className="max-w-full truncate text-xs font-bold text-violet-200/80">{name}</span>
      <span className={`font-heading text-[30px] font-extrabold tracking-tight tabular-nums sm:text-[38px] ${scoreClass}`}>{score}</span>
      {note && <span className="rounded-full bg-white/10 px-1.5 py-0.5 text-[10px] font-bold text-violet-100">{note}</span>}
    </div>
  )
}

/**
 * Bảng điểm đấu 1v1 thay điểm thường ở đầu màn chơi: Bạn | đồng hồ + chênh lệch | đối thủ. Điểm đối thủ lấy từ
 * replay nước đi của họ trên RTDB (đúng điểm server chấm), phần chạy ngầm nằm ở DuelRunController.
 */
export function DuelHud({ run }: { run: DuelRun }) {
  const { t, formatNumber } = useI18n()
  const room = useDuelRoom(run.duelId)
  const opponent = useDuelBoard(run.duelId, duelRoundKey(run.round), run.seed, run.opponent.uid)
  // Lệch giờ: RTDB nếu đã có, không thì lệch tính lúc server cấp ván (không bao giờ tin đồng hồ máy trần).
  const now = useServerNow(room.offsetKnown ? room.serverOffset : run.clockOffset)
  const score = useBlockPuzzleGameStore((state) => state.game?.score ?? 0)
  const over = useBlockPuzzleGameStore((state) => state.game?.isGameOver ?? false)
  const displayScore = useAnimatedNumber(score)
  const timeLeft = run.endsAt - now
  const timeUp = timeLeft <= 0

  // Ván đã chốt → điểm server; chưa thì điểm replay trực tiếp.
  const opponentResult = room.state?.round === run.round ? room.state.results[run.opponent.uid] : undefined
  const opponentScore = opponentResult ?? opponent?.state.score ?? 0
  const opponentOver = opponentResult !== undefined || Boolean(opponent?.state.isGameOver)
  const opponentNote = opponentOver ? (opponent?.state.endedEarly ? t("duel.stopped") : t("duel.over")) : null
  const gap = score - opponentScore
  const opponentName = run.opponent.name ?? t("profile.guestName", { tag: guestTagFromUid(run.opponent.uid) })

  return (
    <div className="grid w-full grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2">
      <DuelSide name={t("duel.you")} score={formatNumber(displayScore)} note={over ? t("duel.over") : null} align="end" scoreClass="text-white" />
      <div className="flex flex-col items-center gap-1">
        <span className="flex items-center gap-1 rounded-full bg-white/10 px-2.5 py-1 text-sm font-bold text-amber-200 tabular-nums" aria-live="off">
          <TimerIcon className="size-3.5" aria-hidden="true" />
          {timeUp ? t("duel.timeUp") : formatDuelClock(timeLeft)}
        </span>
        <span className={`text-xs font-extrabold tabular-nums ${gap > 0 ? "text-[#5ee6a8]" : gap < 0 ? "text-[#ff8a9a]" : "text-violet-200/70"}`}>
          {gap > 0 ? `+${formatNumber(gap)}` : gap < 0 ? `-${formatNumber(-gap)}` : "="}
        </span>
      </div>
      <DuelSide name={opponentName} score={formatNumber(opponentScore)} note={opponentNote} align="start" scoreClass="text-[#ff7eb6]" />
      <span className="sr-only" aria-live="polite">
        {t("duel.you")}: {formatNumber(score)}. {opponentName}: {formatNumber(opponentScore)}
      </span>
    </div>
  )
}
