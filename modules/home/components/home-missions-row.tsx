"use client"

import { useState } from "react"
import { CheckIcon, RefreshCwIcon } from "lucide-react"
import { toast } from "sonner"

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { useI18n } from "@/lib/i18n"
import { useDailyStatusQuery } from "@/modules/leaderboard/use-leaderboard-queries"
import { missionTitle } from "@/modules/progression/progression-labels"
import { useReplaceMissionMutation } from "@/modules/progression/use-replace-mission-mutation"

const RING_COLORS = ["#2ec4b6", "#4ea8ff", "#ffb547"]

/** 3 nhiệm vụ hôm nay dạng vòng tiến độ: số ở giữa, tên ngắn bên dưới; mỗi ngày đổi được 1 nhiệm vụ chưa xong. */
export function HomeMissionsRow() {
  const i18n = useI18n()
  const { t, formatNumber } = i18n
  const status = useDailyStatusQuery().data
  const replace = useReplaceMissionMutation()
  const [confirmSlot, setConfirmSlot] = useState<number | null>(null)
  if (!status) return null
  const { missions, missionReplaceAvailable } = status

  const replaceSlot = (slot: number) =>
    replace.mutate(slot, {
      onSuccess: () => toast.success(t("missions.replaced")),
      onError: () => toast.error(t("missions.replaceFailed")),
    })
  // Có tiến độ thì hỏi trước (mất tiến độ), chưa có thì đổi luôn.
  const requestReplace = (slot: number) => (missions[slot].progress > 0 ? setConfirmSlot(slot) : replaceSlot(slot))

  return (
    <section aria-label={t("home.missions")} className="grid grid-cols-3 gap-2.5">
      {missions.map((mission, index) => {
        const done = mission.progress >= mission.target
        const percent = Math.min(100, Math.round((mission.progress / mission.target) * 100))
        const title = missionTitle(i18n, mission.kind, mission.target)
        return (
          <div key={mission.id} className="flex flex-col items-center gap-1.5 rounded-2xl bg-card p-2.5">
            <div
              className="flex size-12 items-center justify-center rounded-full"
              style={{ background: `conic-gradient(${RING_COLORS[index % RING_COLORS.length]} ${percent}%, #2f2863 0)` }}
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={mission.target}
              aria-valuenow={mission.progress}
              aria-label={title}
            >
              <span className="flex size-[38px] items-center justify-center rounded-full bg-card text-[11px] font-extrabold tabular-nums">
                {done ? <CheckIcon className="size-4.5" aria-hidden="true" /> : `${formatNumber(mission.progress)}/${formatNumber(mission.target)}`}
              </span>
            </div>
            <span className="line-clamp-2 text-center text-[11px] leading-tight text-muted-foreground">{title}</span>
            {missionReplaceAvailable && !done && (
              <button
                onClick={() => requestReplace(index)}
                disabled={replace.isPending}
                aria-label={t("missions.replaceLabel", { name: title })}
                className="mt-auto flex items-center gap-1 rounded-full bg-[#2a2459] px-2 py-0.5 text-[11px] font-bold text-violet-200 hover:brightness-125 disabled:opacity-50"
              >
                <RefreshCwIcon className="size-3" aria-hidden="true" />
                {t("missions.replace")}
              </button>
            )}
          </div>
        )
      })}
      <AlertDialog open={confirmSlot !== null} onOpenChange={(open) => !open && setConfirmSlot(null)}>
        <AlertDialogContent size="sm">
          <AlertDialogHeader>
            <AlertDialogTitle>{t("missions.replaceTitle")}</AlertDialogTitle>
            <AlertDialogDescription>{t("missions.replaceBody")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("missions.replaceCancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (confirmSlot !== null) replaceSlot(confirmSlot)
                setConfirmSlot(null)
              }}
            >
              {t("missions.replaceConfirm")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  )
}
