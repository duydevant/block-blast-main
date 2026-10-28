"use client"

import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useState } from "react"
import { CheckIcon, CoinsIcon, GiftIcon } from "lucide-react"
import { toast } from "sonner"

import { CHUNKY_BUTTON, PANEL } from "@/components/game-ui/game-ui-classes"
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog"
import { fetchJsonWithFirebaseIdToken } from "@/lib/firebase/fetch-json-with-firebase-id-token"
import { useI18n } from "@/lib/i18n"
import { ApiRoutes } from "@/lib/routes"
import { DAILY_STATUS_QUERY_KEY, useDailyStatusQuery } from "@/modules/leaderboard/use-leaderboard-queries"
import { PLAYER_PROFILE_QUERY_KEY } from "@/modules/player-profile/use-player-profile-query"

import { type ClaimDailyRewardResponse, DAILY_REWARD_TRACK } from "../daily-reward-track"

/** Khối màu bay ra quanh đồng xu khi nhận thưởng (chỉ trang trí). */
const BURST = ["#ff6b6b", "#ffb547", "#9ad94a", "#2ec4b6", "#4ea8ff", "#c86bfa", "#ff7eb6", "#ffcf4a"]

function useClaimDailyRewardMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => fetchJsonWithFirebaseIdToken<ClaimDailyRewardResponse>(ApiRoutes.DAILY_CLAIM, { method: "POST" }),
    onSuccess: () => {
      for (const queryKey of [DAILY_STATUS_QUERY_KEY, PLAYER_PROFILE_QUERY_KEY]) void queryClient.invalidateQueries({ queryKey })
    },
  })
}

/**
 * Vòng thưởng 7 ngày của chuỗi + nút nhận: xong lượt tính điểm hôm nay là nhận được quà của ngày hiện tại
 * (ngày 7 là rương lớn). Nhận xong hiện hộp chúc mừng.
 */
export function DailyRewardTrack() {
  const { t, formatNumber } = useI18n()
  const reward = useDailyStatusQuery().data?.reward
  const claim = useClaimDailyRewardMutation()
  const [celebrate, setCelebrate] = useState<ClaimDailyRewardResponse | null>(null)
  if (!reward) return null

  const onClaim = () =>
    claim.mutate(undefined, {
      onSuccess: setCelebrate,
      onError: () => toast.error(t("reward.claimFailed")),
    })

  return (
    <section aria-label={t("reward.track")} className={`${PANEL} flex flex-col gap-3 p-4`}>
      <span className="font-extrabold">{t("reward.track")}</span>
      <ol className="grid grid-cols-7 gap-1.5">
        {DAILY_REWARD_TRACK.map((coins, index) => {
          const day = index + 1
          const past = day < reward.day || (day === reward.day && reward.claimed)
          const current = day === reward.day && !reward.claimed
          return (
            <li
              key={day}
              className={`flex flex-col items-center gap-1 rounded-xl py-2 text-[11px] font-bold ${
                current ? "bg-[#ff8a3d] text-[#2a1600] ring-2 ring-[#ffd9b8]" : past ? "bg-[#2f2863] text-violet-200/60" : "bg-[#2a2459] text-white"
              }`}
              aria-current={current ? "step" : undefined}
            >
              <span>{t("reward.dayShort", { day })}</span>
              {past ? (
                <CheckIcon className="size-4.5" aria-hidden="true" />
              ) : day === DAILY_REWARD_TRACK.length ? (
                <GiftIcon className="size-4.5" aria-hidden="true" />
              ) : (
                <CoinsIcon className="size-4.5" aria-hidden="true" />
              )}
              <span className="tabular-nums">{coins}</span>
            </li>
          )
        })}
      </ol>
      {reward.claimable ? (
        <button className={`${CHUNKY_BUTTON.primary} h-14 text-xl motion-safe:animate-pulse`} disabled={claim.isPending} onClick={onClaim}>
          <GiftIcon aria-hidden="true" />
          {t("reward.claim", { coins: formatNumber(reward.coins) })}
        </button>
      ) : (
        <p className="text-center text-sm text-muted-foreground">{t(reward.claimed ? "reward.claimed" : "reward.playFirst")}</p>
      )}

      <Dialog open={celebrate !== null} onOpenChange={(open) => !open && setCelebrate(null)}>
        <DialogContent className="max-w-xs items-center gap-4 rounded-[30px] border-2 border-[#ff8a3d] bg-[#1e1942] p-7 text-center text-white">
          <div className="relative mx-auto flex size-28 items-center justify-center" aria-hidden="true">
            {BURST.map((color, index) => (
              <span
                key={color}
                className="absolute size-3.5 rounded-[4px] motion-safe:animate-ping"
                style={{
                  background: color,
                  transform: `rotate(${index * 45}deg) translateY(-52px)`,
                  animationDuration: "1.4s",
                  animationIterationCount: 2,
                }}
              />
            ))}
            <span className="flex size-24 items-center justify-center rounded-full bg-[#ffb547] shadow-[0_6px_0_#b8561d] animate-in zoom-in-50 duration-500">
              <CoinsIcon className="size-12 text-[#2a1600]" />
            </span>
          </div>
          <DialogTitle className="font-heading text-[40px] leading-none font-extrabold text-[#ffcf7a]">
            {celebrate && t("reward.got", { coins: formatNumber(celebrate.coins) })}
          </DialogTitle>
          <DialogDescription className="text-sm text-violet-200/90">{celebrate && t("reward.gotSub", { day: celebrate.day })}</DialogDescription>
          <button className={`${CHUNKY_BUTTON.primary} h-13 w-full text-lg`} onClick={() => setCelebrate(null)}>
            {t("reward.great")}
          </button>
        </DialogContent>
      </Dialog>
    </section>
  )
}
