import type { Metadata, Viewport } from "next"

import { JsonLd } from "@/components/seo/json-ld"
import { Routes } from "@/lib/routes"
import { videoGameJsonLd } from "@/lib/seo/schema"
import { siteConfig } from "@/lib/site"
import { BlockPuzzleGameScreen } from "@/modules/block-puzzle/components/block-puzzle-game-screen"

export const metadata: Metadata = {
  title: "Play",
  description: siteConfig.description,
  alternates: { canonical: Routes.PLAY },
}

// Không khoá pinch-zoom (WCAG 1.4.4); canvas đã có touch-action:none nên kéo khối không bị zoom.
export const viewport: Viewport = {
  themeColor: "#16122f",
}

export default function PlayPage() {
  return (
    <>
      <JsonLd data={videoGameJsonLd()} />
      <BlockPuzzleGameScreen />
    </>
  )
}
