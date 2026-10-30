"use client"

import Link from "next/link"
import { useQuery } from "@tanstack/react-query"
import { GhostIcon, PlayIcon } from "lucide-react"

import { PageHeader } from "@/components/game-ui/page-header"
import { fetchJsonWithFirebaseIdToken } from "@/lib/firebase/fetch-json-with-firebase-id-token"
import { useI18n } from "@/lib/i18n"
import { ApiRoutes, Routes } from "@/lib/routes"
import { LeaderboardTable } from "@/modules/leaderboard/components/leaderboard-table"
import { useSignedInUid } from "@/modules/player-profile/use-player-profile-query"

import type { RankedStatusResponse } from "../ranked-types"
import { LEAGUES } from "../rating-rules"

export const RANKED_STATUS_QUERY_KEY = ["ranked-status"] as const

/** Đấu xếp hạng: giải + LP + tiến độ lên giải, nút tìm trận, BXH LP mùa quý. */
export function RankedPageClient() {
  const { t, formatNumber } = useI18n()
  const uid = useSignedInUid()
  const status = useQuery({
    queryKey: [...RANKED_STATUS_QUERY_KEY, uid],
    queryFn: () => fetchJsonWithFirebaseIdToken<RankedStatusResponse>(ApiRoutes.RANKED_STATUS, { method: "GET" }),
    enabled: uid !== null,
    staleTime: 15_000,
  }).data

  const next = status ? LEAGUES.find((league) => league.minLp > status.lp) : undefined
  const current = status ? [...LEAGUES].reverse().find((league) => status.lp >= league.minLp)! : LEAGUES[0]
  const percent = status && next ? Math.round(((status.lp - current.minLp) / (next.minLp - current.minLp)) * 100) : 100

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title={t("ranked.title")} />
      <p className="text-[13px] text-muted-foreground">{t("ranked.description")}</p>
      {status && (
        <section aria-label={t("ranked.title")} className="flex flex-col gap-2 rounded-3xl bg-card p-4">
          <span className="flex items-center gap-2 font-heading text-xl font-extrabold">
            <GhostIcon className="size-5 text-[#c86bfa]" aria-hidden="true" />
            {status.placementsLeft > 0 ? t("ranked.placing") : t(`ranked.league.${status.league}`)}
          </span>
          {status.placementsLeft > 0 ? (
            <span className="text-sm">{t("ranked.placementsLeft", { count: status.placementsLeft })}</span>
          ) : (
            <>
              <span className="text-sm tabular-nums">
                {formatNumber(status.lp)} LP{next ? ` · ${t("ranked.toNext", { lp: formatNumber(next.minLp - status.lp), league: t(`ranked.league.${next.id}`) })}` : ""}
              </span>
              <div className="h-2 overflow-hidden rounded-full bg-[#2f2863]" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent}>
                <div className="h-full rounded-full bg-[#c86bfa]" style={{ width: `${percent}%` }} />
              </div>
            </>
          )}
          <span className="text-xs text-muted-foreground">
            {t("ranked.record", { wins: status.wins, losses: status.losses, draws: status.draws, season: status.season })}
          </span>
        </section>
      )}
      <Link href={`${Routes.PLAY}?ranked=1`} className="flex items-center justify-center gap-2 rounded-2xl bg-[#c86bfa] py-3.5 text-lg font-extrabold text-[#22062f] hover:brightness-110">
        <PlayIcon className="size-5" aria-hidden="true" />
        {t("ranked.play")}
      </Link>
      <span className="font-extrabold">{t("ranked.leaderboard")}</span>
      <LeaderboardTable period="alltime" category="ranked" />
    </div>
  )
}
