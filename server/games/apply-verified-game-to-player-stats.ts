import type { ReplaySummary } from "@/modules/block-puzzle/engine/replay-recorded-game-actions"
import type { PlayerStats } from "@/modules/player-profile/player-profile-types"

/** Cộng một ván đã được server replay vào thống kê người chơi (thuần, không I/O). */
export function applyVerifiedGameToPlayerStats(stats: PlayerStats, game: ReplaySummary): PlayerStats {
  return {
    gamesPlayed: stats.gamesPlayed + 1,
    bestScore: Math.max(stats.bestScore, game.score),
    totalScore: stats.totalScore + game.score,
    totalLinesCleared: stats.totalLinesCleared + game.linesCleared,
    bestCombo: Math.max(stats.bestCombo, game.bestCombo),
    boardClears: stats.boardClears + game.boardClears,
    totalMoves: stats.totalMoves + game.moveCount,
  }
}
