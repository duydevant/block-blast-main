import type { Metadata } from "next"

import { GameHistoryList } from "@/modules/player-profile/components/game-history-list"

export const metadata: Metadata = {
  title: "Game history",
  robots: { index: false },
}

export default function ProfileGamesPage() {
  return (
    <div className="mx-auto w-full max-w-md px-4 pt-2 pb-6">
      <GameHistoryList />
    </div>
  )
}
