import { isPureRun } from "@/modules/block-puzzle/engine/game-run-stats"
import type { ReplaySummary } from "@/modules/block-puzzle/engine/replay-recorded-game-actions"
import type { PlayerStats, RankedGameMode, StatsByMode } from "@/modules/player-profile/player-profile-types"
import { isQualifyingGame } from "@/modules/progression/player-level-curve"

/** Ván thuần đủ nước để tính (ván 1–2 nước không dùng trợ giúp không có ý nghĩa). */
export function isCountedPureGame(game: ReplaySummary): boolean {
  return isPureRun(game.runStats) && isQualifyingGame(game.moveCount)
}

/** Cộng một ván đã được server replay vào thống kê người chơi (thuần, không I/O). */
export function applyVerifiedGameToPlayerStats(stats: PlayerStats, game: ReplaySummary): PlayerStats {
  const pure = isCountedPureGame(game)
  return {
    gamesPlayed: stats.gamesPlayed + 1,
    bestScore: Math.max(stats.bestScore, game.score),
    totalScore: stats.totalScore + game.score,
    totalLinesCleared: stats.totalLinesCleared + game.linesCleared,
    bestCombo: Math.max(stats.bestCombo, game.bestCombo),
    boardClears: stats.boardClears + game.boardClears,
    totalMoves: stats.totalMoves + game.moveCount,
    pureGames: stats.pureGames + (pure ? 1 : 0),
    bestPureScore: pure ? Math.max(stats.bestPureScore, game.score) : stats.bestPureScore,
    multiClears3: stats.multiClears3 + game.runStats.multiClears[1],
    maxLinesInMove: Math.max(stats.maxLinesInMove, game.runStats.maxLinesInMove),
  }
}

/** Cộng một ván vào thống kê của đúng chế độ chơi. */
export function applyVerifiedGameToModeStats(byMode: StatsByMode, mode: RankedGameMode, score: number): StatsByMode {
  const current = byMode[mode] ?? { games: 0, best: 0, total: 0 }
  return { ...byMode, [mode]: { games: current.games + 1, best: Math.max(current.best, score), total: current.total + score } }
}
