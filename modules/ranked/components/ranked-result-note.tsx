"use client"

import Link from "next/link"

import { useI18n } from "@/lib/i18n"
import { Routes } from "@/lib/routes"
import { useBlockPuzzleGameStore } from "@/modules/block-puzzle/store/block-puzzle-game-store"
import { useLastGameRewardsStore } from "@/modules/progression/last-game-rewards-store"

/** Hộp hết ván của trận xếp hạng: thắng / thua / hoà, điểm bóng ma, LP thay đổi hoặc còn bao nhiêu trận xếp hạng. */
export function RankedResultNote() {
  const { t, formatNumber } = useI18n()
  const isRanked = useBlockPuzzleGameStore((state) => state.variantRun?.kind === "ranked")
  const gameId = useBlockPuzzleGameStore((state) => state.rankedSession?.gameId ?? null)
  const result = useLastGameRewardsStore((state) => (state.gameId !== null && state.gameId === gameId ? (state.rewards?.ranked ?? null) : null))
  if (!isRanked) return null
  if (!result) return <p className="text-sm font-bold text-amber-200">{t("ranked.pending")}</p>

  const lpChange = result.lpAfter - result.lpBefore
  const detail =
    result.placementsLeft > 0
      ? t("ranked.placementsLeft", { count: result.placementsLeft })
      : t("ranked.lpLine", { lp: formatNumber(result.lpAfter), change: `${lpChange >= 0 ? "+" : ""}${formatNumber(lpChange)}`, league: t(`ranked.league.${result.league}`) })

  return (
    <p className={`flex flex-col items-center gap-1 text-sm font-bold ${result.result === "win" ? "text-[#2ec4b6]" : result.result === "loss" ? "text-red-300" : "text-amber-200"}`}>
      {t(`ranked.result.${result.result}`, { ghost: formatNumber(result.ghostScore) })}
      <span className="text-xs font-semibold text-violet-100">{detail}</span>
      <Link href={Routes.RANKED} className="text-xs font-semibold text-violet-200/80 underline underline-offset-2">
        {t("ranked.back")}
      </Link>
    </p>
  )
}
