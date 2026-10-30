"use client"

import Link from "next/link"
import { ChevronRightIcon } from "lucide-react"

import { useI18n } from "@/lib/i18n"
import { Routes } from "@/lib/routes"
import { AnalysisStatsNote } from "@/modules/analysis/components/analysis-stats-note"
import { TierProgressNote } from "@/modules/progression/components/tier-progress-note"
import { FORM_WINDOW } from "@/modules/progression/player-form-rules"

import { GAME_HISTORY_MODES } from "../game-history-types"
import { usePlayerProfileQuery } from "../use-player-profile-query"
import { gameModeLabel } from "./game-mode-label"

/** Phong độ + Bậc, bảng thống kê theo chế độ, link lịch sử ván. */
export function ProfileFormAndModesCard() {
  const { t, formatNumber } = useI18n()
  const profile = usePlayerProfileQuery().data
  if (!profile) return null
  const rows = GAME_HISTORY_MODES.flatMap((mode) => {
    const stats = profile.statsByMode[mode]
    return stats && stats.games > 0 ? [{ mode, ...stats }] : []
  })

  return (
    <section aria-label={t("form.label")} className="flex flex-col gap-3 rounded-3xl bg-card p-4">
      <TierProgressNote className="justify-start" />
      <p className="text-[11px] text-muted-foreground">{t("form.explain", { window: FORM_WINDOW })}</p>
      <AnalysisStatsNote />
      {rows.length > 0 && (
        <table className="w-full text-left text-[13px]">
          <caption className="pb-1 text-left font-extrabold">{t("modeStats.title")}</caption>
          <thead className="text-[11px] text-muted-foreground">
            <tr>
              <th scope="col" className="py-1 font-semibold" />
              <th scope="col" className="py-1 text-right font-semibold">{t("modeStats.games")}</th>
              <th scope="col" className="py-1 text-right font-semibold">{t("modeStats.best")}</th>
              <th scope="col" className="py-1 text-right font-semibold">{t("modeStats.average")}</th>
            </tr>
          </thead>
          <tbody className="tabular-nums">
            {rows.map((row) => (
              <tr key={row.mode} className="border-t border-white/5">
                <th scope="row" className="py-1.5 font-bold">{gameModeLabel(t, row.mode)}</th>
                <td className="py-1.5 text-right">{formatNumber(row.games)}</td>
                <td className="py-1.5 text-right">{formatNumber(row.best)}</td>
                <td className="py-1.5 text-right">{formatNumber(Math.round(row.total / row.games))}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <Link href={Routes.PROFILE_GAMES} className="flex items-center justify-between rounded-2xl bg-[#2a2459] px-3 py-2.5 text-sm font-bold hover:brightness-110">
        {t("history.link")}
        <ChevronRightIcon className="size-4" aria-hidden="true" />
      </Link>
    </section>
  )
}
