import { analyzeGameOutcomeFromState } from "../block-puzzle/engine/game-outcome-analysis"
import type { GameState } from "../block-puzzle/engine/game-types"
import type { RecordedGameAction } from "../block-puzzle/engine/replay-recorded-game-actions"

export interface GameAnalysisRequest {
  startState: GameState
  actions: RecordedGameAction[]
}

/** Kiểu tối thiểu của phạm vi worker (tsconfig dùng lib "dom", không có lib "webworker"). */
const scope = self as unknown as {
  onmessage: ((event: MessageEvent<GameAnalysisRequest>) => void) | null
  postMessage: (message: unknown) => void
}

/** Chạy phân tích sau ván ngoài luồng chính (tìm kiếm khay có thể tốn vài trăm ms trên máy yếu). */
scope.onmessage = (event) => {
  const { startState, actions } = event.data
  scope.postMessage(analyzeGameOutcomeFromState(startState, actions))
}
