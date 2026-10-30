import type { BoardCells, GameState, TrayPiece } from "./game-types"
import { dealGuaranteedTray } from "./guaranteed-tray-dealer"
import { dealTray, type DealResult } from "./piece-tray-generator"

/**
 * Chia khay mới cho một ván: gom tham số bộ chia từ state và chọn bộ chia theo biến thể
 * (chế độ "Không bế tắc" → khay luôn có cách đặt hết). Mọi chỗ chia khay trong engine đi qua đây.
 */
export function dealTrayForState(
  state: Pick<GameState, "rngState" | "nextPieceUid" | "generatorState" | "guaranteedTray">,
  board: BoardCells,
  score: number,
  stash: TrayPiece | null = null
): DealResult {
  const deal = state.guaranteedTray ? dealGuaranteedTray : dealTray
  return deal(board, score, state.rngState, state.nextPieceUid, state.generatorState, stash)
}
