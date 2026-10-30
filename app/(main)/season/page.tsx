import type { Metadata } from "next"

import { SeasonPageClient } from "@/modules/season/components/season-page-client"

export const metadata: Metadata = {
  title: "Season",
  robots: { index: false },
}

export default function SeasonPage() {
  return (
    <div className="mx-auto w-full max-w-md px-4 pt-2 pb-6">
      <SeasonPageClient />
    </div>
  )
}
