"use client"

import { CheckIcon } from "lucide-react"

import { useI18n } from "@/lib/i18n"
import { useDailyStatusQuery } from "@/modules/leaderboard/use-leaderboard-queries"
import { missionTitle } from "@/modules/progression/progression-labels"

const RING_COLORS = ["#2ec4b6", "#4ea8ff", "#ffb547"]

/** 3 nhiệm vụ hôm nay dạng vòng tiến độ: số ở giữa, tên ngắn bên dưới. */
export function HomeMissionsRow() {
  const i18n = useI18n()
  const { formatNumber } = i18n
  const missions = useDailyStatusQuery().data?.missions
  if (!missions) return null

  return (
    <section aria-label={i18n.t("home.missions")} className="grid grid-cols-3 gap-2.5">
      {missions.map((mission, index) => {
        const done = mission.progress >= mission.target
        const percent = Math.min(100, Math.round((mission.progress / mission.target) * 100))
        return (
          <div key={mission.id} className="flex flex-col items-center gap-1.5 rounded-2xl bg-card p-2.5">
            <div
              className="flex size-12 items-center justify-center rounded-full"
              style={{ background: `conic-gradient(${RING_COLORS[index % RING_COLORS.length]} ${percent}%, #2f2863 0)` }}
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={mission.target}
              aria-valuenow={mission.progress}
              aria-label={missionTitle(i18n, mission.kind, mission.target)}
            >
              <span className="flex size-[38px] items-center justify-center rounded-full bg-card text-[11px] font-extrabold tabular-nums">
                {done ? <CheckIcon className="size-4.5" aria-hidden="true" /> : `${formatNumber(mission.progress)}/${formatNumber(mission.target)}`}
              </span>
            </div>
            <span className="line-clamp-2 text-center text-[11px] leading-tight text-muted-foreground">
              {missionTitle(i18n, mission.kind, mission.target)}
            </span>
          </div>
        )
      })}
    </section>
  )
}
