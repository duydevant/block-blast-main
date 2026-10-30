import "server-only"

import type { DocumentReference, DocumentSnapshot, FieldValue, Firestore, Transaction } from "firebase-admin/firestore"

import type { RecordedGameAction, ReplaySummary } from "@/modules/block-puzzle/engine/replay-recorded-game-actions"
import type { ChallengeRewardResult } from "@/modules/challenge/challenge-reward-rules"
import type { RankedGameMode } from "@/modules/player-profile/player-profile-types"
import { totalLevelStars } from "@/modules/progression/achievement-catalog"
import { missionBandForTier } from "@/modules/progression/daily-mission-catalog"
import { formFromRecent, type PlayerTier, tierForForm } from "@/modules/progression/player-form-rules"
import type { ArenaSubmitContext, summarizeArenaAttempt } from "@/server/arena/apply-arena-attempt"
import { type ChallengeRewardPlan, writeChallengeReward } from "@/server/challenges/challenge-reward-submission"
import { type StoredPlayer, USERS_COLLECTION } from "@/server/profile/stored-player-document"
import { type RankedOutcome, type RankedSessionInfo, writeRankedResult } from "@/server/ranked/apply-ranked-result"
import { writeSeasonProgress } from "@/server/seasons/season-documents"

import { isCountedPureGame } from "./apply-verified-game-to-player-stats"

/**
 * Phần GHI riêng theo chế độ của một lượt nộp ván (sau khi transaction đã đọc xong): lượt Đấu trường, tiến độ mùa,
 * kết quả trận xếp hạng, thưởng thách đấu 2 chiều. Trả thưởng thách đấu (xu người nhận cộng ở doc người chơi).
 */
export function writeModeResults(
  tx: Transaction,
  db: Firestore,
  input: {
    uid: string
    gameId: string
    mode: RankedGameMode
    stored: StoredPlayer
    summary: ReplaySummary
    actions: readonly RecordedGameAction[]
    times: readonly number[] | null
    flagged: boolean
    countsForDaily: boolean
    firstDailyRun: boolean
    tierAfter: PlayerTier
    levelStarsAfter: Readonly<Record<string, number>>
    arena: ArenaSubmitContext | null
    arenaResult: ReturnType<typeof summarizeArenaAttempt>
    season: { key: string; ref: DocumentReference; snap: DocumentSnapshot }
    ranked: { outcome: RankedOutcome; session: RankedSessionInfo & { seed: number } } | null
    challengeReward: ChallengeRewardPlan | null
    today: string
    stamp: FieldValue
    nowMs: number
  }
): ChallengeRewardResult | null {
  const { stored, summary, mode, arena, arenaResult } = input
  if (arena && arenaResult.outcome && Object.keys(arenaResult.outcome.runPatch).length > 0) tx.update(arena.ref, arenaResult.outcome.runPatch)

  // Mùa giải: ván bị gắn cờ không tính (số ván, Bậc cao nhất, nhiệm vụ mùa).
  if (!input.flagged) {
    writeSeasonProgress(tx, {
      ref: input.season.ref,
      snap: input.season.snap,
      season: input.season.key,
      bandIfNew: missionBandForTier(tierForForm(formFromRecent(stored.recentFormScores))),
      stamp: input.stamp,
      game: {
        linesCleared: summary.linesCleared,
        firstDailyRun: mode === "daily" && input.countsForDaily && input.firstDailyRun,
        tierAfter: input.tierAfter,
        levelStarsGained: totalLevelStars(input.levelStarsAfter) - totalLevelStars(stored.levelStars),
        pureScore: isCountedPureGame(summary) ? summary.score : 0,
        isDuel: mode === "duel",
        arenaWon: arenaResult.won,
      },
    })
  }

  if (input.ranked) {
    writeRankedResult(tx, db, {
      uid: input.uid,
      gameId: input.gameId,
      outcome: input.ranked.outcome,
      session: input.ranked.session,
      stored,
      tier: input.tierAfter,
      actions: input.actions,
      times: input.times,
      score: summary.score,
      moveCount: summary.moveCount,
      flagged: input.flagged,
      nowMs: input.nowMs,
    })
  }
  if (!input.challengeReward) return null
  const userRef = db.collection(USERS_COLLECTION).doc(input.uid)
  return writeChallengeReward(tx, input.challengeReward, { uid: input.uid, userRef, today: input.today, stamp: input.stamp })
}
