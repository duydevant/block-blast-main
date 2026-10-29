"use client"

import type { ReactNode } from "react"
import { CheckIcon, CoinsIcon, StarIcon, TrophyIcon } from "lucide-react"

import { PANEL } from "@/components/game-ui/game-ui-classes"
import { type TranslationKey, useI18n } from "@/lib/i18n"
import type { DailyStatusResponse } from "@/modules/player-profile/player-profile-types"

import { DAILY_RECORD_COINS, DAILY_STAR_COINS } from "../daily-challenge-goals"

const STAR_LABELS: TranslationKey[] = ["daily.goal.star1", "daily.goal.star2", "daily.goal.star3"]

/** Dãy sao nhỏ (★, ★★, ★★★) đứng đầu mỗi mốc. */
export function GoalStars({ count, lit, className = "size-3.5" }: { count: number; lit: boolean; className?: string }) {
  return (
    <span className="flex w-12 shrink-0 justify-center gap-0.5" aria-hidden="true">
      {Array.from({ length: count }, (_, index) => (
        <StarIcon key={index} className={`${className} ${lit ? "fill-[#ffcf4a] text-[#ffcf4a]" : "text-[#6b5fa8]"}`} />
      ))}
    </span>
  )
}

function GoalRow({ icon, label, target, coins, best, reached }: { icon: ReactNode; label: string; target: number; coins: number; best: number; reached: boolean }) {
  const { formatNumber } = useI18n()
  const percent = reached ? 100 : Math.min(100, Math.round((best / target) * 100))
  return (
    <li className="flex items-center gap-2.5">
      {icon}
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <div className="flex justify-between gap-2 text-[13px] font-bold">
          <span className="truncate">
            {label} · <span className="tabular-nums">{formatNumber(target)}</span>
          </span>
          <span className={`flex shrink-0 items-center gap-1 ${reached ? "text-[#9fe3db]" : "text-[#ffcf7a]"}`}>
            {reached ? <CheckIcon className="size-3.5" aria-hidden="true" /> : <CoinsIcon className="size-3.5" aria-hidden="true" />}
            {formatNumber(coins)}
          </span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-[#2f2863]" aria-hidden="true">
          <div className={`h-full rounded-full ${reached ? "bg-[#2ec4b6]" : "bg-[#ff8a3d]"}`} style={{ width: `${percent}%` }} />
        </div>
      </div>
    </li>
  )
}

/**
 * Mục tiêu hôm nay: 3 mốc sao theo phong độ của chính người chơi + mốc phá kỷ lục, tiến độ theo lượt cao nhất.
 * Xu của mốc được cộng ngay khi nộp lượt đạt mốc.
 */
export function DailyChallengeGoalsCard({ status }: { status: DailyStatusResponse }) {
  const { t, formatNumber } = useI18n()
  const best = status.todayScore ?? 0
  const { goals } = status
  return (
    <section className={`${PANEL} flex flex-col gap-3 p-4`}>
      <div className="flex items-baseline justify-between gap-2">
        <span className="font-extrabold">{t("daily.goals")}</span>
        <span className="text-xs text-muted-foreground tabular-nums">
          {t("daily.formLine", { yesterday: status.yesterdayScore !== null ? formatNumber(status.yesterdayScore) : "—", form: formatNumber(goals.form) })}
        </span>
      </div>
      <ol className="flex flex-col gap-3">
        {goals.targets.map((target, index) => (
          <GoalRow
            key={target}
            icon={<GoalStars count={index + 1} lit={status.stars > index} />}
            label={t(STAR_LABELS[index])}
            target={target}
            coins={DAILY_STAR_COINS[index]}
            best={best}
            reached={status.stars > index}
          />
        ))}
        {goals.record !== null && (
          <GoalRow
            icon={
              <span className="flex w-12 shrink-0 justify-center" aria-hidden="true">
                <TrophyIcon className={`size-4.5 ${status.recordBroken ? "fill-[#ffcf4a] text-[#ffcf4a]" : "text-[#6b5fa8]"}`} />
              </span>
            }
            label={t("daily.goal.record")}
            target={goals.record + 1}
            coins={DAILY_RECORD_COINS}
            best={best}
            reached={status.recordBroken}
          />
        )}
      </ol>
      <span className="text-xs text-muted-foreground">{t("daily.goalsHint")}</span>
    </section>
  )
}
