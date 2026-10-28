"use client"

import { CalendarDaysIcon, SwordsIcon } from "lucide-react"

import { useI18n } from "@/lib/i18n"
import { formatDayKey } from "@/modules/leaderboard/use-leaderboard-queries"

import { useBlockPuzzleGameStore } from "../store/block-puzzle-game-store"

const BADGE = "mx-auto flex items-center gap-1.5 rounded-full bg-white/8 px-3 py-1 text-xs font-semibold text-amber-200"

/** Nhãn nhỏ dưới HUD: đang chơi thử thách hằng ngày (tính điểm/luyện tập) hoặc thách đấu bạn bè. */
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
  return (
    <p className={BADGE}>
      <CalendarDaysIcon className="size-3.5" aria-hidden="true" />
      {t(ranked ? "daily.badgeRanked" : "daily.badgePractice", { date })}
    </p>
  )
}
