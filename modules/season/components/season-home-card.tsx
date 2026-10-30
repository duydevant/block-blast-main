"use client"

import Link from "next/link"
import { CalendarRangeIcon, ChevronRightIcon } from "lucide-react"

import { useI18n } from "@/lib/i18n"
import { Routes } from "@/lib/routes"

import { formatSeasonKey, useSeasonStatusQuery } from "../use-season-queries"

/** Thẻ mùa ở trang chủ: tháng, ngày còn lại, nhiệm vụ mùa đã xong / nhận được, báo khi có thưởng mùa trước. */
export function SeasonHomeCard() {
  const { t } = useI18n()
  const status = useSeasonStatusQuery().data
  if (!status) return null
  const done = status.missions.filter((mission) => mission.progress >= mission.target).length
  const claimable = status.missions.some((mission) => mission.progress >= mission.target && !mission.claimed) || (status.previous?.claimable && !status.previous.claimed)

  return (
    <Link href={Routes.SEASON} className="flex items-center gap-3 rounded-3xl bg-card p-3.5 hover:brightness-110">
      <CalendarRangeIcon className="size-7 text-[#c86bfa]" aria-hidden="true" />
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="font-heading text-lg leading-none font-extrabold">{t("season.title", { season: formatSeasonKey(status.season) })}</span>
        <span className="truncate text-[13px] text-muted-foreground">
          {t("season.homeSub", { days: status.daysLeft, done, total: status.missions.length })}
        </span>
      </span>
      {claimable && <span className="rounded-full bg-[#ffb547] px-2 py-0.5 text-xs font-bold text-[#2a1600]">{t("season.reward")}</span>}
      <ChevronRightIcon className="size-4" aria-hidden="true" />
    </Link>
  )
}
