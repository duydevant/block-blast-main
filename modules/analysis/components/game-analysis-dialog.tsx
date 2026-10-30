"use client"

import { BlockBoardPreview } from "@/components/game-ui/block-board-preview"
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog"
import { useI18n } from "@/lib/i18n"
import type { GameOutcomeAnalysis } from "@/modules/block-puzzle/engine/game-outcome-analysis"
import { BOARD_SIZE, type BoardCells } from "@/modules/block-puzzle/engine/game-types"
import { findShape } from "@/modules/block-puzzle/engine/piece-shape-catalog"
import { GAME_PANEL, SECONDARY_BUTTON } from "@/modules/block-puzzle/components/game-ui-styles"
import { useBlockPuzzleGameStore } from "@/modules/block-puzzle/store/block-puzzle-game-store"
import { RelatedLessonLinks } from "@/modules/lessons/components/related-lesson-links"

import type { AnalysisState } from "../use-game-outcome-analysis"

/** Bàn → dòng ký tự cho BlockBoardPreview; ô của khối ở (row, col) đánh dấu bằng `mark` ("*" sáng / "+" viền cam). */
function boardRowsWithPiece(board: BoardCells, shapeId: string, row: number, col: number, mark: "*" | "+"): string[] {
  const marked = new Set((findShape(shapeId)?.cells ?? []).map(([r, c]) => (row + r) * BOARD_SIZE + col + c))
  return Array.from({ length: BOARD_SIZE }, (_, r) =>
    Array.from({ length: BOARD_SIZE }, (_, c) => {
      const index = r * BOARD_SIZE + c
      return marked.has(index) ? mark : board[index] ? String(board[index]) : "."
    }).join("")
  )
}

function AnalysisBody({ result }: { result: GameOutcomeAnalysis }) {
  const { t } = useI18n()
  const { decisive, suggestion } = result
  if (result.verdict !== "mistake" || !decisive) {
    return <p className="text-sm text-violet-100">{t(result.verdict === "unlucky" ? "analysis.unlucky" : "analysis.unknown")}</p>
  }
  return (
    <div className="flex flex-col gap-3 text-sm text-violet-100">
      <p className="font-bold">{t("analysis.mistake", { move: decisive.moveIndex + 1 })}</p>
      <div className="grid grid-cols-2 gap-3">
        <figure className="flex flex-col gap-1">
          <BlockBoardPreview rows={boardRowsWithPiece(decisive.boardBefore, decisive.shapeId, decisive.row, decisive.col, "*")} cellGap={2} />
          <figcaption className="text-xs text-violet-200/80">{t("analysis.yourMove")}</figcaption>
        </figure>
        {suggestion && (
          <figure className="flex flex-col gap-1">
            <BlockBoardPreview rows={boardRowsWithPiece(decisive.boardBefore, decisive.shapeId, suggestion.row, suggestion.col, "+")} cellGap={2} />
            <figcaption className="text-xs text-violet-200/80">{t("analysis.betterMove")}</figcaption>
          </figure>
        )}
      </div>
      <p>{t(suggestion ? "analysis.suggestion" : "analysis.noSuggestion")}</p>
      {result.holesCreated > 0 && <p>{t("analysis.holes", { count: result.holesCreated })}</p>}
    </div>
  )
}

/** Kết quả "Vì sao thua?": nước quyết định (trước / nên đặt), hoặc xui, hoặc chưa phân tích được. */
export function GameAnalysisDialog({ state, onClose }: { state: AnalysisState; onClose: () => void }) {
  const { t } = useI18n()
  // Bàn lúc thua (bài "Cứu bàn gần đầy" khi bàn quá chật).
  const finalBoard = useBlockPuzzleGameStore((store) => (store.game?.isGameOver ? store.game.board : null))
  return (
    <Dialog open={state.status !== "idle"} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className={GAME_PANEL + " flex max-w-sm flex-col gap-4 p-6"}>
        <DialogTitle className="font-heading text-2xl font-extrabold">{t("analysis.title")}</DialogTitle>
        <DialogDescription className="sr-only">{t("analysis.running")}</DialogDescription>
        {state.status === "done" ? (
          <>
            <AnalysisBody result={state.result} />
            <RelatedLessonLinks holesCreated={state.result.holesCreated} finalBoard={finalBoard} />
          </>
        ) : (
          <p className="text-sm text-violet-200/80" role="status">
            {t("analysis.running")}
          </p>
        )}
        <button className={SECONDARY_BUTTON + " w-full"} onClick={onClose}>
          {t("analysis.close")}
        </button>
      </DialogContent>
    </Dialog>
  )
}
