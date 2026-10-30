"use client"

import { useMemo } from "react"
import { BotIcon, GhostIcon, TimerIcon } from "lucide-react"

import { BlockBoardPreview } from "@/components/game-ui/block-board-preview"
import { useI18n } from "@/lib/i18n"
import { useBlockPuzzleGameStore } from "@/modules/block-puzzle/store/block-puzzle-game-store"
import { duelBoardRows } from "@/modules/duel/duel-move-replay"
import { formatClock, useVariantRunClock } from "@/modules/game-modes/use-variant-run-clock"
import { DUEL_VARIANT, type VariantRun } from "@/modules/game-modes/variant-run"
import { buildReplayTimeline } from "@/modules/replay/replay-timeline"

import { RANKED_TIME_MS } from "../rating-rules"

type RankedRun = Extract<VariantRun, { kind: "ranked" }>

/**
 * HUD trận xếp hạng: đồng hồ 3 phút (giờ server, hết giờ tự chốt ván) + bàn mini của bóng ma phát lại cùng seed theo
 * nhịp thật (nước nào có thời điểm ≤ thời gian đã trôi thì hiện), điểm bóng ma lúc này so với điểm mình.
 */
export function RankedGhostStrip({ run }: { run: RankedRun }) {
  const { t, formatNumber } = useI18n()
  const myScore = useBlockPuzzleGameStore((state) => state.game?.score ?? 0)
  const msLeft = useVariantRunClock(run.endsAt, run.clockOffset) ?? 0
  const timeline = useMemo(() => buildReplayTimeline({ seed: run.seed, stashUnlocked: false, variant: DUEL_VARIANT }, run.ghost.actions), [run.seed, run.ghost.actions])
  const elapsed = RANKED_TIME_MS - msLeft
  const shown = Math.min(timeline.states.length - 1, run.ghost.times.filter((time) => time <= elapsed).length)
  const ghostState = timeline.states[shown]
  const name = run.ghost.isBot ? t("ranked.bot") : (run.ghost.displayName ?? t("ranked.ghost"))
  const ahead = myScore >= ghostState.score

  return (
    <div className="mx-auto flex items-center gap-3 rounded-2xl bg-white/8 px-3 py-1.5 text-xs font-semibold">
      <BlockBoardPreview rows={duelBoardRows(ghostState)} cellGap={1} className="size-14 p-1" />
      <div className="flex flex-col gap-0.5">
        <span className="flex items-center gap-1 text-violet-200">
          {run.ghost.isBot ? <BotIcon className="size-3.5" aria-hidden="true" /> : <GhostIcon className="size-3.5" aria-hidden="true" />}
          {name}
        </span>
        <span className="tabular-nums" aria-live="polite">
          {t("ranked.scoreLine", { ghost: formatNumber(ghostState.score), me: formatNumber(myScore) })}
        </span>
        <span className={`font-bold ${ahead ? "text-[#2ec4b6]" : "text-red-300"}`}>{t(ahead ? "ranked.ahead" : "ranked.behind")}</span>
      </div>
      <span className={`flex items-center gap-0.5 text-sm tabular-nums ${msLeft <= 15_000 ? "text-red-300" : "text-amber-200"}`}>
        <TimerIcon className="size-4" aria-hidden="true" />
        {formatClock(msLeft)}
      </span>
    </div>
  )
}
