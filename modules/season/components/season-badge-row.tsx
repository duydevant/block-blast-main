"use client"

import { useI18n } from "@/lib/i18n"
import { PlayerTierBadge } from "@/modules/progression/components/player-tier-badge"
import { parseSeasonBadge } from "@/modules/progression/season-rules"

import { formatSeasonKey } from "../use-season-queries"

/** Huy hiệu các mùa đã nhận: "11/2026" + Bậc cao nhất của mùa đó. */
export function SeasonBadgeRow({ badges }: { badges: readonly string[] }) {
  const { t } = useI18n()
  const parsed = badges.flatMap((id) => parseSeasonBadge(id) ?? [])
  if (parsed.length === 0) return null
  return (
    <div className="flex flex-wrap items-center gap-1.5" aria-label={t("season.badges")}>
      <span className="text-[11px] font-bold text-muted-foreground">{t("season.badges")}</span>
      {parsed.map((badge) => (
        <span key={badge.season} className="flex items-center gap-1 rounded-full bg-[#2a2459] py-0.5 pr-0.5 pl-2 text-[11px] font-bold">
          {formatSeasonKey(badge.season)}
          <PlayerTierBadge tier={badge.tier} compact />
        </span>
      ))}
    </div>
  )
}
