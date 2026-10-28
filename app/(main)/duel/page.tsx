import type { Metadata } from "next"

import { Routes } from "@/lib/routes"
import { CreateDuelCard } from "@/modules/duel/components/create-duel-card"

export const metadata: Metadata = {
  title: "1v1 duel",
  description: "Challenge a friend to a live 3-minute block puzzle duel with the same blocks.",
  alternates: { canonical: Routes.DUEL },
}

export default function DuelPage() {
  return (
    <div className="mx-auto w-full max-w-md px-4 pt-2 pb-6">
      <CreateDuelCard />
    </div>
  )
}
