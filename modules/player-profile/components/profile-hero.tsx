"use client"

import Link from "next/link"
import { ChevronLeftIcon } from "lucide-react"

import { ICON_TILE } from "@/components/game-ui/game-ui-classes"
import { CoinsChip } from "@/components/game-ui/stat-chips"
import { useI18n } from "@/lib/i18n"
import { Routes } from "@/lib/routes"
import { levelProgressForXp } from "@/modules/progression/player-level-curve"

import { usePlayerProfileQuery } from "../use-player-profile-query"
import { usePlayerDisplayName } from "./use-player-display-name"

/** Đầu trang hồ sơ: avatar trong vòng tiến độ cấp · tên · cấp + XP · xu. */
export function ProfileHero() {
  const { t, formatNumber } = useI18n()
  const profile = usePlayerProfileQuery().data
  const name = usePlayerDisplayName() ?? ""
  const progress = levelProgressForXp(profile?.xp ?? 0)
  const percent = Math.round((progress.xpIntoLevel / progress.xpForNextLevel) * 100)

  return (
    <header className="flex items-center gap-3">
      <Link href={Routes.HOME} className={ICON_TILE} aria-label={t("ui.back")}>
        <ChevronLeftIcon aria-hidden="true" />
      </Link>
      <div
        className="flex size-16 shrink-0 items-center justify-center rounded-full"
        style={{ background: `conic-gradient(#ffb547 ${percent}%, #2f2863 0)` }}
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={progress.xpForNextLevel}
        aria-valuenow={progress.xpIntoLevel}
        aria-label={t("progress.level", { level: progress.level })}
      >
        <span className="flex size-[54px] items-center justify-center rounded-full bg-[#3b3375] font-heading text-[26px] font-extrabold uppercase" aria-hidden="true">
          {name.charAt(0)}
        </span>
      </div>
      <div className="flex min-w-0 flex-col gap-0.5">
        <h1 className="truncate font-heading text-[22px] leading-none font-extrabold">{name}</h1>
        <span className="text-[13px] font-bold text-[#ffcf7a]">
          {t("profile.levelLine", { level: progress.level, xp: formatNumber(progress.xpIntoLevel), next: formatNumber(progress.xpForNextLevel) })}
        </span>
      </div>
      {profile && (
        <div className="ml-auto">
          <CoinsChip coins={profile.coins} />
        </div>
      )}
    </header>
  )
}
