import type { MetadataRoute } from "next"

import { BOARD_COLORS } from "@/modules/block-puzzle/render/block-color-palette"
import { PWA_ICON_PATH, PWA_ICON_VARIANTS } from "@/modules/pwa/pwa-icon-variants"
import { Routes } from "@/lib/routes"
import { siteConfig } from "@/lib/site"

/** Manifest PWA: cài ra màn hình chính, mở thẳng vào màn chơi toàn màn hình. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: siteConfig.name,
    short_name: siteConfig.name,
    description: siteConfig.description,
    id: "/",
    start_url: Routes.PLAY,
    scope: "/",
    display: "standalone",
    background_color: BOARD_COLORS.panel,
    theme_color: BOARD_COLORS.panel,
    categories: ["games", "puzzle"],
    icons: Object.entries(PWA_ICON_VARIANTS).map(([variant, icon]) => ({
      src: `${PWA_ICON_PATH}/${variant}`,
      sizes: `${icon.size}x${icon.size}`,
      type: "image/png",
      purpose: icon.maskable ? "maskable" : "any",
    })),
  }
}
