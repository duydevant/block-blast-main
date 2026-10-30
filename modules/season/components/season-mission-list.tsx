"use client"

import { CheckIcon, CoinsIcon } from "lucide-react"
import { toast } from "sonner"

import { useI18n } from "@/lib/i18n"
import type { SeasonMissionStatus } from "@/modules/progression/season-mission-catalog"

import { useClaimSeasonRewardMutation } from "../use-season-queries"

/** Tên nhiệm vụ mùa; tierReach hiện tên Bậc thay vì số. */
function useMissionTitle() {
  const { t, formatNumber } = useI18n()
  const tierByValue = ["unranked", "bronze", "silver", "gold", "platinum", "diamond", "master"] as const
  return (mission: SeasonMissionStatus) =>
    mission.kind === "tierReach"
      ? t("season.mission.tierReach", { tier: t(`tier.${tierByValue[mission.target] ?? "master"}`) })
      : t(`season.mission.${mission.kind}`, { target: formatNumber(mission.target) })
}

/** 5 nhiệm vụ mùa: thanh tiến độ, thưởng, nút nhận khi đạt. */
export function SeasonMissionList({ season, missions }: { season: string; missions: SeasonMissionStatus[] }) {
  const { t, formatNumber } = useI18n()
  const titleOf = useMissionTitle()
  const claim = useClaimSeasonRewardMutation()

  const claimMission = (mission: SeasonMissionStatus) =>
    claim.mutate(
      { kind: "mission", season, missionId: mission.id },
      {
        onSuccess: (result) => toast.success(t("season.claimed", { coins: formatNumber(result.coins), xp: formatNumber(result.xp) })),
        onError: () => toast.error(t("season.claimFailed")),
      }
    )

  return (
    <ul className="flex flex-col gap-2">
      {missions.map((mission) => {
        const done = mission.progress >= mission.target
        const percent = Math.min(100, Math.round((mission.progress / mission.target) * 100))
        return (
          <li key={mission.id} className="flex flex-col gap-1.5 rounded-2xl bg-card p-3">
            <div className="flex items-center justify-between gap-2 text-sm font-bold">
              <span>{titleOf(mission)}</span>
              <span className="flex shrink-0 items-center gap-1 text-xs text-[#ffcf7a]">
                <CoinsIcon className="size-3.5" aria-hidden="true" />
                {formatNumber(mission.coins)} · +{formatNumber(mission.xp)} XP
              </span>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-[#2f2863]" role="progressbar" aria-valuemin={0} aria-valuemax={mission.target} aria-valuenow={mission.progress}>
                <div className="h-full rounded-full bg-[#2ec4b6]" style={{ width: `${percent}%` }} />
              </div>
              {mission.claimed ? (
                <CheckIcon className="size-4 text-[#2ec4b6]" aria-label={t("season.claimedLabel")} />
              ) : done ? (
                <button onClick={() => claimMission(mission)} disabled={claim.isPending} className="rounded-full bg-[#ffb547] px-3 py-0.5 text-xs font-bold text-[#2a1600] disabled:opacity-50">
                  {t("season.claim")}
                </button>
              ) : (
                <span className="text-[11px] text-muted-foreground tabular-nums">
                  {formatNumber(mission.progress)}/{formatNumber(mission.target)}
                </span>
              )}
            </div>
          </li>
        )
      })}
    </ul>
  )
}
