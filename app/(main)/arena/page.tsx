import type { Metadata } from "next"

import { Routes } from "@/lib/routes"
import { ArenaPageClient } from "@/modules/game-modes/components/arena-page-client"

export const metadata: Metadata = {
  title: "Arena",
  description: "Block puzzle challenges: speed, pure, obstacle, combo and endurance runs with coin rewards.",
  alternates: { canonical: Routes.ARENA },
}

export default function ArenaPage() {
  return (
    <div className="mx-auto w-full max-w-md px-4 pt-2 pb-6">
      <ArenaPageClient />
    </div>
  )
}
