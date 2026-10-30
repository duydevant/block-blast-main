"use client"

import { useState } from "react"

import { PageHeader } from "@/components/game-ui/page-header"
import { useFirebaseAuthStore } from "@/lib/auth/firebase-auth-store"
import { useI18n } from "@/lib/i18n"

import { CATEGORY_PERIODS, LEADERBOARD_CATEGORIES, type LeaderboardCategory } from "../leaderboard-categories"
import { LEADERBOARD_TABS, type LeaderboardPeriod, type LeaderboardRow, type LeaderboardTab } from "../leaderboard-types"
import { LeaderboardTable } from "./leaderboard-table"

/** Kỳ hiển thị dạng tab của hạng mục (bảng "daily" chỉ hiện ở trang /daily). */
const tabsFor = (category: LeaderboardCategory) => LEADERBOARD_TABS.filter((tab) => CATEGORY_PERIODS[category].includes(tab))

/**
 * Phần tương tác của /leaderboard: chọn hạng mục (điểm, phong độ, thuần, combo, sao) rồi kỳ.
 * `initialTops` (bảng điểm) render sẵn từ server, thay bằng dữ liệu kèm hạng của mình khi đăng nhập xong.
 */
export function LeaderboardPageClient({
  initialTops,
  initialPeriod,
}: {
  initialTops: Record<LeaderboardPeriod, LeaderboardRow[]>
  initialPeriod: LeaderboardTab
}) {
  const { t } = useI18n()
  const status = useFirebaseAuthStore((state) => state.status)
  const [category, setCategory] = useState<LeaderboardCategory>("score")
  const [period, setPeriod] = useState<LeaderboardTab>(initialPeriod)
  const tabs = tabsFor(category)

  const chooseCategory = (next: LeaderboardCategory) => {
    setCategory(next)
    if (!tabsFor(next).includes(period)) setPeriod(tabsFor(next)[0])
  }

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-4 px-4 pt-2 pb-6">
      <PageHeader title={t("nav.leaderboard")} />

      <div role="group" aria-label={t("leaderboard.category.score")} className="-mx-4 flex gap-2 overflow-x-auto px-4">
        {LEADERBOARD_CATEGORIES.map((item) => (
          <button
            key={item}
            aria-pressed={item === category}
            onClick={() => chooseCategory(item)}
            className={`shrink-0 rounded-full px-3.5 py-1.5 text-[13px] font-bold transition ${item === category ? "bg-[#ffb547] text-[#2a1600]" : "bg-card text-violet-200 hover:brightness-110"}`}
          >
            {t(`leaderboard.category.${item}`)}
          </button>
        ))}
      </div>

      {tabs.length > 1 && (
        <div
          role="tablist"
          aria-label={t("nav.leaderboard")}
          className="grid gap-1 rounded-2xl bg-[#10322f] p-1"
          style={{ gridTemplateColumns: `repeat(${tabs.length}, minmax(0, 1fr))` }}
        >
          {tabs.map((item) => (
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
      )}

      <p className="text-xs text-muted-foreground">
        {category === "score" && period === "challenge" ? t("leaderboard.challengeHint") : t(`leaderboard.categoryHint.${category}`)}
      </p>
      {(status === "error" || status === "disabled") && <p className="text-sm text-muted-foreground">{t("auth.unavailable")}</p>}
      <LeaderboardTable key={`${category}-${period}`} period={period} category={category} initialTop={category === "score" ? initialTops[period] : undefined} />
    </div>
  )
}
