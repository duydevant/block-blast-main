"use client"

import { useState } from "react"
import { FlagIcon } from "lucide-react"
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
import { fetchJsonWithFirebaseIdToken } from "@/lib/firebase/fetch-json-with-firebase-id-token"
import { useI18n } from "@/lib/i18n"
import { ApiRoutes } from "@/lib/routes"
import { useSignedInUid } from "@/modules/player-profile/use-player-profile-query"

/** Báo cáo replay nghi bot / gian lận (cần đăng nhập, kể cả khách). Admin xem replay trước khi trao thưởng hạng. */
export function ReplayReportButton({ replayId }: { replayId: string }) {
  const { t } = useI18n()
  const uid = useSignedInUid()
  const [open, setOpen] = useState(false)
  const [sent, setSent] = useState(false)
  if (!uid) return null

  const send = async () => {
    setOpen(false)
    try {
      await fetchJsonWithFirebaseIdToken(ApiRoutes.REPORTS, { method: "POST", body: { replayId, reason: "bot" } })
      setSent(true)
      toast.success(t("replay.reportDone"))
    } catch {
      toast.error(t("replay.reportFailed"))
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        disabled={sent}
        className="mx-auto flex items-center gap-1 text-xs text-muted-foreground underline-offset-2 hover:underline disabled:opacity-50"
      >
        <FlagIcon className="size-3.5" aria-hidden="true" />
        {t("replay.report")}
      </button>
      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent size="sm">
          <AlertDialogHeader>
            <AlertDialogTitle>{t("replay.reportTitle")}</AlertDialogTitle>
            <AlertDialogDescription>{t("replay.reportBody")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("replay.reportCancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={send}>{t("replay.reportConfirm")}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
