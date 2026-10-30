"use client"

import { gameReducer } from "@/modules/block-puzzle/engine/game-state-reducer"
import type { GameState } from "@/modules/block-puzzle/engine/game-types"
import type { RecordedGameAction } from "@/modules/block-puzzle/engine/replay-recorded-game-actions"
import { useBlockPuzzleGameStore } from "@/modules/block-puzzle/store/block-puzzle-game-store"
import { safeLocalStorage } from "@/modules/block-puzzle/store/safe-local-storage"
import { parseSavedGame } from "@/modules/block-puzzle/store/saved-game-schema"

/**
 * Store không giữ seed của ván đang chơi (chỉ gameId) → ghi lại state đầu của vài ván gần nhất (lúc chưa đi
 * nước nào) để phân tích sau ván chơi lại được, kể cả ván offline / ván cất rồi lấy ra. Ván nào khớp được tìm
 * bằng cách chơi lại actionLog và so với state hiện tại.
 */
const STORAGE_KEY = "block-puzzle.analysis-starts"
const MAX_STARTS = 6

function readStarts(): GameState[] {
  try {
    const raw = JSON.parse(String(safeLocalStorage.getItem(STORAGE_KEY) ?? "[]"))
    if (!Array.isArray(raw)) return []
    // localStorage không tin cậy → validate như save game.
    return raw.flatMap((item) => parseSavedGame({ game: item, best: 0 }).game ?? [])
  } catch {
    return []
  }
}

function writeStarts(starts: GameState[]) {
  try {
    void safeLocalStorage.setItem(STORAGE_KEY, JSON.stringify(starts.slice(-MAX_STARTS)))
  } catch {}
}

const fingerprint = (game: GameState) => JSON.stringify([game.board, game.tray, game.rngState, game.nextPieceUid])

function captureIfFresh(game: GameState | null, actionLog: readonly RecordedGameAction[]) {
  if (!game || game.isGameOver || game.moveCount !== 0 || actionLog.length !== 0) return
  const starts = readStarts()
  const key = fingerprint(game)
  if (starts.some((start) => fingerprint(start) === key)) return
  writeStarts([...starts, { ...game, lastMove: null }])
}

let started = false

/**
 * Bắt đầu theo dõi store (gọi nhiều lần vẫn chỉ đăng ký 1 lần). Trên server store không bao giờ đổi nên đăng ký
 * thừa cũng vô hại; storage rơi về bộ nhớ tạm khi không có localStorage.
 */
export function startAnalysisStartCapture() {
  if (started) return
  started = true
  const initial = useBlockPuzzleGameStore.getState()
  captureIfFresh(initial.game, initial.actionLog)
  useBlockPuzzleGameStore.subscribe((state, previous) => {
    if (state.game !== previous.game) captureIfFresh(state.game, state.actionLog)
  })
}

/** State đầu của ván hiện tại: chơi lại `actions` từ đó phải ra đúng bàn + điểm + số nước hiện tại. */
export function findStartStateFor(game: GameState, actions: readonly RecordedGameAction[]): GameState | null {
  for (const start of readStarts().reverse()) {
    let state = start
    let valid = true
    for (const action of actions) {
      const next = gameReducer(state, action)
      if (next === state) {
        valid = false
        break
      }
      state = next
    }
    const same = state.score === game.score && state.moveCount === game.moveCount && state.board.every((cell, index) => cell === game.board[index])
    if (valid && same) return start
  }
  return null
}
