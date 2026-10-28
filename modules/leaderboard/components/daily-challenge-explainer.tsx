"use client"

import Link from "next/link"
import { FlameIcon, PlayIcon, TimerIcon, TrophyIcon, UsersIcon } from "lucide-react"

import { MODE_THEME, PANEL } from "@/components/game-ui/game-ui-classes"
import { PageHeader } from "@/components/game-ui/page-header"
import { useDailyResetCountdown } from "@/lib/daily-reset-clock"
import { useI18n } from "@/lib/i18n"
import { Routes } from "@/lib/routes"
import { guestTagFromUid } from "@/modules/player-profile/player-profile-types"
import { DailyRewardTrack } from "@/modules/progression/components/daily-reward-track"
import { PushReminderToggle } from "@/modules/push/components/push-reminder-toggle"

import { useDailyStatusQuery, useLeaderboardQuery } from "../use-leaderboard-queries"

const theme = MODE_THEME.daily
const RULE_TILE = `${PANEL} flex flex-col gap-2 p-3.5`

/** 7 chấm của tuần: các ngày gần nhất trong chuỗi tô cam, hôm nay (chưa chơi) viền cam. */
function StreakDots({ current, playedToday }: { current: number; playedToday: boolean }) {
  const filledBefore = playedToday ? current - 1 : current
  return (
    <span className="flex gap-1" aria-hidden="true">
      {Array.from({ length: 7 }, (_, index) => {
        const isToday = index === 6
        const filled = isToday ? playedToday : 6 - index <= filledBefore
        return <span key={index} className={`size-3.5 rounded-full ${filled ? "bg-[#ff8a3d]" : isToday ? "border-2 border-[#ff8a3d]" : "bg-[#2f2863]"}`} />
      })}
    </span>
  )
}

/** Trang /daily: thử thách ngày là gì (4 ô hình), đồng hồ đổi bộ khối, top hôm nay, nút chơi. */
export function DailyChallengeExplainer() {
  const { t, formatNumber, localeTag } = useI18n()
  const countdown = useDailyResetCountdown()
  const status = useDailyStatusQuery().data
  const top = useLeaderboardQuery("daily").data?.top.slice(0, 3) ?? []
  const played = status?.todayScore !== null && status?.todayScore !== undefined
  const streak = status?.streak.current ?? 0
  const date = status ? new Date(Date.UTC(Number(status.day.slice(0, 4)), Number(status.day.slice(4, 6)) - 1, Number(status.day.slice(6, 8)))) : null
  const weekday = date ? date.toLocaleDateString(localeTag, { weekday: "short", timeZone: "UTC" }) : ""
  const dayOfMonth = date ? String(date.getUTCDate()) : ""

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title={t("daily.title")} />

      <section className={`flex items-center gap-4 rounded-3xl p-4 ${theme.card}`}>
        <div className="flex h-20 w-[74px] shrink-0 flex-col overflow-hidden rounded-2xl bg-white text-[#2a1600]" aria-hidden="true">
          <span className="bg-[#ff8a3d] py-0.5 text-center text-xs font-extrabold">{weekday}</span>
          <span className="flex flex-1 items-center justify-center font-heading text-4xl font-extrabold">{dayOfMonth}</span>
        </div>
        <div className="flex flex-col gap-1">
          <span className="font-heading text-[22px] leading-tight font-extrabold">{t("daily.todaysBlocks")}</span>
          <span className={`flex items-center gap-1.5 text-sm ${theme.soft}`}>
            <TimerIcon className="size-4" aria-hidden="true" />
            {countdown ? t("daily.changesIn", { time: countdown }) : " "}
          </span>
          {played && <span className="text-sm font-bold">{t("daily.done", { score: formatNumber(status?.todayScore ?? 0) })}</span>}
        </div>
      </section>

      <ul className="grid grid-cols-2 gap-2.5">
        <li className={RULE_TILE}>
          <UsersIcon className="size-7 text-[#ffb547]" aria-hidden="true" />
          <span className="leading-tight font-extrabold">{t("daily.ruleSame")}</span>
          <span className="text-xs text-muted-foreground">{t("daily.ruleSameSub")}</span>
        </li>
        <li className={RULE_TILE}>
          <span className="font-heading text-3xl leading-none font-extrabold text-[#ffb547]" aria-hidden="true">1</span>
          <span className="leading-tight font-extrabold">{t("daily.ruleOne")}</span>
          <span className="text-xs text-muted-foreground">{t("daily.ruleOneSub")}</span>
        </li>
        <li className={RULE_TILE}>
          <StreakDots current={streak} playedToday={played} />
          <span className="leading-tight font-extrabold">{t("daily.ruleStreak")}</span>
          <span className={`flex items-center gap-1 text-xs ${theme.soft}`}>
            <FlameIcon className="size-3.5 fill-[#ff8a3d] text-[#ff8a3d]" aria-hidden="true" />
            {t("daily.days", { count: streak })}
          </span>
        </li>
        <li className={RULE_TILE}>
          <TrophyIcon className="size-7 text-[#2ec4b6]" aria-hidden="true" />
          <span className="leading-tight font-extrabold">{t("daily.ruleBoard")}</span>
          <span className="text-xs text-muted-foreground">{t("daily.ruleBoardSub")}</span>
        </li>
      </ul>

      <DailyRewardTrack />

      {top.length > 0 && (
        <section aria-label={t("daily.topToday")} className={`${PANEL} px-4 py-1.5`}>
          {top.map((row, index) => (
            <div key={row.uid} className="flex items-center gap-3 border-b border-border py-2.5 last:border-0">
              <span className="w-5 font-extrabold text-[#ffcf7a]">{index + 1}</span>
              <span className="flex-1 truncate font-semibold">{row.displayName ?? t("profile.guestName", { tag: guestTagFromUid(row.uid) })}</span>
              <span className="font-extrabold tabular-nums">{formatNumber(row.score)}</span>
            </div>
          ))}
        </section>
      )}

      {streak >= 2 && <PushReminderToggle onlyOffer enableLabel={t("push.streakPrompt")} />}

      <Link href={Routes.PLAY_DAILY} className={`${theme.button} h-16 text-[23px] [&_svg]:size-6`}>
        <PlayIcon className="fill-current" aria-hidden="true" />
        {t(played ? "daily.practice" : "daily.playToday")}
      </Link>
    </div>
  )
}
