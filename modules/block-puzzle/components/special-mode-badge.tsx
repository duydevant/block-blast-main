"use client"

import { useQueryClient } from "@tanstack/react-query"
import { useEffect } from "react"
import { CalendarDaysIcon, SwordsIcon } from "lucide-react"

import { useI18n } from "@/lib/i18n"
import { DAILY_STATUS_QUERY_KEY, formatDayKey, useDailyStatusQuery } from "@/modules/leaderboard/use-leaderboard-queries"
import { nextDailyGoal } from "@/modules/progression/daily-challenge-goals"

import { useBlockPuzzleGameStore } from "../store/block-puzzle-game-store"

const BADGE = "mx-auto flex items-center gap-1.5 rounded-full bg-white/8 px-3 py-1 text-xs font-semibold text-amber-200"

/** Lượt thử thách tính điểm: lượt mấy/3 + mốc kế tiếp (tính theo điểm cao hơn giữa ván này và lượt tốt nhất hôm nay). */
function DailyRunBadge({ date }: { date: string }) {
  const { t, formatNumber } = useI18n()
  const queryClient = useQueryClient()
  const gameId = useBlockPuzzleGameStore((state) => state.rankedSession?.gameId ?? null)
  const score = useBlockPuzzleGameStore((state) => state.game?.score ?? 0)
  const status = useDailyStatusQuery().data
  // Lượt mới vừa bắt đầu → làm mới số lượt đã dùng (mốc đã chốt ở lượt đầu).
  useEffect(() => {
    if (gameId) void queryClient.invalidateQueries({ queryKey: DAILY_STATUS_QUERY_KEY })
  }, [gameId, queryClient])

  const runs = status?.runs
  const next = status ? nextDailyGoal(status.goals, Math.max(score, status.todayScore ?? 0)) : undefined
  return (
    <div className="mx-auto flex flex-col items-center gap-0.5">
      <p className={BADGE}>
        <CalendarDaysIcon className="size-3.5" aria-hidden="true" />
        {runs ? t("daily.badgeRun", { date, run: Math.max(1, Math.min(runs.used, runs.max)), max: runs.max }) : t("daily.badgeRanked", { date })}
      </p>
      {next !== undefined && (
        <p className="text-xs font-semibold text-violet-100 tabular-nums" aria-live="polite">
          {next
            ? t("daily.hudNext", { goal: next.kind === "star" ? "★".repeat(next.stars) : "🏆", target: formatNumber(next.target) })
            : t("daily.hudAllDone")}
        </p>
      )}
    </div>
  )
}

/** Nhãn nhỏ dưới HUD: đang chơi thử thách hằng ngày (lượt tính điểm/luyện tập) hoặc thách đấu bạn bè. */
export function SpecialModeBadge() {
  const { t, localeTag, formatNumber } = useI18n()
  const dailyDay = useBlockPuzzleGameStore((state) => state.dailyDay)
  const challenge = useBlockPuzzleGameStore((state) => state.challenge)
  const ranked = useBlockPuzzleGameStore((state) => state.rankedSession !== null)

  if (challenge) {
    const name = challenge.creatorName ?? t("profile.guestName", { tag: challenge.creatorTag })
    return (
      <p className={BADGE}>
        <SwordsIcon className="size-3.5" aria-hidden="true" />
        {t("challenge.badge", { name, score: formatNumber(challenge.creatorScore) })}
      </p>
    )
  }
  if (!dailyDay) return null

  const date = formatDayKey(dailyDay, localeTag)
  if (ranked) return <DailyRunBadge date={date} />
  return (
    <p className={BADGE}>
      <CalendarDaysIcon className="size-3.5" aria-hidden="true" />
      {t("daily.badgePractice", { date })}
    </p>
  )
}
