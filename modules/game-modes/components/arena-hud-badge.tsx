"use client"

import { useEffect, useState } from "react"
import { SwordIcon, TimerIcon } from "lucide-react"

import { useI18n } from "@/lib/i18n"
import { useBlockPuzzleGameStore } from "@/modules/block-puzzle/store/block-puzzle-game-store"

import { findArenaLevel } from "../arena-catalog"
import type { VariantRun } from "../variant-run"

const BADGE = "mx-auto flex items-center gap-1.5 rounded-full bg-white/8 px-3 py-1 text-xs font-semibold text-amber-200"

type ArenaRun = Extract<VariantRun, { kind: "arena" }>

/** Giây còn lại của lần thử (giờ server); hết giờ → chốt ván để sync tự nộp. */
function useArenaClock(run: ArenaRun): number | null {
  const endVariantRun = useBlockPuzzleGameStore((state) => state.endVariantRun)
  const isOver = useBlockPuzzleGameStore((state) => state.game?.isGameOver ?? true)
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    if (run.endsAt === null || isOver) return
    const timer = window.setInterval(() => {
      const serverNow = Date.now() + run.clockOffset
      setNow(Date.now())
      if (serverNow >= run.endsAt!) endVariantRun()
    }, 250)
    return () => window.clearInterval(timer)
  }, [run.endsAt, run.clockOffset, isOver, endVariantRun])

  return run.endsAt === null ? null : Math.max(0, Math.ceil((run.endsAt - (now + run.clockOffset)) / 1000))
}

/** Nhãn dưới HUD khi chơi Đấu trường: loại + cấp + mục tiêu, tiến độ ván này, đồng hồ (Tốc độ). */
export function ArenaHudBadge({ run }: { run: ArenaRun }) {
  const { t, formatNumber } = useI18n()
  const game = useBlockPuzzleGameStore((state) => state.game)
  const secondsLeft = useArenaClock(run)
  const definition = findArenaLevel(run.type, run.level)
  if (!definition || !game) return null

  const { goal } = definition
  const value = goal.kind === "score" ? game.score : goal.kind === "lines" ? (game.linesCleared ?? 0) : (game.runStats?.bestCombo ?? 0)
  const clock = secondsLeft === null ? null : `${Math.floor(secondsLeft / 60)}:${String(secondsLeft % 60).padStart(2, "0")}`

  return (
    <div className="mx-auto flex flex-col items-center gap-0.5">
      <p className={BADGE}>
        <SwordIcon className="size-3.5" aria-hidden="true" />
        {t("arena.badge", { type: t(`arena.type.${run.type}`), level: run.level, attempt: run.attempt })}
      </p>
      <p className="flex items-center gap-2 text-xs font-semibold text-violet-100 tabular-nums" aria-live="polite">
        {t(`arena.goal.${goal.kind}`, { value: formatNumber(Math.min(value, goal.target)), target: formatNumber(goal.target) })}
        {clock && (
          <span className={`flex items-center gap-0.5 ${secondsLeft !== null && secondsLeft <= 15 ? "text-red-300" : ""}`}>
            <TimerIcon className="size-3.5" aria-hidden="true" />
            {clock}
          </span>
        )}
      </p>
    </div>
  )
}
