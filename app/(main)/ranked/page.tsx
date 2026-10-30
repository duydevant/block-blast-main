import type { Metadata } from "next"

import { RankedPageClient } from "@/modules/ranked/components/ranked-page-client"

export const metadata: Metadata = {
  title: "Ranked",
  robots: { index: false },
}

export default function RankedPage() {
  return (
    <div className="mx-auto w-full max-w-md px-4 pt-2 pb-6">
      <RankedPageClient />
    </div>
  )
}
