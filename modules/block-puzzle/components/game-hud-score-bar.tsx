"use client"

import Link from "next/link"
import { useState } from "react"
import { CrownIcon, HomeIcon } from "lucide-react"

import { ICON_TILE } from "@/components/game-ui/game-ui-classes"
import { useI18n } from "@/lib/i18n"
import { Routes } from "@/lib/routes"
import { DuelHud } from "@/modules/duel/components/duel-hud"
import { DuelLeaveButton } from "@/modules/duel/components/duel-leave-button"

import { useBlockPuzzleGameStore } from "../store/block-puzzle-game-store"
import { GamePauseButton } from "./game-pause-overlay"
import { GameSettingsMenu } from "./game-settings-menu"
import { GameStatsDialog, GameThemesDialog } from "./game-themes-and-stats-dialogs"
import { useAnimatedNumber } from "./use-animated-number"

interface GameHudScoreBarProps {
  onRestart: () => void
  onShowHowToPlay: () => void
  onStartDaily: () => void
  /** Có khi chế độ hiện tại tạm dừng được (ván chưa hết): nút trái thành Tạm dừng. */
  onPause?: () => void
}

/**
 * Thanh trên màn chơi: về nhà · kỷ lục (mở thống kê) + điểm thật to · menu.
 * Đấu 1v1: giữa là bảng điểm hai bên, Home hỏi trước khi bỏ trận, menu không có ván mới / chế độ khác.
 * Chế độ tạm dừng được: nút trái là Tạm dừng (về nhà nằm trong màn tạm dừng).
 */
export function GameHudScoreBar({ onRestart, onShowHowToPlay, onStartDaily, onPause }: GameHudScoreBarProps) {
  const { t, formatNumber } = useI18n()
  const score = useBlockPuzzleGameStore((state) => state.game?.score ?? 0)
  const best = useBlockPuzzleGameStore((state) => state.best)
  const duelRun = useBlockPuzzleGameStore((state) => (state.variantRun?.kind === "duel" ? state.variantRun : null))
  const gameOver = useBlockPuzzleGameStore((state) => state.game?.isGameOver ?? false)
  const displayScore = useAnimatedNumber(score)
  const [popup, setPopup] = useState<"themes" | "stats" | null>(null)
  const inDuel = duelRun !== null && !gameOver

  return (
    <header className="grid grid-cols-[44px_minmax(0,1fr)_44px] items-center gap-2 px-4 pt-3 pb-1">
      {inDuel ? (
        <DuelLeaveButton duelId={duelRun.duelId} />
      ) : onPause ? (
        <GamePauseButton onPause={onPause} />
      ) : (
        <Link href={Routes.HOME} className={ICON_TILE} aria-label={t("ui.home")}>
          <HomeIcon aria-hidden="true" />
        </Link>
      )}

      {duelRun ? (
        <DuelHud run={duelRun} />
      ) : (
      <div className="flex flex-col items-center leading-none">
        <button
          className="flex items-center gap-1 rounded-full px-2 py-0.5 text-[13px] font-bold text-[#ffcf7a] hover:bg-white/8"
          aria-label={`${t("game.best")}: ${formatNumber(best)}. ${t("game.statistics")}`}
          onClick={() => setPopup("stats")}
        >
          <CrownIcon className="size-3.5 fill-current" aria-hidden="true" />
          <span className="tabular-nums">{formatNumber(best)}</span>
        </button>
        <span className="font-heading text-[52px] font-extrabold tracking-tight text-white tabular-nums" aria-hidden="true">
          {formatNumber(displayScore)}
        </span>
        <span className="sr-only" aria-live="polite">
          {t("game.score")}: {formatNumber(score)}
        </span>
      </div>
      )}

      <GameSettingsMenu
        onShowHowToPlay={onShowHowToPlay}
        onShowThemes={() => setPopup("themes")}
        onRestart={duelRun ? undefined : onRestart}
        onStartDaily={duelRun ? undefined : onStartDaily}
      />

      <GameThemesDialog open={popup === "themes"} onClose={() => setPopup(null)} />
      <GameStatsDialog open={popup === "stats"} onClose={() => setPopup(null)} />
    </header>
  )
}
