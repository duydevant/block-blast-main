/**
 * Đo độ khó Đấu trường bằng bot tham lam: `npm run arena-balance` (mặc định 200 ván / cấp).
 * Tỉ lệ thắng LƯỢT = 1 − (1 − p)^số lần thử (loại thường) hoặc p^số ván (Bền bỉ), p = tỉ lệ 1 ván đạt mục tiêu.
 * Bỏ qua đồng hồ loại Tốc độ (bot đặt khối tức thì) → con số Tốc độ là trần trên.
 * Mục tiêu tham khảo: L1 ~70%, L5 ~15%.
 */
import { chooseMove } from "../modules/block-puzzle/engine/balance-simulator"
import { createNewGame, gameReducer } from "../modules/block-puzzle/engine/game-state-reducer"
import { ARENA_LEVEL_COUNT, ARENA_TYPES, findArenaLevel } from "../modules/game-modes/arena-catalog"

const games = Number(process.argv[2]) || 200
const rows: Record<string, string>[] = []

for (const type of ARENA_TYPES) {
  for (let level = 1; level <= ARENA_LEVEL_COUNT; level++) {
    const definition = findArenaLevel(type, level)!
    let met = 0
    for (let index = 0; index < games; index++) {
      let game = createNewGame(1 + index * 7919 + level * 104729, definition.variant)
      let moves = 0
      while (!game.isGameOver && moves < 1500) {
        const move = chooseMove(game)
        if (!move) break
        game = gameReducer(game, { type: "PLACE_PIECE", ...move })
        moves++
      }
      const { goal } = definition
      const value = goal.kind === "score" ? game.score : goal.kind === "lines" ? (game.linesCleared ?? 0) : (game.runStats?.bestCombo ?? 0)
      if (value >= goal.target) met++
    }
    const p = met / games
    const runWin = type === "endurance" ? p ** definition.attempts : 1 - (1 - p) ** definition.attempts
    rows.push({ type, level: `L${level}`, goal: `${definition.goal.kind} ${definition.goal.target}`, oneGame: `${Math.round(p * 100)}%`, run: `${Math.round(runWin * 100)}%` })
  }
}
console.table(rows)
