"use client"

import Link from "next/link"
import { ChevronRightIcon, LayoutGridIcon, RotateCcwIcon, StarIcon, TimerOffIcon } from "lucide-react"
import { toast } from "sonner"

import { CHUNKY_BUTTON, MODE_THEME } from "@/components/game-ui/game-ui-classes"
import { AlertDialogTitle } from "@/components/ui/alert-dialog"
import { useI18n } from "@/lib/i18n"
import { Routes } from "@/lib/routes"
import { isOutOfMoves } from "@/modules/block-puzzle/engine/game-state-reducer"
import { useBlockPuzzleGameStore } from "@/modules/block-puzzle/store/block-puzzle-game-store"
import { useLastGameRewardsStore } from "@/modules/progression/last-game-rewards-store"

import { findLevel, type LevelDefinition, levelGoalProgress, starsForLevel } from "../level-catalog"
import { startLevelGame } from "../start-variant-game"

const NOTE = "text-xs text-violet-200/80"
const NOTE_LINK = "underline underline-offset-2 hover:text-white"
const CHIP = "rounded-full bg-[#1b3a66] px-2.5 py-1 text-[13px] font-bold"
const SMALL_BUTTON =
  "flex h-12 items-center justify-center gap-1.5 rounded-xl bg-[#1b3a66] font-bold text-white transition hover:bg-[#244a80] [&_svg]:size-4.5"

/** Kết quả màn đang chơi (null nếu ván không phải màn chơi). */
export function useLevelOutcome(): { definition: LevelDefinition; stars: number } | null {
  const run = useBlockPuzzleGameStore((state) => state.variantRun)
  const game = useBlockPuzzleGameStore((state) => state.game)
  const definition = run?.kind === "level" ? findLevel(run.levelId) : undefined
  return definition && game ? { definition, stars: starsForLevel(definition, game) } : null
}

/** 3 ngôi sao, sao giữa to hơn (như các game giải đố). */
export function LevelStarsRow({ stars }: { stars: number }) {
  return (
    <span className="flex items-end justify-center gap-1.5" aria-label={`${stars}/3`}>
      {[1, 2, 3].map((index) => (
        <StarIcon
          key={index}
          className={`${index === 2 ? "size-15" : "size-11"} ${index <= stars ? "fill-[#ffcf4a] text-[#ffcf4a]" : "text-[#3d5a8a]"}`}
          aria-hidden="true"
        />
      ))}
    </span>
  )
}

/** Ghi chú cuối hộp hết ván cho sự kiện (màn chơi có bảng kết quả riêng, đấu 1v1 có bảng trận riêng). */
export function VariantGameOverNote() {
  const { t } = useI18n()
  const run = useBlockPuzzleGameStore((state) => state.variantRun)
  if (!run || run.kind !== "event") return null
  return (
    <p className={NOTE}>
      <Link href={Routes.EVENT} className={NOTE_LINK}>
        {t("event.goals")}
      </Link>
    </p>
  )
}

/**
 * Bảng kết quả màn chơi trong hộp hết ván: qua màn → sao + số nước + xu + "Màn tiếp";
 * chưa qua → lý do (hết nước / hết chỗ) + tiến độ mục tiêu + chỉ có "Chơi lại" (màn chơi không hồi sinh).
 */
export function LevelResultPanel({ definition, stars }: { definition: LevelDefinition; stars: number }) {
  const { t, formatNumber } = useI18n()
  const game = useBlockPuzzleGameStore((state) => state.game)
  const gameId = useBlockPuzzleGameStore((state) => state.rankedSession?.gameId ?? null)
  const coins = useLastGameRewardsStore((state) => (state.gameId !== null && state.gameId === gameId ? state.rewards?.coins : undefined))
  const next = stars > 0 ? findLevel(definition.id + 1) : undefined
  const play = (levelId: number) =>
    void startLevelGame(levelId).catch((error: unknown) => {
      console.warn("[levels] start failed", error)
      toast.error(t("levels.startFailed"))
    })

  if (stars > 0) {
    return (
      <>
        <LevelStarsRow stars={stars} />
        <AlertDialogTitle className="font-heading text-[32px] leading-none font-extrabold">{t("levels.levelDone", { id: definition.id })}</AlertDialogTitle>
        <span className="flex flex-wrap justify-center gap-2">
          <span className={CHIP}>{t("levels.movesUsed", { used: game?.moveCount ?? 0, limit: definition.moveLimit })}</span>
          {coins !== undefined && coins > 0 && <span className={`${CHIP} text-[#ffcf7a]`}>+{formatNumber(coins)} {t("ui.coins")}</span>}
        </span>
        {next ? (
          <button className={`${MODE_THEME.levels.button} h-14 w-full text-[21px]`} onClick={() => play(next.id)}>
            {t("levels.nextShort", { id: next.id })}
            <ChevronRightIcon aria-hidden="true" />
          </button>
        ) : (
          <Link href={Routes.LEVELS} className={`${MODE_THEME.levels.button} h-14 w-full text-[21px]`}>
            {t("levels.allShort")}
          </Link>
        )}
        <div className="grid w-full grid-cols-2 gap-2.5">
          <button className={SMALL_BUTTON} onClick={() => play(definition.id)}>
            <RotateCcwIcon aria-hidden="true" />
            {t("levels.retry")}
          </button>
          <Link href={Routes.LEVELS} className={SMALL_BUTTON}>
            <LayoutGridIcon aria-hidden="true" />
            {t("levels.allShort")}
          </Link>
        </div>
      </>
    )
  }

  const progress = game ? Math.min(levelGoalProgress(definition, game), definition.goal.target) : 0
  const percent = Math.round((progress / definition.goal.target) * 100)
  const outOfMoves = game ? isOutOfMoves(game) : false
  return (
    <>
      <TimerOffIcon className="size-11 text-[#ff8a8a]" aria-hidden="true" />
      <AlertDialogTitle className="font-heading text-[28px] leading-none font-extrabold">
        {t(outOfMoves ? "levels.outOfMoves" : "levels.outOfSpace")}
      </AlertDialogTitle>
      <div className="flex w-full flex-col gap-1.5">
        <div className="flex justify-between text-[13px] font-bold">
          <span>{t(`levels.goal.${definition.goal.kind}`, { target: formatNumber(definition.goal.target) })}</span>
          <span className="tabular-nums">
            {formatNumber(progress)}/{formatNumber(definition.goal.target)}
          </span>
        </div>
        <div className="h-2.5 overflow-hidden rounded-full bg-[#2f2863]" role="progressbar" aria-valuemin={0} aria-valuemax={definition.goal.target} aria-valuenow={progress}>
          <div className="h-full rounded-full bg-[#4ea8ff]" style={{ width: `${percent}%` }} />
        </div>
      </div>
      <button className={`${CHUNKY_BUTTON.primary} h-14 w-full text-[21px]`} onClick={() => play(definition.id)}>
        <RotateCcwIcon aria-hidden="true" />
        {t("levels.retry")}
      </button>
      <Link href={Routes.LEVELS} className={`text-sm font-semibold ${NOTE_LINK}`}>
        {t("levels.allShort")}
      </Link>
    </>
  )
}
