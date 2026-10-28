"use client"

import Link from "next/link"

import { useI18n } from "@/lib/i18n"
import { Routes } from "@/lib/routes"

const LINKS = [
  [Routes.HOW_TO_PLAY, "nav.howToPlay"],
  [Routes.LEADERBOARD, "nav.leaderboard"],
  [Routes.LEVELS, "nav.levels"],
  [Routes.DUEL, "nav.duel"],
] as const

export function GameFooter() {
  const { t } = useI18n()
  return (
    <footer className="mt-8">
      <div className="mx-auto flex w-full max-w-3xl flex-col items-center gap-3 px-4 py-6 text-sm text-muted-foreground">
        <nav className="flex flex-wrap justify-center gap-x-5 gap-y-2">
          {LINKS.map(([href, key]) => (
            <Link key={href} href={href} className="hover:text-foreground">
              {t(key)}
            </Link>
          ))}
        </nav>
        <p className="text-xs">{t("footer.tagline")}</p>
      </div>
    </footer>
  )
}
