"use client"

import { BlockBoardPreview } from "@/components/game-ui/block-board-preview"
import { BOARD_SIZE, type GameState } from "@/modules/block-puzzle/engine/game-types"

import { duelBoardRows } from "../duel-move-replay"

const EMPTY_ROWS = Array.from({ length: BOARD_SIZE }, () => ".".repeat(BOARD_SIZE))

/** Bàn trực tiếp của một người (đọc từ nước đi đã replay); chưa có seed thì bàn trống. */
export function DuelBoardPreview({ board, className = "" }: { board: GameState | null | undefined; className?: string }) {
  return <BlockBoardPreview rows={board ? duelBoardRows(board) : EMPTY_ROWS} cellGap={2} className={className} />
}

/**
 * Thẻ một người chơi trong trận: tên + nhãn (hết nước, mất kết nối…), bàn trực tiếp, điểm to.
 * Dùng ở phòng đấu (người chơi + người xem) và bảng hết ván.
 */
export function DuelBoardCard({
  name,
  board,
  score,
  tag,
  highlight = false,
}: {
  name: string
  board: GameState | null | undefined
  score: string
  tag: string | null
  highlight?: boolean
}) {
  return (
    <div className={`flex min-w-0 flex-col items-center gap-2 rounded-3xl p-3 ${highlight ? "bg-[#3d1530] ring-2 ring-[#ffcf4a]" : "bg-[#2a1226]"}`}>
      <div className="flex w-full min-w-0 items-center justify-between gap-1.5">
        <span className="truncate text-sm font-extrabold">{name}</span>
        {tag && <span className="shrink-0 rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-bold text-violet-100">{tag}</span>}
      </div>
      <DuelBoardPreview board={board} className="w-full max-w-[220px]" />
      <span className="font-heading text-[30px] leading-none font-extrabold tabular-nums">{score}</span>
    </div>
  )
}
