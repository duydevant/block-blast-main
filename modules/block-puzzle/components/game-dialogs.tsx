"use client"

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
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { useI18n } from "@/lib/i18n"
import { HowToPlayVisual } from "@/components/game-ui/how-to-play-visual"
import { GAME_PANEL, PRIMARY_BUTTON, SECONDARY_BUTTON } from "./game-ui-styles"
import { useRestartCurrentMode } from "./use-special-mode-launcher"

export function RestartConfirmDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { t } = useI18n()
  const startNewGame = useRestartCurrentMode()

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent size="sm" className={GAME_PANEL}>
        <AlertDialogHeader>
          <AlertDialogTitle className="text-xl font-bold">{t("game.restartTitle")}</AlertDialogTitle>
          <AlertDialogDescription>{t("game.restartDescription")}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel className={SECONDARY_BUTTON + " px-5"}>{t("game.cancel")}</AlertDialogCancel>
          <AlertDialogAction
            className={PRIMARY_BUTTON + " px-5"}
            onClick={() => {
              startNewGame()
              onOpenChange(false)
            }}
          >
            {t("game.confirmRestart")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

/** Cách chơi bằng hình (3 bước + 3 trợ giúp), ít chữ. */
export function HowToPlayDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useI18n()

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className={GAME_PANEL + " max-h-[92dvh] gap-4 overflow-y-auto"}>
        <DialogHeader>
          <DialogTitle className="text-center font-heading text-[28px] font-extrabold">{t("game.howToPlay")}</DialogTitle>
        </DialogHeader>
        <HowToPlayVisual />
        <DialogFooter>
          <Button className={PRIMARY_BUTTON + " w-full"} onClick={onClose}>{t("howto.letsPlay")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
