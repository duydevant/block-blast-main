"use client"

import Link from "next/link"
import { CalendarDaysIcon } from "lucide-react"

import { MODE_THEME } from "@/components/game-ui/game-ui-classes"
import { useDailyResetCountdown } from "@/lib/daily-reset-clock"
import { useI18n } from "@/lib/i18n"
import { Routes } from "@/lib/routes"
import { useDailyStatusQuery } from "@/modules/leaderboard/use-leaderboard-queries"

const theme = MODE_THEME.daily

/**
 * Thẻ thử thách ngày: luật 1 dòng (chơi rồi thì sao hôm nay + lượt còn) + đồng hồ đổi bộ khối; có quà chờ nhận
 * (thưởng chuỗi, rương sao, thưởng hạng tuần trước) thì nhãn nhảy. Bấm vào xem trang thử thách.
 */
export function HomeDailyCard() {
  const { t, formatNumber } = useI18n()
  const countdown = useDailyResetCountdown()
  const status = useDailyStatusQuery().data
  const todayScore = status?.todayScore ?? null
  const weekGift = (week: { chests: { reached: boolean; claimed: boolean }[] } | null | undefined) => Boolean(week?.chests.some((chest) => chest.reached && !chest.claimed))
  const previous = status?.previousWeek
  const giftWaiting = Boolean(status && (status.reward.claimable || weekGift(status.week) || weekGift(previous) || (previous && previous.rankClaimable && !previous.rankClaimed && previous.rankCoins > 0)))
  const runsLeft = status ? status.runs.max - status.runs.used : null

  return (
    <Link href={Routes.DAILY} className={`flex items-center gap-3.5 rounded-3xl px-4 py-3.5 transition hover:brightness-110 ${theme.card}`}>
      <span className={`flex size-12 shrink-0 items-center justify-center rounded-2xl ${theme.icon}`}>
        <CalendarDaysIcon className="size-6.5" aria-hidden="true" />
      </span>
      <span className="flex min-w-0 flex-col gap-0.5">
        <span className="font-heading text-[19px] leading-tight font-extrabold">{t("daily.title")}</span>
        <span className={`text-[13px] ${theme.soft}`}>
          {status && todayScore !== null && runsLeft !== null
            ? `${"★".repeat(status.stars)}${"☆".repeat(status.goals.targets.length - status.stars)} · ${runsLeft > 0 ? t("daily.runsLeft", { left: runsLeft, max: status.runs.max }) : t("daily.noRunsLeft")}`
            : t("daily.cardLine")}
        </span>
      </span>
      <span className="ml-auto flex shrink-0 flex-col items-end gap-1">
        <span className={`text-[13px] font-bold tabular-nums ${theme.soft}`}>{countdown ?? " "}</span>
        <span className={`rounded-xl bg-[#ff8a3d] px-2.5 py-1 text-sm font-extrabold text-[#2a1600] ${giftWaiting ? "motion-safe:animate-bounce" : ""}`}>
          {giftWaiting ? t("reward.badge") : todayScore !== null ? formatNumber(todayScore) : t("ui.play")}
        </span>
      </span>
    </Link>
  )
}
