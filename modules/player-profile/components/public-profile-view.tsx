"use client"

import Link from "next/link"
import { PlayCircleIcon, TrophyIcon } from "lucide-react"

import { PageHeader } from "@/components/game-ui/page-header"
import { type TranslationKey, useI18n } from "@/lib/i18n"
import { Routes } from "@/lib/routes"
import { PlayerTierBadge } from "@/modules/progression/components/player-tier-badge"

import type { PublicPlayerProfile } from "../public-player-types"

/** Hồ sơ công khai: Bậc, phong độ, kỷ lục (kèm link xem lại), số liệu chính, thành tích đã đạt. */
export function PublicProfileView({ profile }: { profile: PublicPlayerProfile }) {
  const { t, formatNumber } = useI18n()
  const name = profile.displayName ?? t("profile.guestName", { tag: profile.guestTag })
  const tiles: [TranslationKey, string][] = [
    ["profile.statGames", formatNumber(profile.stats.gamesPlayed)],
    ["profile.statBest", formatNumber(profile.stats.bestScore)],
    ["profile.statCombo", `×${formatNumber(profile.stats.bestCombo)}`],
    ["profile.statLines", formatNumber(profile.stats.totalLinesCleared)],
    ["profile.statStreak", formatNumber(profile.bestStreak)],
    ["profile.statDuels", `${formatNumber(profile.duelStats.won)}/${formatNumber(profile.duelStats.played)}`],
    ["publicProfile.pureBest", formatNumber(profile.stats.bestPureScore)],
    ["publicProfile.levelStars", `${formatNumber(profile.levelStarsTotal)}★`],
    ["form.label", profile.form === null ? "–" : formatNumber(profile.form)],
  ]

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title={name} backHref={Routes.LEADERBOARD} />
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <PlayerTierBadge tier={profile.tier} />
        {profile.highestTier !== profile.tier && profile.highestTier !== "unranked" && (
          <span className="text-xs text-muted-foreground">{t("publicProfile.highestTier", { tier: t(`tier.${profile.highestTier}`) })}</span>
        )}
      </div>
      {profile.bestReplayId && (
        <Link
          href={`${Routes.REPLAY}/${profile.bestReplayId}`}
          className="flex items-center gap-2 rounded-2xl bg-[#ffb547] px-4 py-3 font-bold text-[#2a1600] hover:brightness-110"
        >
          <PlayCircleIcon className="size-5" aria-hidden="true" />
          {t("publicProfile.watchBest", { score: formatNumber(profile.stats.bestScore) })}
        </Link>
      )}
      <section aria-label={t("profile.statsTitle")} className="grid grid-cols-3 gap-2">
        {tiles.map(([label, value]) => (
          <div key={label} className="flex flex-col items-center gap-0.5 rounded-2xl bg-card px-2 py-2.5">
            <span className="font-heading text-[20px] leading-tight font-extrabold tabular-nums">{value}</span>
            <span className="text-[11px] text-muted-foreground">{t(label)}</span>
          </div>
        ))}
      </section>
      {profile.achievements.length > 0 && (
        <section aria-label={t("achievements.title")} className="flex flex-col gap-2">
          <span className="font-extrabold">{t("achievements.title")}</span>
          <ul className="flex flex-wrap gap-1.5">
            {profile.achievements.map((id) => (
              <li key={id} className="flex items-center gap-1 rounded-full bg-card px-2.5 py-1 text-xs font-bold">
                <TrophyIcon className="size-3.5 text-[#ffb547]" aria-hidden="true" />
                {t(`achievement.${id}` as TranslationKey)}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
