import { create } from "zustand"
import { createJSONStorage, persist } from "zustand/middleware"

import { gameReducer } from "../engine/game-state-reducer"
import type { GameState } from "../engine/game-types"
import { MAX_RECORDED_ACTIONS, type RecordedGameAction } from "../engine/replay-recorded-game-actions"
import {
  EMPTY_RANKED_GAME_CLOUD_STATE,
  type IssuedChallengeStart,
  type IssuedDailyStart,
  type IssuedRankedSeed,
  type IssuedVariantStart,
  isUntouchedGame,
  parseSavedRankedGameCloudState,
  type RankedGameCloudState,
} from "./ranked-game-cloud-state"
import { challengeGameState, dailyGameState, freshGameState, variantGameState, withCurrentGameQueued } from "./ranked-game-start-states"
import { safeLocalStorage } from "./safe-local-storage"
import { parseSavedGame } from "./saved-game-schema"

/** Key cố định theo module (không theo tên game) để đổi tên trong env không làm mất save. */
const STORAGE_KEY = "block-puzzle.save"
/** Tăng khi đổi catalog khối/luật làm save cũ không còn khớp (save cũ sẽ bị bỏ, giữ best). */
const SAVE_VERSION = 3

interface BlockPuzzleGameStore extends RankedGameCloudState {
  game: GameState | null
  best: number
  hasHydrated: boolean
  startNewGame: () => void
  /** Kết thúc ván hiện tại (đưa vào hàng chờ nếu tính điểm) và vào thử thách hằng ngày. */
  startDailyGame: (start: IssuedDailyStart) => void
  /** Kết thúc ván hiện tại và vào lượt nhận thách đấu. */
  startChallengeGame: (start: IssuedChallengeStart) => void
  /** Kết thúc ván hiện tại và vào sự kiện tuần / màn chơi / đấu 1v1. */
  startVariantGame: (start: IssuedVariantStart) => void
  /** Chốt ván chế độ đặc biệt (hết giờ đấu, qua màn): hết ván, không hồi sinh → sync tự nộp. */
  endVariantRun: () => void
  finishTutorial: () => void
  /** Trả về true nếu đặt được khối. */
  placePiece: (slot: number, row: number, col: number) => boolean
  stashPiece: (slot: number) => boolean
  replaceTray: () => boolean
  revive: () => boolean
  setNextRankedSeed: (seed: IssuedRankedSeed) => void
  /** Bỏ seed dự phòng (VD cấp lúc ô cất còn khoá) để sync xin seed mới. */
  discardNextRankedSeed: () => void
  /** Hết ván và hết hồi sinh → đưa ván vào hàng chờ nộp ngay, không đợi ván mới. */
  queueFinishedRankedGame: () => void
  removePendingSubmission: (gameId: string) => void
  /** Đổi tài khoản → bỏ seed/ván/hàng chờ của uid khác (không nộp được bằng token mới). */
  dropCloudStateForOtherUser: (uid: string) => void
}

