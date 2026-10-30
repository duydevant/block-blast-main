"use client"

import { HomeDailyCard } from "@/modules/home/components/home-daily-card"
import { HomeHero } from "@/modules/home/components/home-hero"
import { HomeMissionsRow } from "@/modules/home/components/home-missions-row"
import { HomeModeGrid } from "@/modules/home/components/home-mode-grid"
import { PlayersOnlineBadge } from "@/modules/presence/components/players-online-badge"
import { RecapHomeBanner } from "@/modules/recap/components/recap-home-banner"
import { SeasonHomeCard } from "@/modules/season/components/season-home-card"

/** Trang chủ: vào là thấy bàn chơi + nút Chơi; chế độ khác dạng ô màu, ít chữ. */
export default function HomePage() {
  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-4 px-4 pt-2 pb-6">
      <HomeHero />
      <HomeDailyCard />
      <HomeModeGrid />
      <RecapHomeBanner />
      <SeasonHomeCard />
      <HomeMissionsRow />
      <div className="flex justify-center">
        <PlayersOnlineBadge />
      </div>
    </div>
  )
}
