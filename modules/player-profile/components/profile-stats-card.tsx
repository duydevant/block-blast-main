"use client"

import { type TranslationKey, useI18n } from "@/lib/i18n"

import { EMPTY_PLAYER_STATS } from "../player-profile-types"
import { usePlayerProfileQuery } from "../use-player-profile-query"

/** Thống kê cloud dạng 6 ô số to (chỉ ván đã được server replay). */
export function ProfileStatsCard() {
  const { t, formatNumber } = useI18n()
  const query = usePlayerProfileQuery()
  const stats = query.data?.stats ?? EMPTY_PLAYER_STATS
  const duels = query.data?.duelStats

  const tiles: [TranslationKey, string][] = [
    ["profile.statGames", formatNumber(stats.gamesPlayed)],
    ["profile.statBest", formatNumber(stats.bestScore)],
    ["profile.statCombo", `×${formatNumber(stats.bestCombo)}`],
    ["profile.statLines", formatNumber(stats.totalLinesCleared)],
    ["profile.statStreak", formatNumber(query.data?.streak.best ?? 0)],
    ["profile.statDuels", duels ? `${formatNumber(duels.won)}/${formatNumber(duels.played)}` : "0/0"],
  ]

  if (query.isError) return <p className="text-sm text-destructive">{t("profile.loadFailed")}</p>
  return (
    <section aria-label={t("profile.statsTitle")} className="grid grid-cols-3 gap-2">
      {tiles.map(([label, value]) => (
        <div key={label} className="flex flex-col items-center gap-0.5 rounded-2xl bg-card px-2 py-2.5">
          <span className="font-heading text-[22px] leading-tight font-extrabold tabular-nums">{query.isPending ? "…" : value}</span>
          <span className="text-[11px] text-muted-foreground">{t(label)}</span>
        </div>
      ))}
    </section>
  )
}
