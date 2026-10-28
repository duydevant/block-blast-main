import type { Metadata } from "next"

import { Routes } from "@/lib/routes"
import { WeeklyEventPage } from "@/modules/game-modes/components/weekly-event-page"

export const metadata: Metadata = {
  title: "Weekly event",
  description: "A new rule every week: hit score goals for coins and climb the event leaderboard for weekly rewards.",
  alternates: { canonical: Routes.EVENT },
}

export default function EventPage() {
  return (
    <div className="mx-auto w-full max-w-md px-4 pt-2 pb-6">
      <WeeklyEventPage />
    </div>
  )
}
