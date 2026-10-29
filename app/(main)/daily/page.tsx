import type { Metadata } from "next"

import { Routes } from "@/lib/routes"
import { DailyChallengeExplainer } from "@/modules/leaderboard/components/daily-challenge-explainer"

export const metadata: Metadata = {
  title: "Daily challenge",
  description: "Everyone plays the same blocks today. 3 runs, best one counts: beat your personal goals, keep your streak and race the weekly total.",
  alternates: { canonical: Routes.DAILY },
}

export default function DailyPage() {
  return (
    <div className="mx-auto w-full max-w-md px-4 pt-2 pb-6">
      <DailyChallengeExplainer />
    </div>
  )
}
