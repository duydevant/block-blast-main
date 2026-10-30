"use client"

import { SwordIcon, TimerIcon } from "lucide-react"

import { useI18n } from "@/lib/i18n"
import { useBlockPuzzleGameStore } from "@/modules/block-puzzle/store/block-puzzle-game-store"

import { findArenaLevel } from "../arena-catalog"
import { formatClock, useVariantRunClock } from "../use-variant-run-clock"
import type { VariantRun } from "../variant-run"

const BADGE = "mx-auto flex items-center gap-1.5 rounded-full bg-white/8 px-3 py-1 text-xs font-semibold text-amber-200"

type ArenaRun = Extract<VariantRun, { kind: "arena" }>

/** Nhãn dưới HUD khi chơi Đấu trường: loại + cấp + mục tiêu, tiến độ ván này, đồng hồ (Tốc độ). */
export function ArenaHudBadge({ run }: { run: ArenaRun }) {
  const { t, formatNumber } = useI18n()
  const game = useBlockPuzzleGameStore((state) => state.game)
  const msLeft = useVariantRunClock(run.endsAt, run.clockOffset)
  const definition = findArenaLevel(run.type, run.level)
  if (!definition || !game) return null

  const { goal } = definition
  const value = goal.kind === "score" ? game.score : goal.kind === "lines" ? (game.linesCleared ?? 0) : (game.runStats?.bestCombo ?? 0)
  const clock = msLeft === null ? null : formatClock(msLeft)

  return (
    <div className="mx-auto flex flex-col items-center gap-0.5">
      <p className={BADGE}>
        <SwordIcon className="size-3.5" aria-hidden="true" />
        {t("arena.badge", { type: t(`arena.type.${run.type}`), level: run.level, attempt: run.attempt })}
      </p>
      <p className="flex items-center gap-2 text-xs font-semibold text-violet-100 tabular-nums" aria-live="polite">
        {t(`arena.goal.${goal.kind}`, { value: formatNumber(Math.min(value, goal.target)), target: formatNumber(goal.target) })}
        {clock && (
          <span className={`flex items-center gap-0.5 ${msLeft !== null && msLeft <= 15_000 ? "text-red-300" : ""}`}>
            <TimerIcon className="size-3.5" aria-hidden="true" />
            {clock}
          </span>
        )}
      </p>
    </div>
  )
}
