"use client"

import { useI18n } from "@/lib/i18n"
import { usePlayerProfileQuery } from "@/modules/player-profile/use-player-profile-query"

import { FORM_MIN_GAMES, FORM_WINDOW, nextTierTarget } from "../player-form-rules"
import { PlayerTierBadge } from "./player-tier-badge"

/** Một dòng Bậc + phong độ + khoảng cách tới Bậc kế (hộp hết ván, hồ sơ). */
export function TierProgressNote({ className = "" }: { className?: string }) {
  const { t, formatNumber } = useI18n()
  const profile = usePlayerProfileQuery().data
  if (!profile) return null

  const next = nextTierTarget(profile.form)
  const detail =
    profile.form === null
      ? t("form.unranked", { count: Math.max(1, FORM_MIN_GAMES - profile.formGames) })
      : next
        ? t("form.next", { need: formatNumber(next.minForm - profile.form), tier: t(`tier.${next.tier}`) })
        : t("form.max")

  return (
    <p className={`flex flex-wrap items-center justify-center gap-1.5 text-xs text-violet-200/80 ${className}`} title={t("form.explain", { window: FORM_WINDOW })}>
      <PlayerTierBadge tier={profile.tier} />
      {profile.form !== null && (
        <span className="font-bold text-white">
          {t("form.label")} {formatNumber(profile.form)}
        </span>
      )}
      <span>· {detail}</span>
    </p>
  )
}
