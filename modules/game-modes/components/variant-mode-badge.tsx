"use client"

import { PartyPopperIcon, TargetIcon } from "lucide-react"

import { type TranslationKey, useI18n } from "@/lib/i18n"
import { useBlockPuzzleGameStore } from "@/modules/block-puzzle/store/block-puzzle-game-store"
import { DuelHud } from "@/modules/duel/components/duel-hud"

import { findLevel, levelGoalProgress, type LevelDefinition } from "../level-catalog"

const BADGE = "mx-auto flex items-center gap-1.5 rounded-full bg-white/8 px-3 py-1 text-xs font-semibold text-amber-200"

export function levelGoalLabel(t: ReturnType<typeof useI18n>["t"], formatNumber: (value: number) => string, definition: LevelDefinition) {
  return t(`levels.goal.${definition.goal.kind}`, { target: formatNumber(definition.goal.target) })
}

function LevelBadge({ definition }: { definition: LevelDefinition }) {
  const { t, formatNumber } = useI18n()
  const game = useBlockPuzzleGameStore((state) => state.game)
  if (!game) return null
  const progress = Math.min(levelGoalProgress(definition, game), definition.goal.target)
  const movesLeft = Math.max(0, definition.moveLimit - game.moveCount)
  return (
    <div className="mx-auto flex flex-col items-center gap-0.5">
      <p className={BADGE}>
        <TargetIcon className="size-3.5" aria-hidden="true" />
        {t("levels.badge", { id: definition.id, goal: levelGoalLabel(t, formatNumber, definition) })}
      </p>
      <p className="text-xs font-semibold text-violet-100 tabular-nums" aria-live="polite">
        {t("levels.progress", { progress: formatNumber(progress), target: formatNumber(definition.goal.target), moves: movesLeft })}
      </p>
    </div>
  )
}

/** Nhãn dưới HUD cho sự kiện tuần / màn chơi (tiến độ + số nước còn lại) / đấu 1v1 (đồng hồ + điểm đối thủ). */
export function VariantModeBadge() {
  const { t } = useI18n()
  const run = useBlockPuzzleGameStore((state) => state.variantRun)
  if (!run) return null

  if (run.kind === "duel") return <DuelHud run={run} />
  if (run.kind === "level") {
    const definition = findLevel(run.levelId)
    return definition ? <LevelBadge definition={definition} /> : null
  }
  return (
    <p className={BADGE}>
      <PartyPopperIcon className="size-3.5" aria-hidden="true" />
      {t("event.badge", { name: t(`event.${run.ruleId}.name` as TranslationKey) })}
    </p>
  )
}