export const useBlockPuzzleGameStore = create<BlockPuzzleGameStore>()(
  persist(
    (set, get) => {
      /** Áp action qua reducer; hợp lệ thì lưu state mới và ghi vào log nước đi. */
      const applyRecorded = (action: RecordedGameAction): boolean => {
        const { game, best, actionLog, rankedSession } = get()
        if (!game) return false
        const next = gameReducer(game, action)
        if (next === game) return false
        const actions = [...actionLog, action]
        // Log vượt giới hạn server nhận → ván này thành offline thay vì bị server từ chối rồi mất.
        const tooLong = actions.length > MAX_RECORDED_ACTIONS && rankedSession !== null && !rankedSession.queued
        set({ game: next, best: Math.max(best, next.score), actionLog: actions, ...(tooLong ? { rankedSession: null } : {}) })
        return true
      }

      return {
        game: null,
        best: 0,
        hasHydrated: false,
        ...EMPTY_RANKED_GAME_CLOUD_STATE,
        startNewGame: () => set(freshGameState(get())),
        startDailyGame: (start) => set(dailyGameState(get(), start)),
        startChallengeGame: (start) => set(challengeGameState(get(), start)),
        startVariantGame: (start) => set(variantGameState(get(), start)),
        endVariantRun: () => {
          const { game, variantRun } = get()
          if (!game || !variantRun || (game.isGameOver && game.reviveUsed)) return
          set({ game: { ...game, isGameOver: true, reviveUsed: true, lastMove: null } })
        },
        finishTutorial: () => {
          const state = get()
          // Không bao giờ thay ván thật đang có tiến độ, ván tính điểm hay ván thử thách chưa chơi.
          if (state.game && (!isUntouchedGame(state.game) || state.rankedSession || state.dailyDay || state.challenge || state.variantRun)) return
          set(freshGameState(state))
        },
        placePiece: (slot, row, col) => applyRecorded({ type: "PLACE_PIECE", slot, row, col }),
        stashPiece: (slot) => applyRecorded({ type: "STASH_PIECE", slot }),
        replaceTray: () => applyRecorded({ type: "REPLACE_TRAY" }),
        revive: () => applyRecorded({ type: "REVIVE" }),
        setNextRankedSeed: (seed) => set({ nextRankedSeed: seed }),
        discardNextRankedSeed: () => set({ nextRankedSeed: null }),
        queueFinishedRankedGame: () => {
          const state = get()
          if (!state.rankedSession || state.rankedSession.queued) return
          set({ pendingSubmissions: withCurrentGameQueued(state), rankedSession: { ...state.rankedSession, queued: true } })
        },
        removePendingSubmission: (gameId) =>
          set({ pendingSubmissions: get().pendingSubmissions.filter((item) => item.gameId !== gameId) }),
        dropCloudStateForOtherUser: (uid) => {
          const { rankedSession, nextRankedSeed, pendingSubmissions, challenge, variantRun } = get()
          const stale = (item: { uid: string } | null) => item !== null && item.uid !== uid
          if (!stale(rankedSession) && !stale(nextRankedSeed) && !pendingSubmissions.some(stale)) return
          set({
            rankedSession: stale(rankedSession) ? null : rankedSession,
            // Ván thách đấu của tài khoản cũ thành ván offline → bỏ nhãn/so điểm thách đấu.
            challenge: stale(rankedSession) ? null : challenge,
            // Ván đấu của tài khoản cũ không còn nộp được → bỏ đồng hồ/đối thủ; sự kiện, màn chơi vẫn chơi tiếp offline.
            variantRun: stale(rankedSession) && variantRun?.kind === "duel" ? null : variantRun,
            nextRankedSeed: stale(nextRankedSeed) ? null : nextRankedSeed,
            pendingSubmissions: pendingSubmissions.filter((item) => !stale(item)),
          })
        },
      }
    },
    {
      name: STORAGE_KEY,
      version: SAVE_VERSION,
      // Rehydrate thủ công sau khi mount để tránh lệch HTML giữa server và client.
      skipHydration: true,
      storage: createJSONStorage(() => safeLocalStorage),
      partialize: (state) => ({
        game: state.game,
        best: state.best,
        rankedSession: state.rankedSession,
        actionLog: state.actionLog,
        nextRankedSeed: state.nextRankedSeed,
        pendingSubmissions: state.pendingSubmissions,
        dailyDay: state.dailyDay,
        challenge: state.challenge,
        variantRun: state.variantRun,
      }),
      // Đổi version: bỏ ván dở (có thể không khớp catalog mới), chỉ giữ kỷ lục.
      migrate: (persisted) => ({ game: null, best: parseSavedGame(persisted).best }),
      merge: (persisted, current) => {
        const saved = parseSavedGame(persisted)
        const cloud = parseSavedRankedGameCloudState(persisted)
        const game = saved.game && gameReducer(saved.game, { type: "RESTORE", state: saved.game })
        // Ván hỏng/bị bỏ thì log nước đi không còn khớp → ván mới không tính điểm.
        const ranked = game
          ? { rankedSession: cloud.rankedSession, actionLog: cloud.actionLog, dailyDay: cloud.dailyDay, challenge: cloud.challenge, variantRun: cloud.variantRun }
          : { rankedSession: null, actionLog: [], dailyDay: null, challenge: null, variantRun: null }
        return { ...current, ...cloud, ...ranked, game, best: Math.max(saved.best, game?.score ?? 0) }
      },
      onRehydrateStorage: () => () => {
        const state = useBlockPuzzleGameStore.getState()
        if (!state.game) state.startNewGame()
        useBlockPuzzleGameStore.setState({ hasHydrated: true })
      },
    }
  )
)
