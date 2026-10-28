"use client"

import { ShuffleIcon } from "lucide-react"

import { useI18n } from "@/lib/i18n"

import type { Rect } from "../render/canvas-layout-metrics"
import { useBlockPuzzleGameStore } from "../store/block-puzzle-game-store"

/** Nút "Đổi khối" (đổi cả khay, số lượt còn lại) đặt đúng chỗ canvas chừa bên phải ô "Cất". */
export function TraySwapButton({ rect }: { rect: Rect }) {
  const { t } = useI18n()
  const charges = useBlockPuzzleGameStore((state) => state.game?.replaceCharges ?? 0)
  const gameOver = useBlockPuzzleGameStore((state) => state.game?.isGameOver ?? false)
  const replaceTray = useBlockPuzzleGameStore((state) => state.replaceTray)
  const fontSize = Math.max(12, Math.round(rect.height * 0.3))

  return (
    <button
      type="button"
      className="absolute flex items-center justify-center gap-2 rounded-[32%/40%] bg-[#2a2459] font-heading font-extrabold text-white shadow-[0_4px_0_#1a1540] transition hover:bg-[#332c6b] active:translate-y-0.5 active:shadow-[0_2px_0_#1a1540] disabled:opacity-40 disabled:shadow-none"
      style={{ left: rect.x, top: rect.y, width: rect.width, height: rect.height, fontSize }}
      aria-label={`${t("game.replaceTray")} (${charges})`}
      disabled={gameOver || charges <= 0}
      onClick={() => replaceTray()}
    >
      <ShuffleIcon style={{ width: fontSize * 1.2, height: fontSize * 1.2 }} aria-hidden="true" />
      {t("game.swap")}
      <span
        className="flex items-center justify-center rounded-full bg-[#ffb547] font-sans font-extrabold text-[#2a1600]"
        style={{ minWidth: fontSize * 1.5, height: fontSize * 1.5, fontSize: fontSize * 0.85 }}
      >
        {charges}
      </span>
    </button>
  )
}
