"use client"

import { useMemo } from "react"
import { SearchIcon } from "lucide-react"

import { useI18n } from "@/lib/i18n"
import { SECONDARY_BUTTON } from "@/modules/block-puzzle/components/game-ui-styles"
import { useBlockPuzzleGameStore } from "@/modules/block-puzzle/store/block-puzzle-game-store"

import { findStartStateFor, startAnalysisStartCapture } from "../analysis-start-capture"
import { useGameOutcomeAnalysis } from "../use-game-outcome-analysis"
import { GameAnalysisDialog } from "./game-analysis-dialog"

// Theo dõi state đầu ván ngay khi module được tải (màn chơi), trước khi hộp hết ván mở ra.
startAnalysisStartCapture()

/**
 * Nút "Vì sao thua?" ở hộp hết ván: chỉ hiện khi ván đã hết, có log nước đi, không phải màn chơi (hết số nước)
 * và tìm được state đầu ván để chơi lại. Không có gợi ý trong ván — chỉ phân tích sau khi đã thua.
 */
export function GameOverAnalysisButton() {
  const { t } = useI18n()
  const game = useBlockPuzzleGameStore((state) => state.game)
  const actionLog = useBlockPuzzleGameStore((state) => state.actionLog)
  const { state, run, reset } = useGameOutcomeAnalysis()
  const startState = useMemo(
    () => (game?.isGameOver && game.moveLimit === undefined && actionLog.length > 0 ? findStartStateFor(game, actionLog) : null),
    [game, actionLog]
  )
  if (!startState) return null

  return (
    <>
      <button className={SECONDARY_BUTTON + " w-full text-lg"} onClick={() => run(startState, actionLog)}>
        <SearchIcon aria-hidden="true" />
        {t("analysis.button")}
      </button>
      <GameAnalysisDialog state={state} onClose={reset} />
    </>
  )
}
