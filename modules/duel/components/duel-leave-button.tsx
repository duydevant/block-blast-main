"use client"

import { useRouter } from "next/navigation"
import { useState } from "react"
import { HomeIcon } from "lucide-react"

import { ICON_TILE } from "@/components/game-ui/game-ui-classes"
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
import { Routes } from "@/lib/routes"
import { GAME_PANEL, PRIMARY_BUTTON, SECONDARY_BUTTON } from "@/modules/block-puzzle/components/game-ui-styles"
import { useBlockPuzzleGameStore } from "@/modules/block-puzzle/store/block-puzzle-game-store"

/** Nút Home khi đang đấu: hỏi trước, bỏ trận = chốt ván (nộp điểm hiện tại) rồi về phòng đấu. */
export function DuelLeaveButton({ duelId }: { duelId: string }) {
  const { t } = useI18n()
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const endVariantRun = useBlockPuzzleGameStore((state) => state.endVariantRun)

  return (
    <>
      <button className={ICON_TILE} aria-label={t("duel.leave")} onClick={() => setOpen(true)}>
        <HomeIcon aria-hidden="true" />
      </button>
      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent className={GAME_PANEL}>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("duel.leaveTitle")}</AlertDialogTitle>
            <AlertDialogDescription>{t("duel.leaveDescription")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className={PRIMARY_BUTTON}>{t("duel.keepPlaying")}</AlertDialogCancel>
            <AlertDialogAction
              className={SECONDARY_BUTTON}
              onClick={() => {
                endVariantRun()
                router.push(`${Routes.DUEL}/${duelId}`)
              }}
            >
              {t("duel.leave")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
