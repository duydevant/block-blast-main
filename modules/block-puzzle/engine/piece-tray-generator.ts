import { canShapeFitAnywhere } from "./board-grid-operations"
import { findSmartShapeIndices, NATIVE_SHAPE_CELLS } from "./board-smart-selector"
import { BLOCK_COLOR_COUNT, TRAY_SIZE, type BoardCells, type CellOffset, type TrayGeneratorState, type TrayPiece } from "./game-types"
import { findShape, SHAPE_CATALOG } from "./piece-shape-catalog"
import { nextRandom } from "./seeded-random-generator"
import { CLASSIC_POOLS, selectPoolQueue } from "./tray-generator-config"

export const INITIAL_GENERATOR_STATE: TrayGeneratorState = { stepsBeforeSmart: 2, poolIndices: [], currentPool: [] }

export interface DealResult {
  tray: TrayPiece[]
  rngState: number
  nextPieceUid: number
  generatorState: TrayGeneratorState
}

const geometryKey = (cells: readonly CellOffset[]) => cells.map(([r, c]) => r * 8 + c).sort((a, b) => a - b).join(",")
const byGeometry = new Map(SHAPE_CATALOG.map((shape) => [geometryKey(shape.cells), shape.id]))
export const CLASSIC_SHAPE_IDS = NATIVE_SHAPE_CELLS.map((cells) => {
  const id = byGeometry.get(geometryKey(cells))
  if (!id) throw new Error("Missing classic shape geometry: " + geometryKey(cells))
  return id
})

/** Smart, bag, bag; bag draws are not filtered for solvability.
 * Explicit state keeps partially consumed bags intact across saves.
 */
export function dealTray(board: BoardCells, score: number, rngState: number, nextPieceUid: number,
  previous: TrayGeneratorState = INITIAL_GENERATOR_STATE, stash: TrayPiece | null = null): DealResult {
  let state = rngState
  const random = () => {
    const [value, next] = nextRandom(state)
    state = next
    return value
  }
  const color = () => Math.floor(random() * BLOCK_COLOR_COUNT) + 1
  let steps = previous.stepsBeforeSmart < 0 ? 2 : previous.stepsBeforeSmart
  const smart = steps >= 2
  steps--
  let poolIndices = [...previous.poolIndices]
  let currentPool = [...previous.currentPool]
  const tray: TrayPiece[] = []
  const smartIndices = smart ? findSmartShapeIndices(board) : []
  for (let slot = 0; slot < TRAY_SIZE; slot++) {
    let index: number
    if (smart) index = smartIndices[slot]
    else {
      if (currentPool.length === 0) {
        if (poolIndices.length === 0) poolIndices = selectPoolQueue(score, random)
        currentPool = [...CLASSIC_POOLS[poolIndices.shift()! - 1]]
      }
      index = currentPool.splice(Math.floor(random() * currentPool.length), 1)[0]
    }
    tray.push({ uid: nextPieceUid + slot, shapeId: CLASSIC_SHAPE_IDS[index], colorId: color() })
  }
  const fits = (piece: TrayPiece) => canShapeFitAnywhere(board, findShape(piece.shapeId)!)
  if (!smart && !tray.some(fits) && !(stash && fits(stash))) {
    tray[0] = { ...tray[0], shapeId: "dot", colorId: color() }
  }
  return { tray, rngState: state, nextPieceUid: nextPieceUid + TRAY_SIZE,
    generatorState: { stepsBeforeSmart: steps, poolIndices, currentPool } }
}
