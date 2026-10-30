"use client"

import Link from "next/link"
import { AwardIcon, TrophyIcon } from "lucide-react"
import { toast } from "sonner"

import { PageHeader } from "@/components/game-ui/page-header"
import { ApiRequestError } from "@/lib/firebase/fetch-json-with-firebase-id-token"
import { useI18n } from "@/lib/i18n"
import { Routes } from "@/lib/routes"
import { PlayerTierBadge } from "@/modules/progression/components/player-tier-badge"
import { SEASON_MIN_GAMES } from "@/modules/progression/season-rules"

import { formatSeasonKey, useClaimSeasonRewardMutation, useSeasonStatusQuery } from "../use-season-queries"
import { SeasonMissionList } from "./season-mission-list"

/** Mùa giải tháng: ngày còn lại, số ván / Bậc cao nhất, nhiệm vụ mùa, thưởng hạng + huy hiệu mùa trước. */
export function SeasonPageClient() {
  const { t, formatNumber } = useI18n()
  const query = useSeasonStatusQuery()
  const claim = useClaimSeasonRewardMutation()
  const status = query.data

  if (query.isError) return <p className="text-sm text-destructive">{t("season.loadFailed")}</p>
  if (!status) return <p className="text-sm text-muted-foreground">{t("profile.loading")}</p>

  const previous = status.previous
  const claimRank = () =>
    claim.mutate(
      { kind: "rank" },
      {
        onSuccess: (result) => toast.success(t("season.rankClaimed", { coins: formatNumber(result.coins) })),
        onError: (error) => toast.error(t(error instanceof ApiRequestError && error.code === "under-review" ? "season.underReview" : "season.claimFailed")),
      }
    )

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title={t("season.title", { season: formatSeasonKey(status.season) })} />
      <p className="text-[13px] text-muted-foreground">{t("season.description", { days: status.daysLeft, min: SEASON_MIN_GAMES })}</p>
      <div className="grid grid-cols-2 gap-2 text-center">
        <div className="flex flex-col items-center gap-1 rounded-2xl bg-card py-3">
          <span className="font-heading text-2xl font-extrabold tabular-nums">
            {formatNumber(status.games)}/{SEASON_MIN_GAMES}
          </span>
          <span className="text-[11px] text-muted-foreground">{t("season.games")}</span>
        </div>
        <div className="flex flex-col items-center gap-1 rounded-2xl bg-card py-3">
          <PlayerTierBadge tier={status.peakTier} />
          <span className="text-[11px] text-muted-foreground">{t("season.peakTier")}</span>
        </div>
      </div>
      <Link href={Routes.LEADERBOARD} className="flex items-center justify-center gap-2 rounded-2xl bg-[#10322f] py-2.5 text-sm font-bold text-[#9fe3db]">
        <TrophyIcon className="size-4" aria-hidden="true" />
        {t("season.leaderboard")}
      </Link>

      <section aria-label={t("season.missions")} className="flex flex-col gap-2">
        <span className="font-extrabold">{t("season.missions")}</span>
        <SeasonMissionList season={status.season} missions={status.missions} />
      </section>

      {previous && (
        <section aria-label={t("season.previous")} className="flex flex-col gap-2 rounded-3xl border-2 border-[#ffb547] bg-card p-4">
          <span className="flex items-center gap-2 font-extrabold">
            <AwardIcon className="size-5 text-[#ffb547]" aria-hidden="true" />
            {t("season.previousTitle", { season: formatSeasonKey(previous.season) })}
          </span>
          <span className="text-sm">
            {previous.rank !== null ? t("season.previousRank", { rank: formatNumber(previous.rank) }) : t("season.previousNoRank")} ·{" "}
            {t("season.previousGames", { games: formatNumber(previous.games) })}
          </span>
          {previous.badge && (
            <span className="flex items-center gap-2 text-sm">
              {t("season.badge")} <PlayerTierBadge tier={previous.peakTier} />
            </span>
          )}
          {previous.claimed ? (
            <span className="text-xs text-[#2ec4b6]">{t("season.rankAlreadyClaimed")}</span>
          ) : previous.claimable && (previous.rankCoins > 0 || previous.badge) ? (
            <button onClick={claimRank} disabled={claim.isPending} className="rounded-2xl bg-[#ffb547] py-2.5 font-bold text-[#2a1600] disabled:opacity-50">
              {t("season.claimRank", { coins: formatNumber(previous.rankCoins) })}
            </button>
          ) : (
            <span className="text-xs text-muted-foreground">{t(previous.claimable ? "season.nothingToClaim" : "season.notFinished", { min: SEASON_MIN_GAMES })}</span>
          )}
        </section>
      )}
    </div>
  )
}
