"use client"

import Link from "next/link"
import { GiftIcon, StarIcon, TrophyIcon } from "lucide-react"

import { MODE_THEME } from "@/components/game-ui/game-ui-classes"
import { useI18n } from "@/lib/i18n"
import { Routes } from "@/lib/routes"
import { useBlockPuzzleGameStore } from "@/modules/block-puzzle/store/block-puzzle-game-store"
import { useDailyStatusQuery } from "@/modules/leaderboard/use-leaderboard-queries"

import { useLastGameRewardsStore } from "../last-game-rewards-store"

const CHIP = "flex items-center gap-1 rounded-full bg-[#2a2459] px-2.5 py-1 text-[13px] font-bold"

/**
 * Nhãn nút "Ván mới" khi đang ở thử thách ngày: còn lượt tính điểm → "Lượt tiếp (còn x)", hết lượt → "Luyện tập".
 * null = dùng nhãn mặc định.
 */
export function useDailyNewGameLabel(): string | null {
  const { t } = useI18n()
  const isDaily = useBlockPuzzleGameStore((state) => state.dailyDay !== null)
  const runs = useDailyStatusQuery().data?.runs
  if (!isDaily || !runs) return null
  const left = runs.max - runs.used
  return left > 0 ? t("daily.nextRun", { left }) : t("daily.practice")
}

/** Cuối hộp hết ván của lượt thử thách tính điểm: sao / kỷ lục vừa đạt (server trả khi nộp xong) + link mục tiêu & thưởng. */
export function DailyRunGameOverNote() {
  const { t } = useI18n()
  const gameId = useBlockPuzzleGameStore((state) => state.rankedSession?.gameId ?? null)
  const daily = useLastGameRewardsStore((state) => (state.gameId !== null && state.gameId === gameId ? state.rewards?.daily : undefined))
  const giftWaiting = useDailyStatusQuery().data?.reward.claimable ?? false

  return (
    <div className="flex w-full flex-col items-center gap-2.5">
      {daily && (
        <div className="flex flex-wrap justify-center gap-2">
          {daily.newStars > 0 && (
            <span className={`${CHIP} text-[#ffcf4a]`}>
              <StarIcon className="size-3.5 fill-current" aria-hidden="true" />
              {t("daily.newStars", { count: daily.newStars })}
            </span>
          )}
          {daily.recordBroken && (
            <span className={`${CHIP} text-[#ffcf4a]`}>
              <TrophyIcon className="size-3.5" aria-hidden="true" />
              {t("daily.recordBroken")}
            </span>
          )}
          <span className={CHIP}>{t("daily.todayStars", { stars: daily.stars })}</span>
        </div>
      )}
      <Link href={Routes.DAILY} className={`${MODE_THEME.daily.button} h-12 w-full text-lg ${giftWaiting ? "motion-safe:animate-pulse" : ""}`}>
        <GiftIcon aria-hidden="true" />
        {t(giftWaiting ? "reward.claimToday" : "daily.viewGoals")}
      </Link>
    </div>
  )
}
