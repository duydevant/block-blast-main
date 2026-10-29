"use client"

import { useState } from "react"
import { CalendarDaysIcon, CircleHelpIcon, MenuIcon, PaletteIcon, RotateCcwIcon, VibrateIcon, VibrateOffIcon, Volume2Icon, VolumeXIcon } from "lucide-react"

import { CHUNKY_BUTTON, ICON_TILE } from "@/components/game-ui/game-ui-classes"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { useI18n } from "@/lib/i18n"

import { useBlockPuzzleSettingsStore } from "../store/block-puzzle-settings-store"
import { GameDisplaySettingsSection } from "./game-display-settings-section"
import { GAME_PANEL } from "./game-ui-styles"

/** Ô vuông có icon + 1-2 chữ (menu dạng lưới, ít chữ). */
const TILE =
  "flex h-[76px] flex-col items-center justify-center gap-1.5 rounded-2xl bg-[#2a2459] text-sm font-bold text-white transition hover:bg-[#332c6b] aria-[pressed=false]:text-violet-200/70 [&_svg]:size-6"

interface GameSettingsMenuProps {
  onShowHowToPlay: () => void
  onShowThemes: () => void
  /** Không truyền = ẩn (đang đấu 1v1: không bỏ trận sang ván khác từ menu). */
  onRestart?: () => void
  onStartDaily?: () => void
}

/** Menu trong ván (nút ☰): bật/tắt âm thanh, rung; cách chơi, màu khối, thử thách ngày; điều khiển & hiển thị; ván mới. */
export function GameSettingsMenu({ onShowHowToPlay, onShowThemes, onRestart, onStartDaily }: GameSettingsMenuProps) {
  const { t } = useI18n()
  const [open, setOpen] = useState(false)
  const sound = useBlockPuzzleSettingsStore((state) => state.sound)
  const haptics = useBlockPuzzleSettingsStore((state) => state.haptics)
  const setSound = useBlockPuzzleSettingsStore((state) => state.setSound)
  const setHaptics = useBlockPuzzleSettingsStore((state) => state.setHaptics)
  const then = (action: () => void) => () => {
    setOpen(false)
    action()
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<button className={ICON_TILE} aria-label={t("ui.menu")} />}>
        <MenuIcon />
      </DialogTrigger>
      <DialogContent className={GAME_PANEL + " max-h-[90dvh] max-w-sm gap-3 overflow-y-auto"}>
        <DialogHeader>
          <DialogTitle className="text-center font-heading text-2xl font-extrabold">{t("ui.menu")}</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-3 gap-2.5">
          <button className={TILE} aria-pressed={sound} onClick={() => setSound(!sound)}>
            {sound ? <Volume2Icon aria-hidden="true" /> : <VolumeXIcon aria-hidden="true" />}
            {t("game.sound")}
          </button>
          <button className={TILE} aria-pressed={haptics} onClick={() => setHaptics(!haptics)}>
            {haptics ? <VibrateIcon aria-hidden="true" /> : <VibrateOffIcon aria-hidden="true" />}
            {t("game.haptics")}
          </button>
          <button className={TILE} onClick={then(onShowThemes)}>
            <PaletteIcon aria-hidden="true" />
            {t("game.themes")}
          </button>
          <button className={TILE} onClick={then(onShowHowToPlay)}>
            <CircleHelpIcon aria-hidden="true" />
            {t("game.howToPlay")}
          </button>
          {onStartDaily && (
            <button className={TILE + " col-span-2"} onClick={then(onStartDaily)}>
              <CalendarDaysIcon className="text-[#ff8a3d]" aria-hidden="true" />
              {t("daily.title")}
            </button>
          )}
        </div>
        <GameDisplaySettingsSection />
        {onRestart && (
          <button className={`${CHUNKY_BUTTON.primary} mt-1 h-14 text-xl`} onClick={then(onRestart)}>
            <RotateCcwIcon aria-hidden="true" />
            {t("game.newGame")}
          </button>
        )}
      </DialogContent>
    </Dialog>
  )
}
