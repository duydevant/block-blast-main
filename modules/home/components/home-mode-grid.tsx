"use client"

import Link from "next/link"
import { LayersIcon, PartyPopperIcon, SwordsIcon, TrophyIcon, type LucideIcon } from "lucide-react"

import { type GameMode, MODE_THEME } from "@/components/game-ui/game-ui-classes"
import { type TranslationKey, useI18n } from "@/lib/i18n"
import { Routes } from "@/lib/routes"
import { LEVEL_COUNT } from "@/modules/game-modes/level-catalog"
import { useLevelStars } from "@/modules/game-modes/level-progress-store"
import { useClaimableEventRewards } from "@/modules/game-modes/use-event-queries"
import { useDailyStatusQuery, useLeaderboardQuery } from "@/modules/leaderboard/use-leaderboard-queries"

interface ModeTile {
  mode: GameMode
  href: string
  icon: LucideIcon
  title: string
  subtitle: string
  /** Có quà chờ nhận → nhãn báo. */
  badge?: boolean
}

/** 4 ô chế độ: icon + tên + một số liệu ngắn (không giải thích dài — mỗi trang tự giải thích). */
export function HomeModeGrid() {
  const { t, formatNumber } = useI18n()
  const stars = useLevelStars()
  const event = useDailyStatusQuery().data?.event
  const weeklyRank = useLeaderboardQuery("weekly").data?.me?.rank
  const starTotal = Object.values(stars).reduce((sum, value) => sum + value, 0)
  const eventGifts = useClaimableEventRewards()

  const tiles: ModeTile[] = [
    {
      mode: "levels",
      href: Routes.LEVELS,
      icon: LayersIcon,
      title: t("nav.levels"),
      subtitle: t("home.levelsSub", { done: Object.keys(stars).length, total: LEVEL_COUNT, stars: starTotal }),
    },
    { mode: "duel", href: Routes.DUEL, icon: SwordsIcon, title: t("nav.duel"), subtitle: t("home.duelSub") },
    {
      mode: "event",
      href: Routes.EVENT,
      icon: PartyPopperIcon,
      title: t("event.title"),
      subtitle: event ? t(`event.${event.ruleId}.name` as TranslationKey) : t("event.leaderboardHint"),
      badge: eventGifts > 0,
    },
    {
      mode: "ranking",
      href: Routes.LEADERBOARD,
      icon: TrophyIcon,
      title: t("nav.leaderboard"),
      subtitle: weeklyRank ? t("home.rankingSub", { rank: formatNumber(weeklyRank) }) : t("home.rankingSubNone"),
    },
  ]

  return (
    <nav aria-label={t("home.modes")} className="grid grid-cols-2 gap-3">
      {tiles.map(({ mode, href, icon: Icon, title, subtitle, badge }) => (
        <Link key={mode} href={href} className={`relative flex flex-col gap-2 rounded-3xl p-3.5 transition hover:brightness-110 ${MODE_THEME[mode].card}`}>
          {badge && (
            <span className="absolute top-3 right-3 rounded-full bg-[#ffb547] px-2 py-0.5 text-[11px] font-extrabold text-[#2a1600] motion-safe:animate-bounce">
              {t("reward.badge")}
            </span>
          )}
          <Icon className={`size-7 ${MODE_THEME[mode].accentText}`} aria-hidden="true" />
          <span className="font-heading text-lg leading-none font-extrabold">{title}</span>
          <span className={`truncate text-[13px] ${MODE_THEME[mode].soft}`}>{subtitle}</span>
        </Link>
      ))}
    </nav>
  )
}
