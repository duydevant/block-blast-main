import type { Metadata } from "next"

import { Routes } from "@/lib/routes"
import { siteConfig } from "@/lib/site"
import { LeaderboardPageClient } from "@/modules/leaderboard/components/leaderboard-page-client"
import { LEADERBOARD_TABS } from "@/modules/leaderboard/leaderboard-types"
import { getPublicLeaderboardTops } from "@/server/leaderboards/public-leaderboard-tops"

export const metadata: Metadata = {
  title: "Leaderboard",
  description: `Top ${siteConfig.name} scores today, this week and of all time — every score verified by the server.`,
  alternates: { canonical: Routes.LEADERBOARD },
}

/** Top render sẵn, làm mới mỗi 5 phút (ISR); bảng của chính mình tải sau ở client. */
export const revalidate = 300

export default async function LeaderboardPage() {
  const tops = await getPublicLeaderboardTops()
  // Mở tab có người chơi đầu tiên (đầu ngày bảng ngày còn trống) để trang không rỗng.
  const initialPeriod = LEADERBOARD_TABS.find((period) => tops[period].length > 0) ?? "today"
  return <LeaderboardPageClient initialTops={tops} initialPeriod={initialPeriod} />
}
