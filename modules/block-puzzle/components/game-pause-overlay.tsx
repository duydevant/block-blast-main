"use client"

import Link from "next/link"
import { HomeIcon, PauseIcon, PlayIcon, RotateCcwIcon } from "lucide-react"

import { ICON_TILE } from "@/components/game-ui/game-ui-classes"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { useI18n } from "@/lib/i18n"
import { Routes } from "@/lib/routes"
import type { VariantRun } from "@/modules/game-modes/variant-run"

import { GAME_PANEL, PRIMARY_BUTTON, SECONDARY_BUTTON } from "./game-ui-styles"

/**
 * Chế độ nào được tạm dừng. 1v1 / Xếp hạng / Đấu trường có giờ: đồng hồ do server giữ, đối thủ (bóng ma) vẫn chạy →
 * dừng không dừng được giờ, chỉ cho thêm thời gian nghĩ hoặc bắt đối thủ chờ → không cho dừng.
 */
export function isPausableRun(run: VariantRun | null): boolean {
  if (!run) return true
  if (run.kind === "duel" || run.kind === "ranked") return false
  if (run.kind === "arena") return run.endsAt === null
  return true
}

/** Nút tạm dừng ở góc trái HUD (thay nút về nhà; về nhà nằm trong màn tạm dừng). */
export function GamePauseButton({ onPause }: { onPause: () => void }) {
  const { t } = useI18n()
  return (
    <button type="button" className={ICON_TILE} aria-label={t("game.pause")} onClick={onPause}>
      <PauseIcon aria-hidden="true" />
    </button>
  )
}

/** Màn tạm dừng: che bàn (không nhìn bàn lúc nghỉ), chặn mọi thao tác; Esc / bấm ra ngoài = chơi tiếp. */
export function GamePauseDialog({ open, onResume, onRestart }: { open: boolean; onResume: () => void; onRestart: () => void }) {
  const { t } = useI18n()
  return (
    <>
      {open && <div className="fixed inset-0 z-40 bg-[#120f2b]/90 backdrop-blur-lg" aria-hidden="true" />}
      <Dialog open={open} onOpenChange={(next) => !next && onResume()}>
        <DialogContent className={GAME_PANEL + " gap-4"} showCloseButton={false}>
          <DialogHeader className="items-center text-center">
            <DialogTitle className="font-heading text-[28px] font-extrabold">{t("game.pausedTitle")}</DialogTitle>
            <DialogDescription>{t("game.pausedBody")}</DialogDescription>
          </DialogHeader>
          <Button className={PRIMARY_BUTTON + " w-full"} onClick={onResume} autoFocus>
            <PlayIcon className="size-5 fill-current" aria-hidden="true" />
            {t("game.resume")}
          </Button>
          <div className="grid grid-cols-2 gap-2">
            <Button className={SECONDARY_BUTTON + " text-base"} onClick={onRestart}>
              <RotateCcwIcon className="size-4.5" aria-hidden="true" />
              {t("game.pauseRestart")}
            </Button>
            <Button className={SECONDARY_BUTTON + " text-base"} render={<Link href={Routes.HOME} />}>
              <HomeIcon className="size-4.5" aria-hidden="true" />
              {t("ui.home")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
