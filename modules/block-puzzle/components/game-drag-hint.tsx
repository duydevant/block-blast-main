"use client"

import { HandIcon } from "lucide-react"

import { useI18n } from "@/lib/i18n"

import { useBlockPuzzleGameStore } from "../store/block-puzzle-game-store"

/** Gợi ý bằng hình cho người mới: chưa từng ghi điểm và chưa đi nước nào. */
export function GameDragHint() {
  const { t } = useI18n()
  const show = useBlockPuzzleGameStore((state) => state.best === 0 && state.game?.moveCount === 0 && !state.variantRun)
  if (!show) return null
  return (
    <p className="mx-auto flex items-center gap-2 rounded-full bg-[#ffb547] px-3.5 py-2 text-[15px] font-extrabold text-[#2a1600] shadow-[0_4px_0_#b8561d] motion-safe:animate-bounce">
      <HandIcon className="size-5" aria-hidden="true" />
      {t("game.dragHint")}
    </p>
  )
}
