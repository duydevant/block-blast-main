"use client"

import Link from "next/link"

import { useI18n } from "@/lib/i18n"
import { Routes } from "@/lib/routes"
import { useBlockPuzzleGameStore } from "@/modules/block-puzzle/store/block-puzzle-game-store"
import { useLastGameRewardsStore } from "@/modules/progression/last-game-rewards-store"

/** Hộp hết ván của lần thử Đấu trường: đạt / chưa đạt, lượt thắng (+xu, +XP) / thua / còn bao nhiêu lần thử. */
export function ArenaResultNote() {
  const { t, formatNumber } = useI18n()
  const isArena = useBlockPuzzleGameStore((state) => state.variantRun?.kind === "arena")
  const gameId = useBlockPuzzleGameStore((state) => state.rankedSession?.gameId ?? null)
  const result = useLastGameRewardsStore((state) => (state.gameId !== null && state.gameId === gameId ? (state.rewards?.arena ?? null) : null))
  if (!isArena) return null

  const message = !result
    ? t("arena.result.pending")
    : result.status === "won"
      ? t("arena.result.won", { coins: formatNumber(result.coins), xp: formatNumber(result.xp) })
      : result.status === "open"
        ? t(result.met ? "arena.result.metContinue" : "arena.result.missed", { left: result.attemptsLeft })
        : t(result.status === "expired" ? "arena.result.expired" : "arena.result.lost")

  return (
    <p className={`flex flex-col items-center gap-1 text-sm font-bold ${result?.status === "won" ? "text-[#2ec4b6]" : "text-amber-200"}`}>
      {message}
      <Link href={Routes.ARENA} className="text-xs font-semibold text-violet-200/80 underline underline-offset-2">
        {t("arena.back")}
      </Link>
    </p>
  )
}
