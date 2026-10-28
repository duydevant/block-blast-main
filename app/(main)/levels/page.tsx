import type { Metadata } from "next"

import { Routes } from "@/lib/routes"
import { LevelSelectGrid } from "@/modules/game-modes/components/level-select-grid"

export const metadata: Metadata = {
  title: "Levels",
  description: "Block puzzle levels with hand-made boards, goals and move limits. Earn up to three stars on each level.",
  alternates: { canonical: Routes.LEVELS },
}

export default function LevelsPage() {
  return (
    <div className="mx-auto w-full max-w-md px-4 pt-2 pb-6">
      <LevelSelectGrid />
    </div>
  )
}
