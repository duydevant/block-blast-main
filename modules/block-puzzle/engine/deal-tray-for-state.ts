import { BLOCK_COLOR_COUNT, TRAY_SIZE, type BoardCells, type GameState, type TrayPiece, type TraySlots } from "./game-types"
import { dealGuaranteedTray } from "./guaranteed-tray-dealer"
import { dealTray, type DealResult, INITIAL_GENERATOR_STATE } from "./piece-tray-generator"
import { nextRandom } from "./seeded-random-generator"

/** Kết quả chia khay cho một ván; `fixedTrays` chỉ có khi ván đang chia từ danh sách khay cố định (bài học). */
export type StateDealResult = Omit<DealResult, "tray"> & { tray: TraySlots; fixedTrays?: readonly (readonly string[])[] }

/** Bài học: khay kế tiếp trong danh sách (khối theo shapeId, màu theo rng); slot thiếu để trống. */
function dealFixedTray(
  state: Pick<GameState, "rngState" | "nextPieceUid" | "generatorState">,
  fixedTrays: readonly (readonly string[])[]
): StateDealResult {
  let rngState = state.rngState
  const [next, ...rest] = fixedTrays
  const tray: (TrayPiece | null)[] = Array.from({ length: TRAY_SIZE }, (_, slot) => {
    const shapeId = next[slot]
    if (!shapeId) return null
    const [value, advanced] = nextRandom(rngState)
    rngState = advanced
    return { uid: state.nextPieceUid + slot, shapeId, colorId: Math.floor(value * BLOCK_COLOR_COUNT) + 1 }
  })
  return { tray, rngState, nextPieceUid: state.nextPieceUid + TRAY_SIZE, generatorState: state.generatorState ?? INITIAL_GENERATOR_STATE, fixedTrays: rest }
}

/**
 * Chia khay mới cho một ván: gom tham số bộ chia từ state và chọn bộ chia theo biến thể
 * (bài học → khay cố định trước; "Không bế tắc" → khay luôn có cách đặt hết). Mọi chỗ chia khay trong engine đi qua đây.
 */
export function dealTrayForState(
  state: Pick<GameState, "rngState" | "nextPieceUid" | "generatorState" | "guaranteedTray" | "fixedTrays">,
  board: BoardCells,
  score: number,
  stash: TrayPiece | null = null
): StateDealResult {
  if (state.fixedTrays && state.fixedTrays.length > 0) return dealFixedTray(state, state.fixedTrays)
  const deal = state.guaranteedTray ? dealGuaranteedTray : dealTray
  return deal(board, score, state.rngState, state.nextPieceUid, state.generatorState, stash)
}
