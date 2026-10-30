"use client"

import { useState } from "react"
import { CheckIcon, CoinsIcon, LockIcon, TrophyIcon } from "lucide-react"

import { CHUNKY_BUTTON } from "@/components/game-ui/game-ui-classes"
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog"
import { type TranslationKey, useI18n } from "@/lib/i18n"
import type { PlayerProfile } from "@/modules/player-profile/player-profile-types"
import { usePlayerProfileQuery } from "@/modules/player-profile/use-player-profile-query"

import { type Achievement, ACHIEVEMENT_CATEGORIES, type AchievementState, ACHIEVEMENTS, totalLevelStars } from "../achievement-catalog"
import { arenaPoints } from "@/modules/game-modes/arena-catalog"

import { levelForXp } from "../player-level-curve"

const UNLOCKED_COLORS = ["bg-[#ffb547]", "bg-[#2ec4b6]", "bg-[#4ea8ff]", "bg-[#ff7eb6]", "bg-[#c86bfa]", "bg-[#9ad94a]"]

/** Tiến độ hiển thị; "Marathon" đếm trong ngày nên hồ sơ không có (hiện 0 tới khi đạt). */
function achievementState(profile: PlayerProfile): AchievementState {
  return {
    stats: profile.stats,
    bestStreak: profile.streak.best,
    level: levelForXp(profile.xp),
    referralCount: profile.referralCount,
    levelStarsTotal: totalLevelStars(profile.levelStars),
    duelWins: profile.duelStats.won,
    highestTier: profile.highestTier,
    todayGames1000: 0,
    dailyThreeStarDays: profile.dailyThreeStarDays,
    arenaPoints: arenaPoints(profile.arena),
  }
}

/** Modal một thành tích: icon to, tên, điều kiện, tiến độ hiện tại, thưởng, đã đạt hay chưa. */
function AchievementDialog({ item, color, unlocked, state, onClose }: { item: Achievement; color: string; unlocked: boolean; state: AchievementState; onClose: () => void }) {
  const { t, formatNumber } = useI18n()
  const value = Math.min(item.value(state), item.target)
  const percent = Math.round((value / item.target) * 100)
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-xs items-center gap-4 rounded-[30px] border-2 border-[#3b3375] bg-[#1e1942] p-6 text-center text-white">
        <span className={`mx-auto flex size-24 items-center justify-center rounded-3xl ${unlocked ? `${color} text-[#120f29]` : "bg-[#2a2459] text-[#6b62b0]"}`}>
          {unlocked ? <TrophyIcon className="size-12" aria-hidden="true" /> : <LockIcon className="size-11" aria-hidden="true" />}
        </span>
        <DialogTitle className="font-heading text-[26px] leading-tight font-extrabold">{t(`achievement.${item.id}` as TranslationKey)}</DialogTitle>
        <DialogDescription className="text-sm text-violet-200/90">{t(`achievement.${item.id}.desc` as TranslationKey)}</DialogDescription>
        <div className="flex w-full flex-col gap-1.5">
          <div className="flex justify-between text-[13px] font-bold">
            <span className={unlocked ? "flex items-center gap-1 text-[#2ec4b6]" : "text-violet-200/80"}>
              {unlocked && <CheckIcon className="size-4" aria-hidden="true" />}
              {t(unlocked ? "achievements.unlocked" : "achievements.locked")}
            </span>
            <span className="tabular-nums">{t("achievements.progress", { value: formatNumber(value), target: formatNumber(item.target) })}</span>
          </div>
          <div className="h-2.5 overflow-hidden rounded-full bg-[#2f2863]" role="progressbar" aria-valuemin={0} aria-valuemax={item.target} aria-valuenow={value}>
            <div className={`h-full rounded-full ${unlocked ? "bg-[#2ec4b6]" : "bg-[#ffb547]"}`} style={{ width: `${percent}%` }} />
          </div>
        </div>
        <span className="flex items-center gap-2 rounded-full bg-[#2a2459] px-4 py-1.5 text-sm font-bold">
          {t("achievements.rewardLabel")}
          <CoinsIcon className="size-4 text-[#ffb547]" aria-hidden="true" />
          <span className="text-[#ffcf7a]">{formatNumber(item.coins)}</span>
        </span>
        <button className={`${CHUNKY_BUTTON.secondary} h-12 w-full text-lg`} onClick={onClose}>
          {t("achievements.close")}
        </button>
      </DialogContent>
    </Dialog>
  )
}

/** Lưới huy hiệu: đạt = có màu, chưa đạt = mờ; bấm vào mở modal chi tiết + tiến độ. */
export function ProfileAchievementsCard() {
  const { t } = useI18n()
  const { data } = usePlayerProfileQuery()
  const [openId, setOpenId] = useState<string | null>(null)
  if (!data) return null
  const owned = new Set(data.achievements)
  const state = achievementState(data)
  const openIndex = ACHIEVEMENTS.findIndex((item) => item.id === openId)

  return (
    <section aria-label={t("achievements.title")} className="flex flex-col gap-2">
      <span className="flex items-baseline justify-between font-extrabold">
        {t("achievements.title")}
        <span className="text-[13px] font-semibold text-muted-foreground">
          {owned.size}/{ACHIEVEMENTS.length}
        </span>
      </span>
      {ACHIEVEMENT_CATEGORIES.map((category) => (
        <div key={category} className="flex flex-col gap-1.5">
          <h3 className="text-[12px] font-bold text-muted-foreground">{t(`achievements.category.${category}`)}</h3>
          <ul className="grid grid-cols-6 gap-2">
            {ACHIEVEMENTS.map((item, index) => {
              if (item.category !== category) return null
              const unlocked = owned.has(item.id)
              return (
                <li key={item.id}>
                  <button
                    aria-label={t(`achievement.${item.id}` as TranslationKey)}
                    onClick={() => setOpenId(item.id)}
                    className={`flex aspect-square w-full items-center justify-center rounded-2xl transition hover:scale-105 ${unlocked ? `${UNLOCKED_COLORS[index % UNLOCKED_COLORS.length]} text-[#120f29]` : "bg-card text-[#4a4380]"}`}
                  >
                    <TrophyIcon className="size-5" aria-hidden="true" />
                  </button>
                </li>
              )
            })}
          </ul>
        </div>
      ))}
      {openIndex >= 0 && (
        <AchievementDialog
          item={ACHIEVEMENTS[openIndex]}
          color={UNLOCKED_COLORS[openIndex % UNLOCKED_COLORS.length]}
          unlocked={owned.has(ACHIEVEMENTS[openIndex].id)}
          state={state}
          onClose={() => setOpenId(null)}
        />
      )}
    </section>
  )
}
