"use client"

import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useEffect, useState } from "react"
import { CheckIcon, GiftIcon, StarIcon, TimerIcon, TrophyIcon } from "lucide-react"
import { toast } from "sonner"

import { MODE_THEME, PANEL } from "@/components/game-ui/game-ui-classes"
import { formatCountdown } from "@/lib/daily-reset-clock"
import { fetchJsonWithFirebaseIdToken } from "@/lib/firebase/fetch-json-with-firebase-id-token"
import { useI18n } from "@/lib/i18n"
import { ApiRoutes } from "@/lib/routes"
import { DAILY_STATUS_QUERY_KEY, LEADERBOARD_QUERY_KEY } from "@/modules/leaderboard/use-leaderboard-queries"
import type { DailyStatusResponse } from "@/modules/player-profile/player-profile-types"
import { PLAYER_PROFILE_QUERY_KEY } from "@/modules/player-profile/use-player-profile-query"

import {
  type ClaimDailyWeekRequest,
  type ClaimDailyWeekResponse,
  DAILY_MAX_STARS,
  WEEK_PARTICIPATION_COINS,
  WEEK_RANK_TIERS,
  type WeekChestStatus,
} from "../daily-challenge-goals"

const theme = MODE_THEME.daily
const DAY_MS = 24 * 60 * 60 * 1000
const WEEK_MAX_STARS = DAILY_MAX_STARS * 7

function useClaimDailyWeekMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (request: ClaimDailyWeekRequest) =>
      fetchJsonWithFirebaseIdToken<ClaimDailyWeekResponse>(ApiRoutes.DAILY_WEEK_CLAIM, { method: "POST", body: request }),
    onSuccess: () => {
      for (const queryKey of [DAILY_STATUS_QUERY_KEY, PLAYER_PROFILE_QUERY_KEY, LEADERBOARD_QUERY_KEY]) void queryClient.invalidateQueries({ queryKey })
    },
  })
}

/** "2d 04:12:30" khi còn hơn 1 ngày, không thì "04:12:30". */
function useEndsIn(endsAt: number): string | null {
  const [text, setText] = useState<string | null>(null)
  useEffect(() => {
    const tick = () => {
      const left = Math.max(0, endsAt - Date.now())
      const days = Math.floor(left / DAY_MS)
      setText(`${days > 0 ? `${days}d ` : ""}${formatCountdown(left % DAY_MS)}`)
    }
    const first = window.setTimeout(tick, 0)
    const timer = window.setInterval(tick, 1000)
    return () => {
      window.clearTimeout(first)
      window.clearInterval(timer)
    }
  }, [endsAt])
  return text
}

