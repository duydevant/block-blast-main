import type { GameRunStats } from "@/modules/block-puzzle/engine/game-run-stats"
import type { RankedGameStart } from "@/modules/block-puzzle/engine/replay-recorded-game-actions"
import { variantForRun } from "@/modules/game-modes/variant-run"
import type { RankedGameMode } from "@/modules/player-profile/player-profile-types"
import type { PlayerTierId } from "@/modules/progression/player-form-rules"

/** GET /api/replays/{id} — công khai, không có uid. */
export interface GameReplayResponse {
  id: string
  mode: RankedGameMode
  seed: number
  stashUnlocked: boolean
  levelId: number | null
  /** Nước đi đã nén (recorded-action-codec). */
  actions: number[]
  score: number
  moveCount: number
  runStats: GameRunStats | null
  displayName: string | null
  /** Tag khách ("A1B2") khi chưa đặt tên. */
  guestTag: string
  tier: PlayerTierId | null
  /** Tag hồ sơ công khai (/u/{tag}); null = chưa có. */
  playerTag: string | null
  /** Epoch ms. */
  createdAt: number
}

/** POST /api/replays */
export interface SaveReplayResponse {
  replayId: string
}

/** Người chơi tự lưu tối đa bấy nhiêu ván (ngoài ván kỷ lục / lọt top được lưu tự động). */
export const MAX_SAVED_REPLAYS = 20

/** Điều kiện đầu ván để phát lại — biến thể suy từ chế độ + màn như server, không lưu trong replay. */
export function replayStartFor(replay: Pick<GameReplayResponse, "mode" | "seed" | "stashUnlocked" | "levelId">): RankedGameStart {
  const variant =
    replay.mode === "level" && replay.levelId !== null
      ? variantForRun({ kind: "level", levelId: replay.levelId })
      : replay.mode === "duel" || replay.mode === "logic"
        ? variantForRun({ kind: replay.mode })
        : undefined
  return { seed: replay.seed, stashUnlocked: replay.stashUnlocked, variant }
}
