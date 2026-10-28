import type { MetadataRoute } from "next"
import { Routes } from "@/lib/routes"
import { siteConfig } from "@/lib/site"

export default function sitemap(): MetadataRoute.Sitemap {
  const routes = [Routes.HOME, Routes.PLAY, Routes.DAILY, Routes.EVENT, Routes.HOW_TO_PLAY, Routes.LEVELS, Routes.DUEL, Routes.LEADERBOARD] as const

  return routes.map((route) => ({
    url: new URL(route, siteConfig.url).toString(),
    lastModified: new Date(),
  }))
}
