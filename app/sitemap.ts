import type { MetadataRoute } from "next"
import { Routes } from "@/lib/routes"
import { siteConfig } from "@/lib/site"
import { LESSON_SLUGS } from "@/modules/lessons/lesson-catalog"

export default function sitemap(): MetadataRoute.Sitemap {
  const routes = [Routes.HOME, Routes.PLAY, Routes.DAILY, Routes.HOW_TO_PLAY, Routes.LEVELS, Routes.DUEL, Routes.LEADERBOARD] as const

  // Bài học kỹ thuật: /how-to-play/{slug}.
  const lessons = LESSON_SLUGS.map((slug) => `${Routes.HOW_TO_PLAY}/${slug}`)
  return [...routes, ...lessons].map((route) => ({
    url: new URL(route, siteConfig.url).toString(),
    lastModified: new Date(),
  }))
}
