"use client"

import Link from "next/link"

import { BrandMark } from "@/components/game-ui/brand-mark"
import { CoinsChip, StreakChip } from "@/components/game-ui/stat-chips"
import { LanguageSwitcher } from "@/components/layout/language-switcher"
import { useI18n } from "@/lib/i18n"
import { Routes } from "@/lib/routes"
import { siteConfig } from "@/lib/site"
import { useDailyStatusQuery } from "@/modules/leaderboard/use-leaderboard-queries"
import { usePlayerDisplayName } from "@/modules/player-profile/components/use-player-display-name"
import { usePlayerProfileQuery } from "@/modules/player-profile/use-player-profile-query"

/** Thanh trên của site: logo · chuỗi ngày · xu · ngôn ngữ · avatar (vào hồ sơ). */
export function GameHeader() {
  const { t } = useI18n()
  const profile = usePlayerProfileQuery().data
  const streak = useDailyStatusQuery().data?.streak.current ?? 0
  const displayName = usePlayerDisplayName()

  return (
    <header className="sticky top-0 z-40 bg-background/95 backdrop-blur">
      <div className="mx-auto flex h-16 w-full max-w-3xl items-center gap-2.5 px-4">
        <Link href={Routes.HOME} className="flex min-w-0 items-center gap-2.5">
          <BrandMark />
          <span className="truncate font-heading text-[22px] font-extrabold tracking-tight">{siteConfig.name}</span>
        </Link>
        <div className="ml-auto flex shrink-0 items-center gap-2">
          {streak > 0 && <StreakChip count={streak} />}
          {profile && <CoinsChip coins={profile.coins} />}
          <LanguageSwitcher />
          <Link
            href={Routes.PROFILE}
            aria-label={t("nav.profile")}
            className="flex size-9 items-center justify-center rounded-full bg-[#3b3375] font-heading text-lg font-extrabold uppercase hover:bg-[#4a4190]"
          >
            {(displayName ?? "?").charAt(0)}
          </Link>
        </div>
      </div>
    </header>
  )
}
