"use client"

import { useState } from "react"

import { PageHeader } from "@/components/game-ui/page-header"
import { useFirebaseAuthStore } from "@/lib/auth/firebase-auth-store"
import { useI18n } from "@/lib/i18n"

import { LEADERBOARD_TABS, type LeaderboardPeriod, type LeaderboardRow, type LeaderboardTab } from "../leaderboard-types"
import { LeaderboardTable } from "./leaderboard-table"

/** Phần tương tác của /leaderboard; `initialTops` render sẵn từ server, thay bằng dữ liệu kèm hạng của mình khi đăng nhập xong. */
export function LeaderboardPageClient({
  initialTops,
  initialPeriod,
}: {
  initialTops: Record<LeaderboardPeriod, LeaderboardRow[]>
  initialPeriod: LeaderboardTab
}) {
  const { t } = useI18n()
  const status = useFirebaseAuthStore((state) => state.status)
  const [period, setPeriod] = useState<LeaderboardTab>(initialPeriod)

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-4 px-4 pt-2 pb-6">
      <PageHeader title={t("nav.leaderboard")} />

      <div role="tablist" aria-label={t("nav.leaderboard")} className="grid grid-cols-4 gap-1 rounded-2xl bg-[#10322f] p-1">
        {LEADERBOARD_TABS.map((item) => (
          <button
            key={item}
            role="tab"
            aria-selected={item === period}
            onClick={() => setPeriod(item)}
            className={`h-10 truncate rounded-xl px-1 text-[13px] font-bold transition ${item === period ? "bg-[#2ec4b6] text-[#04211e]" : "text-[#9fe3db] hover:bg-white/5"}`}
          >
            {t(`leaderboard.${item}`)}
          </button>
        ))}
      </div>

      {period === "challenge" && <p className="text-xs text-muted-foreground">{t("leaderboard.challengeHint")}</p>}
      {(status === "error" || status === "disabled") &&<p className="text-sm text-muted-foreground">{t("auth.unavailable")}</p>}
      <LeaderboardTable period={period} initialTop={initialTops[period]} />
    </div>
  )
}
