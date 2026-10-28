"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import { CheckIcon, CoinsIcon, PartyPopperIcon, PlayIcon, TimerIcon, TrophyIcon } from "lucide-react"
import { toast } from "sonner"

import { BlockBoardPreview } from "@/components/game-ui/block-board-preview"
import { MODE_THEME, PANEL } from "@/components/game-ui/game-ui-classes"
import { PageHeader } from "@/components/game-ui/page-header"
import { formatCountdown } from "@/lib/daily-reset-clock"
import { type TranslationKey, useI18n } from "@/lib/i18n"
import { Routes } from "@/lib/routes"

import { EVENT_PARTICIPATION_COINS, EVENT_RANK_TIERS, type EventMilestoneStatus } from "../event-rewards"
import { findEventRule } from "../weekly-event-catalog"
import { useClaimEventRewardMutation, useEventStatusQuery } from "../use-event-queries"

const theme = MODE_THEME.event
const DAY_MS = 24 * 60 * 60 * 1000

/** "2d 04:12:30" khi còn hơn 1 ngày, không thì "04:12:30". */
function useEndsIn(endsAt: number | undefined): string | null {
  const [text, setText] = useState<string | null>(null)
  useEffect(() => {
    if (!endsAt) return
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

/** Bàn dựng sẵn của luật (nếu có) → chuỗi dòng cho bàn mini. */
function eventBoardRows(ruleId: string): string[] | null {
  const board = findEventRule(ruleId)?.variant.startBoard
  if (!board) return null
  return Array.from({ length: 8 }, (_, row) => board.slice(row * 8, row * 8 + 8).map((cell) => (cell ? "6" : ".")).join(""))
}

/**
 * Trang /event: sự kiện tuần có mục tiêu rõ — 3 mốc điểm nhận xu ngay, thưởng hạng cuối tuần nhận tuần sau.
 */
export function WeeklyEventPage() {
  const { t, formatNumber } = useI18n()
  const { data, isError } = useEventStatusQuery()
  const claim = useClaimEventRewardMutation()
  const endsIn = useEndsIn(data?.current.endsAt)

  const claimReward = (request: Parameters<typeof claim.mutate>[0]) =>
    claim.mutate(request, {
      onSuccess: (result) => toast.success(t("event.claimedCoins", { coins: formatNumber(result.coins) })),
      onError: () => toast.error(t("reward.claimFailed")),
    })

  const milestoneRow = (week: string, milestone: EventMilestoneStatus, bestScore: number | null) => {
    const percent = Math.min(100, Math.round(((bestScore ?? 0) / milestone.score) * 100))
    return (
      <li key={`${week}-${milestone.index}`} className="flex items-center gap-3">
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <div className="flex justify-between gap-2 text-[13px] font-bold">
            <span className="truncate">{t("event.goalScore", { score: formatNumber(milestone.score) })}</span>
            <span className="flex shrink-0 items-center gap-1 text-[#ffcf7a]">
              <CoinsIcon className="size-3.5" aria-hidden="true" />
              {formatNumber(milestone.coins)}
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-[#3a2560]" aria-hidden="true">
            <div className="h-full rounded-full bg-[#c86bfa]" style={{ width: `${percent}%` }} />
          </div>
        </div>
        {milestone.claimed ? (
          <span className="flex h-9 w-[72px] items-center justify-center gap-1 text-xs font-bold text-[#dcb6f5]">
            <CheckIcon className="size-4" aria-hidden="true" />
            {t("event.claimedShort")}
          </span>
        ) : (
          <button
            className="h-9 w-[72px] rounded-xl bg-[#c86bfa] text-sm font-extrabold text-[#22062f] disabled:bg-[#3a2560] disabled:text-[#dcb6f5]/60"
            disabled={!milestone.reached || claim.isPending}
            onClick={() => claimReward({ week, kind: "milestone", index: milestone.index })}
          >
            {t("event.claim")}
          </button>
        )}
      </li>
    )
  }

  if (isError) return <p className="text-sm text-destructive">{t("profile.loadFailed")}</p>
  if (!data) return <PageHeader title={t("event.title")} />
  const { current, previous } = data
  const rows = eventBoardRows(current.ruleId)

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title={t("event.title")} />

      <section className={`flex items-center gap-4 rounded-3xl p-4 ${theme.card}`}>
        {rows ? (
          <BlockBoardPreview rows={rows} cellGap={2} className="w-24 shrink-0 p-1.5" />
        ) : (
          <PartyPopperIcon className="size-14 shrink-0 text-[#c86bfa]" aria-hidden="true" />
        )}
        <div className="flex min-w-0 flex-col gap-1">
          <span className="font-heading text-[22px] leading-tight font-extrabold">{t(`event.${current.ruleId}.name` as TranslationKey)}</span>
          <span className={`text-[13px] ${theme.soft}`}>{t(`event.${current.ruleId}.description` as TranslationKey)}</span>
          <span className={`flex items-center gap-1.5 text-[13px] font-bold ${theme.soft}`}>
            <TimerIcon className="size-4" aria-hidden="true" />
            {endsIn ? t("event.endsIn", { time: endsIn }) : " "}
          </span>
        </div>
      </section>

      <div className="grid grid-cols-2 gap-2.5 text-center">
        <div className={`${PANEL} p-3`}>
          <span className="block font-heading text-2xl font-extrabold">{current.bestScore !== null ? formatNumber(current.bestScore) : "—"}</span>
          <span className="text-xs text-muted-foreground">{t(current.bestScore !== null ? "event.bestLabel" : "event.notPlayed")}</span>
        </div>
        <div className={`${PANEL} p-3`}>
          <span className="block font-heading text-2xl font-extrabold">{current.rank !== null ? `#${formatNumber(current.rank)}` : "—"}</span>
          <span className="text-xs text-muted-foreground">{t("nav.leaderboard")}</span>
        </div>
      </div>

      <section className={`${PANEL} flex flex-col gap-3 p-4`}>
        <span className="font-extrabold">{t("event.goals")}</span>
        <span className="text-xs text-muted-foreground">{t("event.classicCounts")}</span>
        <ol className="flex flex-col gap-3">{current.milestones.map((milestone) => milestoneRow(current.week, milestone, current.bestScore))}</ol>
      </section>

      <section className={`${PANEL} flex flex-col gap-2 p-4`}>
        <span className="flex items-center gap-2 font-extrabold">
          <TrophyIcon className="size-5 text-[#ffcf4a]" aria-hidden="true" />
          {t("event.rankRewards")}
        </span>
        <ul className="grid grid-cols-5 gap-1.5 text-center">
          {[...EVENT_RANK_TIERS.map((tier) => [t(`event.rankTier.${tier.key}`), tier.coins] as const), [t("event.rankTier.all"), EVENT_PARTICIPATION_COINS] as const].map(([label, coins]) => (
            <li key={label} className="flex flex-col items-center gap-0.5 rounded-xl bg-[#2a2459] px-1 py-2">
              <span className="text-[11px] leading-tight font-bold">{label}</span>
              <span className="text-[13px] font-extrabold text-[#ffcf7a] tabular-nums">{formatNumber(coins)}</span>
            </li>
          ))}
        </ul>
      </section>

      {previous && (
        <section className={`flex flex-col gap-3 rounded-3xl border-2 border-[#c86bfa] p-4 ${theme.card}`}>
          <span className="font-extrabold">{t("event.lastWeek", { name: t(`event.${previous.ruleId}.name` as TranslationKey) })}</span>
          <span className={`text-sm ${theme.soft}`}>
            {t("event.lastWeekResult", { rank: formatNumber(previous.rank ?? 0), score: formatNumber(previous.bestScore ?? 0) })}
          </span>
          {previous.rankClaimed ? (
            <span className="flex items-center gap-1.5 text-sm font-bold text-[#dcb6f5]">
              <CheckIcon className="size-4" aria-hidden="true" />
              {t("event.claimedShort")}
            </span>
          ) : previous.rankCoins > 0 ? (
            <button className={`${theme.button} h-12 text-lg motion-safe:animate-pulse`} disabled={claim.isPending} onClick={() => claimReward({ week: previous.week, kind: "rank" })}>
              <TrophyIcon aria-hidden="true" />
              {t("event.claimRank", { coins: formatNumber(previous.rankCoins) })}
            </button>
          ) : (
            <span className="text-sm text-[#dcb6f5]">{t("event.noReward")}</span>
          )}
          {previous.milestones.some((milestone) => milestone.reached && !milestone.claimed) && (
            <ol className="flex flex-col gap-3">
              {previous.milestones.filter((milestone) => milestone.reached && !milestone.claimed).map((milestone) => milestoneRow(previous.week, milestone, previous.bestScore))}
            </ol>
          )}
        </section>
      )}

      <Link href={`${Routes.PLAY}?event=1`} className={`${theme.button} h-16 text-[22px] [&_svg]:size-6`}>
        <PlayIcon className="fill-current" aria-hidden="true" />
        {t("event.play")}
      </Link>
      <Link href={Routes.LEADERBOARD} className="text-center text-sm font-semibold text-muted-foreground underline underline-offset-2 hover:text-foreground">
        {t("leaderboard.view")}
      </Link>
    </div>
  )
}
