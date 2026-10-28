"use client"

import Link from "next/link"
import { CalendarDaysIcon } from "lucide-react"

import { MODE_THEME } from "@/components/game-ui/game-ui-classes"
import { useDailyResetCountdown } from "@/lib/daily-reset-clock"
import { useI18n } from "@/lib/i18n"
import { Routes } from "@/lib/routes"
import { useDailyStatusQuery } from "@/modules/leaderboard/use-leaderboard-queries"

const theme = MODE_THEME.daily

/** Thẻ thử thách ngày: nói rõ luật trong 1 dòng + đồng hồ đổi bộ khối; bấm vào xem giải thích đầy đủ. */
export function HomeDailyCard() {
  const { t, formatNumber } = useI18n()
  const countdown = useDailyResetCountdown()
  const status = useDailyStatusQuery().data
  const todayScore = status?.todayScore ?? null
  const giftWaiting = status?.reward.claimable ?? false

  return (
    <Link href={Routes.DAILY} className={`flex items-center gap-3.5 rounded-3xl px-4 py-3.5 transition hover:brightness-110 ${theme.card}`}>
      <span className={`flex size-12 shrink-0 items-center justify-center rounded-2xl ${theme.icon}`}>
        <CalendarDaysIcon className="size-6.5" aria-hidden="true" />
      </span>
      <span className="flex min-w-0 flex-col gap-0.5">
        <span className="font-heading text-[19px] leading-tight font-extrabold">{t("daily.title")}</span>
        <span className={`text-[13px] ${theme.soft}`}>{t("daily.cardLine")}</span>
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
