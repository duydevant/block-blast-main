import "server-only"

import type { FieldValue, Firestore, Transaction } from "firebase-admin/firestore"

import type { RecordedGameAction, ReplaySummary } from "@/modules/block-puzzle/engine/replay-recorded-game-actions"
import type { RankedGameMode } from "@/modules/player-profile/player-profile-types"
import { totalLevelStars } from "@/modules/progression/achievement-catalog"
import { formFromRecent, type PlayerTier } from "@/modules/progression/player-form-rules"
import { boardWritesForRankedGame } from "@/server/leaderboards/leaderboard-categories"
import type { StoredPlayer } from "@/server/profile/stored-player-document"
import { GAME_REPLAYS_COLLECTION } from "@/server/replays/replay-documents"
import { decideReplayStorage, type ReplayDecision } from "@/server/replays/should-store-replay"
import { writeSubmittedGameReplay } from "@/server/replays/write-submitted-game-replay"

import { type BoardRowBase, type PendingBoardUpdate, readBoardUpdates, topChangedBoards, writeBoardUpdates } from "./write-leaderboard-entries"

export interface BoardsAndReplayInput {
  uid: string
  gameId: string
  stored: StoredPlayer
  session: { mode: RankedGameMode; seed: number; stashUnlocked: boolean; levelId: number | null; day: string | null }
  now: Date
  countsForDaily: boolean
  firstDailyRun: boolean
  summary: ReplaySummary
  actions: readonly RecordedGameAction[]
  /** Sau khi cộng ván này. */
  recentFormScores: readonly number[]
  tierAfter: PlayerTier
  levelStarsAfter: Readonly<Record<string, number>>
  /** Ván bị gắn cờ / tài khoản bị khoá: không bảng, không replay. */
  flagged: boolean
}

export interface PreparedBoardsAndReplay {
  updates: PendingBoardUpdate[]
  row: BoardRowBase
  replay: ReplayDecision
  /** Replay kỷ lục cũ đang được BXH mọi lúc giữ (đọc trước khi ghi). */
  previousBestPinnedByBoard: boolean
}

/** Phần ĐỌC (trong transaction): bảng nào cần ghi, top nào đổi → có lưu replay không. */
export async function prepareBoardsAndReplay(tx: Transaction, db: Firestore, input: BoardsAndReplayInput): Promise<PreparedBoardsAndReplay> {
  const { stored, summary, session } = input
  const writes = input.flagged
    ? []
    : boardWritesForRankedGame({
        mode: session.mode,
        now: input.now,
        day: session.day,
        countsForDaily: input.countsForDaily,
        firstDailyRun: input.firstDailyRun,
        summary,
        formBefore: formFromRecent(stored.recentFormScores),
        formAfter: formFromRecent(input.recentFormScores),
        levelStarsBefore: totalLevelStars(stored.levelStars),
        levelStarsAfter: totalLevelStars(input.levelStarsAfter),
      })
  const updates = await readBoardUpdates(tx, db, writes, input.uid)
  const tier = input.tierAfter === "unranked" ? null : input.tierAfter
  const row: BoardRowBase = { uid: input.uid, displayName: stored.displayName, ...(tier ? { tier } : {}), ...(stored.referralCode ? { tag: stored.referralCode } : {}) }
  const replay = decideReplayStorage({
    moveCount: summary.moveCount,
    score: summary.score,
    previousBestScore: stored.stats.bestScore,
    topChangedBoards: topChangedBoards(updates, row),
    suspect: input.flagged || session.mode === "arena",
  })
  const previousBestId = replay.personalBest ? stored.bestReplayId : null
  const previousBestPinnedByBoard =
    previousBestId !== null && previousBestId !== input.gameId
      ? (await tx.get(db.collection(GAME_REPLAYS_COLLECTION).doc(previousBestId))).get("pinnedByBoard") === true
      : false
  return { updates, row, replay, previousBestPinnedByBoard }
}

/** Phần GHI: entry + top các bảng (kèm replayId nếu lưu), doc replay. Trả field cần ghi vào doc người chơi. */
export function writeBoardsAndReplay(
  tx: Transaction,
  db: Firestore,
  input: BoardsAndReplayInput,
  prepared: PreparedBoardsAndReplay,
  stamp: FieldValue
): { bestReplayId?: string } {
  const { replay } = prepared
  writeBoardUpdates(tx, db, prepared.updates, prepared.row, stamp, replay.store ? input.gameId : null)
  if (!replay.store) return {}
  const { day, ...session } = input.session
  void day
  return writeSubmittedGameReplay(tx, db, {
    gameId: input.gameId,
    uid: input.uid,
    stored: input.stored,
    session,
    actions: input.actions,
    summary: input.summary,
    tier: input.tierAfter,
    decision: replay,
    previousBestPinnedByBoard: prepared.previousBestPinnedByBoard,
    stamp,
    nowMs: input.now.getTime(),
  })
}
