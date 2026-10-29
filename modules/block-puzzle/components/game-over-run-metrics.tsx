"use client"

import { useI18n } from "@/lib/i18n"

import { EMPTY_RUN_STATS, isPureRun, pointsPerMove } from "../engine/game-run-stats"
import { useBlockPuzzleGameStore } from "../store/block-puzzle-game-store"

const CHIP = "flex flex-col-reverse items-center gap-0.5 rounded-2xl bg-[#2a2459] px-1.5 py-2"

/** 3 chỉ số kỹ năng của ván vừa chơi (điểm/nước, xoá ≥3 dòng, ván thuần) — số từ reducer, khớp với server replay. */
export function GameOverRunMetrics() {
  const { t, formatNumber } = useI18n()
  const game = useBlockPuzzleGameStore((state) => state.game)
  if (!game || game.moveCount === 0) return null

  const stats = game.runStats ?? EMPTY_RUN_STATS
  const pure = isPureRun(stats)
  const chips: [label: string, value: string, hint?: string][] = [
    [t("metrics.pointsPerMove"), formatNumber(Math.round(pointsPerMove(game.score, game.moveCount) * 10) / 10)],
    [t("metrics.multiClears"), formatNumber(stats.multiClears[1])],
    [t("metrics.pure"), t(pure ? "metrics.yes" : "metrics.no"), t("metrics.pureHint")],
  ]

  return (
    <dl className="grid w-full grid-cols-3 gap-2">
      {chips.map(([label, value, hint]) => (
        <div key={label} className={CHIP} title={hint}>
          <dt className="text-[11px] leading-tight text-violet-200/80">{label}</dt>
          <dd className="text-base font-extrabold tabular-nums">{value}</dd>
        </div>
      ))}
    </dl>
  )
}
