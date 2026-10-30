"use client"

import Link from "next/link"
import { BrainIcon, GhostIcon, LayersIcon, SwordIcon, SwordsIcon, TrophyIcon, type LucideIcon } from "lucide-react"

import { type GameMode, MODE_THEME } from "@/components/game-ui/game-ui-classes"
import { useI18n } from "@/lib/i18n"
import { Routes } from "@/lib/routes"
import { LEVEL_COUNT } from "@/modules/game-modes/level-catalog"
import { useLevelStars } from "@/modules/game-modes/level-progress-store"
import { useLeaderboardQuery } from "@/modules/leaderboard/use-leaderboard-queries"

interface ModeTile {
  mode: GameMode
  href: string
  icon: LucideIcon
  title: string
  subtitle: string
  /** Ô rộng cả hàng. */
  wide?: boolean
}

/** Ô chế độ (thử thách ngày có thẻ riêng phía trên): icon + tên + một số liệu ngắn (không giải thích dài — mỗi trang tự giải thích). */
export function HomeModeGrid() {
  const { t, formatNumber } = useI18n()
  const stars = useLevelStars()
  const weeklyRank = useLeaderboardQuery("weekly").data?.me?.rank
  const starTotal = Object.values(stars).reduce((sum, value) => sum + value, 0)

  const tiles: ModeTile[] = [
    {
      mode: "levels",
      href: Routes.LEVELS,
      icon: LayersIcon,
      title: t("nav.levels"),
      subtitle: t("home.levelsSub", { done: Object.keys(stars).length, total: LEVEL_COUNT, stars: starTotal }),
    },
    { mode: "duel", href: Routes.DUEL, icon: SwordsIcon, title: t("nav.duel"), subtitle: t("home.duelSub") },
    { mode: "logic", href: Routes.PLAY_LOGIC, icon: BrainIcon, title: t("logic.title"), subtitle: t("logic.sub") },
    { mode: "arena", href: Routes.ARENA, icon: SwordIcon, title: t("arena.title"), subtitle: t("arena.homeSub") },
    { mode: "ranked", href: Routes.RANKED, icon: GhostIcon, title: t("ranked.title"), subtitle: t("ranked.homeSub") },
    {
      mode: "ranking",
      href: Routes.LEADERBOARD,
      icon: TrophyIcon,
      title: t("nav.leaderboard"),
      subtitle: weeklyRank ? t("home.rankingSub", { rank: formatNumber(weeklyRank) }) : t("home.rankingSubNone"),
      wide: true,
    },
  ]

  return (
    <nav aria-label={t("home.modes")} className="grid grid-cols-2 gap-3">
      {tiles.map(({ mode, href, icon: Icon, title, subtitle, wide }) => (
        <Link key={mode} href={href} className={`relative flex flex-col gap-2 rounded-3xl p-3.5 transition hover:brightness-110 ${wide ? "col-span-2" : ""} ${MODE_THEME[mode].card}`}>
          <Icon className={`size-7 ${MODE_THEME[mode].accentText}`} aria-hidden="true" />
          <span className="font-heading text-lg leading-none font-extrabold">{title}</span>
          <span className={`truncate text-[13px] ${MODE_THEME[mode].soft}`}>{subtitle}</span>
        </Link>
      ))}
    </nav>
  )
}