/** Thanh sao tuần với các rương đặt đúng mốc sao; rương đủ sao → nút nhận. */
function WeekStarTrack({ week, stars, chests, onClaim, pending }: { week: string; stars: number; chests: WeekChestStatus[]; onClaim: (request: ClaimDailyWeekRequest) => void; pending: boolean }) {
  const { t, formatNumber } = useI18n()
  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex items-center gap-2">
        <StarIcon className="size-4 shrink-0 fill-[#ffcf4a] text-[#ffcf4a]" aria-hidden="true" />
        <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-[#2f2863]" role="progressbar" aria-valuemin={0} aria-valuemax={WEEK_MAX_STARS} aria-valuenow={stars}>
          <div className="h-full rounded-full bg-[#ffcf4a]" style={{ width: `${Math.round((stars / WEEK_MAX_STARS) * 100)}%` }} />
        </div>
        <span className="text-xs font-bold tabular-nums">{t("daily.weekStars", { stars, max: WEEK_MAX_STARS })}</span>
      </div>
      <ul className="grid grid-cols-2 gap-2">
        {chests.map((chest) => (
          <li key={chest.index} className="flex items-center gap-2 rounded-2xl bg-[#2a2459] p-2.5">
            <GiftIcon className={`size-6 shrink-0 ${chest.reached ? "text-[#ffb547]" : "text-[#6b5fa8]"}`} aria-hidden="true" />
            <span className="flex min-w-0 flex-1 flex-col leading-tight">
              <span className="text-[13px] font-extrabold">{t("daily.chest", { stars: chest.stars })}</span>
              <span className="text-xs text-[#ffcf7a] tabular-nums">{formatNumber(chest.coins)}</span>
            </span>
            {chest.claimed ? (
              <CheckIcon className="size-4.5 text-[#9fe3db]" aria-label={t("daily.claimed")} />
            ) : (
              <button
                className="h-8 rounded-lg bg-[#ff8a3d] px-2.5 text-xs font-extrabold text-[#2a1600] disabled:bg-[#3a2f6b] disabled:text-white/40"
                disabled={!chest.reached || pending}
                onClick={() => onClaim({ week, kind: "chest", index: chest.index })}
              >
                {t("daily.claim")}
              </button>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}

/**
 * Thử thách tuần: tổng điểm cao nhất mỗi ngày (bảng xếp hạng tuần), sao gom từ mốc mỗi ngày mở rương, thưởng hạng
 * nhận vào tuần sau. Tuần trước còn quà chưa nhận thì hiện khung nhận ở dưới.
 */
export function DailyChallengeWeekCard({ status }: { status: DailyStatusResponse }) {
  const { t, formatNumber } = useI18n()
  const claim = useClaimDailyWeekMutation()
  const endsIn = useEndsIn(status.week.endsAt)
  const { week, previousWeek } = status
  const claimReward = (request: ClaimDailyWeekRequest) =>
    claim.mutate(request, {
      onSuccess: (result) => toast.success(t("daily.claimedCoins", { coins: formatNumber(result.coins) })),
      onError: () => toast.error(t("reward.claimFailed")),
    })
  const tiers = [...WEEK_RANK_TIERS.map((tier) => [t(`daily.rankTier.${tier.key}`), tier.coins] as const), [t("daily.rankTier.all"), WEEK_PARTICIPATION_COINS] as const]
  const lastWeekGifts = previousWeek ? previousWeek.chests.filter((chest) => chest.reached && !chest.claimed).length + (previousWeek.rankClaimable && !previousWeek.rankClaimed && previousWeek.rankCoins > 0 ? 1 : 0) : 0

  return (
    <>
      {previousWeek && lastWeekGifts > 0 && (
        <section className={`flex flex-col gap-3 rounded-3xl border-2 border-[#ff8a3d] p-4 ${theme.card}`}>
          <span className="font-extrabold">{t("daily.lastWeek")}</span>
          {previousWeek.rank !== null && (
            <span className={`text-sm ${theme.soft}`}>
              {t("daily.lastWeekResult", { rank: formatNumber(previousWeek.rank), total: formatNumber(previousWeek.total ?? 0) })}
            </span>
          )}
          {previousWeek.rankClaimable && !previousWeek.rankClaimed && previousWeek.rankCoins > 0 && (
            <button className={`${theme.button} h-12 text-lg motion-safe:animate-pulse`} disabled={claim.isPending} onClick={() => claimReward({ week: previousWeek.week, kind: "rank" })}>
              <TrophyIcon aria-hidden="true" />
              {t("daily.claimRank", { coins: formatNumber(previousWeek.rankCoins) })}
            </button>
          )}
          <WeekStarTrack week={previousWeek.week} stars={previousWeek.stars} chests={previousWeek.chests} onClaim={claimReward} pending={claim.isPending} />
        </section>
      )}

      <section className={`${PANEL} flex flex-col gap-3 p-4`}>
        <div className="flex items-baseline justify-between gap-2">
          <span className="font-extrabold">{t("daily.week")}</span>
          <span className="flex items-center gap-1 text-xs text-muted-foreground tabular-nums">
            <TimerIcon className="size-3.5" aria-hidden="true" />
            {endsIn ? t("daily.weekEndsIn", { time: endsIn }) : " "}
          </span>
        </div>
        <div className="grid grid-cols-2 gap-2.5 text-center">
          <div className="rounded-2xl bg-[#2a2459] p-2.5">
            <span className="block font-heading text-2xl font-extrabold tabular-nums">{week.total !== null ? formatNumber(week.total) : "—"}</span>
            <span className="text-xs text-muted-foreground">{t("daily.weekTotal")}</span>
          </div>
          <div className="rounded-2xl bg-[#2a2459] p-2.5">
            <span className="block font-heading text-2xl font-extrabold tabular-nums">{week.rank !== null ? `#${formatNumber(week.rank)}` : "—"}</span>
            <span className="text-xs text-muted-foreground">{t("daily.weekRank")}</span>
          </div>
        </div>
        <WeekStarTrack week={week.week} stars={week.stars} chests={week.chests} onClaim={claimReward} pending={claim.isPending} />
        <span className="flex items-center gap-2 text-[13px] font-extrabold">
          <TrophyIcon className="size-4 text-[#ffcf4a]" aria-hidden="true" />
          {t("daily.rankRewards")}
        </span>
        <ul className="grid grid-cols-5 gap-1.5 text-center">
          {tiers.map(([label, coins]) => (
            <li key={label} className="flex flex-col items-center gap-0.5 rounded-xl bg-[#2a2459] px-1 py-2">
              <span className="text-[11px] leading-tight font-bold">{label}</span>
              <span className="text-[13px] font-extrabold text-[#ffcf7a] tabular-nums">{formatNumber(coins)}</span>
            </li>
          ))}
        </ul>
        <span className="text-xs text-muted-foreground">{t("daily.weekHint")}</span>
      </section>
    </>
  )
}
