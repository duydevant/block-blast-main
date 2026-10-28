import "server-only"

import { FieldValue, type Firestore } from "firebase-admin/firestore"

import { replayRecordedGame, type RecordedGameAction } from "@/modules/block-puzzle/engine/replay-recorded-game-actions"
import { NO_GAME_REWARDS, type SubmitRankedGameResponse } from "@/modules/player-profile/player-profile-types"
import type { DuelState } from "@/modules/duel/duel-types"
import { findLevel, starsForLevel } from "@/modules/game-modes/level-catalog"
import { dailyMissionProgressSchema } from "@/modules/progression/daily-mission-catalog"
import { advanceDailyStreak } from "@/server/daily/advance-daily-streak"
import { dayKeyFor } from "@/server/daily/daily-challenge-calendar"
import { dailyRunCounts } from "@/server/daily/daily-run-counts"
import { duelRef, mirrorDuelState } from "@/server/duels/duel-documents"
import { parseDuel } from "@/server/duels/duel-store"
import { recordDuelResultInTransaction } from "@/server/duels/record-duel-result"
import { getAdminFirestore } from "@/server/firebase/firebase-admin-app"
import { HttpError } from "@/server/http/authenticated-json-route"
import { boardIdsForRankedGame } from "@/server/leaderboards/leaderboard-board-ids"
import { leaderboardRef, parseLeaderboardTop } from "@/server/leaderboards/leaderboard-documents"
import { mergeScoreIntoTopList } from "@/server/leaderboards/merge-score-into-top-list"
import { applyProgressionForVerifiedGame, referralIsDue } from "@/server/progression/apply-progression-for-verified-game"
import {
  DAILY_RESULTS_SUBCOLLECTION,
  GAME_SESSIONS_COLLECTION,
  LEADERBOARD_ENTRIES_SUBCOLLECTION,
  MISSIONS_SUBCOLLECTION,
  parseStoredPlayer,
  USERS_COLLECTION,
} from "@/server/profile/stored-player-document"

import { CHALLENGE_RESULTS_SUBCOLLECTION, CHALLENGES_COLLECTION } from "@/server/challenges/challenge-documents"

import { applyVerifiedGameToPlayerStats } from "./apply-verified-game-to-player-stats"
import { storedSessionSchema, variantForSession } from "./stored-game-session"

function challengeResultRefs(db: Firestore, challengeId: string, uid: string) {
  const challenge = db.collection(CHALLENGES_COLLECTION).doc(challengeId)
  return { challenge, result: challenge.collection(CHALLENGE_RESULTS_SUBCOLLECTION).doc(uid) }
}

type SubmitOutcome =
  | { ok: true; response: SubmitRankedGameResponse; duelState?: DuelState | null }
  | { ok: false; error: HttpError }

/**
 * Replay ván rồi ghi kết quả trong một transaction: thống kê, streak + kết quả daily, bảng xếp hạng.
 * Mỗi session chỉ nộp được một lần; log sai → session `rejected` và 422.
 * Daily: chỉ lượt đã giữ chỗ lúc bắt đầu (lượt đầu của ngày) và nộp chậm nhất hết ngày hôm sau mới vào
 * bảng ngày + streak (`dailyRunCounts`); lượt khác vẫn cộng thống kê.
 * Challenge: không vào bảng xếp hạng, chỉ ghi điểm tốt nhất vào challenges/{id}/results/{uid}.
 * Mọi chế độ: cộng XP/xu, nhiệm vụ ngày (theo ngày nộp), thành tích, quà mời bạn.
 */
export async function recordSubmittedRankedGame(
  uid: string,
  gameId: string,
  actions: RecordedGameAction[]
): Promise<SubmitRankedGameResponse> {
  const db = getAdminFirestore()
  const sessionRef = db.collection(GAME_SESSIONS_COLLECTION).doc(gameId)
  const userRef = db.collection(USERS_COLLECTION).doc(uid)
  const now = new Date()
  const today = dayKeyFor(now)

  const outcome = await db.runTransaction<SubmitOutcome>(async (tx) => {
    // ── Đọc (Firestore bắt buộc đọc hết trước khi ghi) ──
    const [sessionSnap, userSnap] = await tx.getAll(sessionRef, userRef)
    const session = storedSessionSchema.safeParse(sessionSnap.data())
    // Session của người khác trả về 404 như không tồn tại, tránh dò gameId.
    if (!session.success || session.data.uid !== uid) return { ok: false, error: new HttpError(404, "game-not-found") }
    if (session.data.status !== "open") return { ok: false, error: new HttpError(409, "game-already-submitted") }

    const finishedAt = FieldValue.serverTimestamp()
    const { mode, day, seed, stashUnlocked, challengeId, eventWeek, levelId, duelId } = session.data
    const dailyResultRef = day ? userRef.collection(DAILY_RESULTS_SUBCOLLECTION).doc(day) : null
    const dailyClaim = dailyResultRef ? (await tx.get(dailyResultRef)).data() : undefined
    const countsForDaily = day !== null && dailyRunCounts({ claim: dailyClaim, gameId, day, today })

    const replay = replayRecordedGame({ seed, stashUnlocked, variant: variantForSession(session.data) }, actions)
    if (!replay.ok) {
      tx.update(sessionRef, { status: "rejected", rejectReason: replay.reason, finishedAt })
      return { ok: false, error: new HttpError(422, "replay-rejected") }
    }

    const stored = parseStoredPlayer(userSnap.data())
    const { summary } = replay
    // Ván bỏ ngang chưa đi nước nào: đóng session, không tính gì. Daily thì nhả chỗ giữ để chơi lại
    // được lượt tính điểm (seed trong ngày không đổi nên mở lại không có lợi gì).
    if (summary.moveCount === 0) {
      if (dailyResultRef && countsForDaily) tx.delete(dailyResultRef)
      tx.update(sessionRef, { status: "abandoned", finishedAt })
      return { ok: true, response: { score: 0, stats: stored.stats, improvedBoards: [], rewards: NO_GAME_REWARDS } }
    }
    const boardIds = boardIdsForRankedGame(mode, now, day, countsForDaily, eventWeek)
    const entryRefs = boardIds.map((boardId) => leaderboardRef(db, boardId).collection(LEADERBOARD_ENTRIES_SUBCOLLECTION).doc(uid))
    const entrySnaps = entryRefs.length > 0 ? await tx.getAll(...entryRefs) : []
    const improved = boardIds.filter((_, index) => {
      const previous = entrySnaps[index].get("score")
      return typeof previous !== "number" || summary.score > previous
    })
    const boardSnaps = improved.length > 0 ? await tx.getAll(...improved.map((boardId) => leaderboardRef(db, boardId))) : []
    const challengeRefs = mode === "challenge" && challengeId ? challengeResultRefs(db, challengeId, uid) : null
    const [challengeResultSnap, challengeSnap] = challengeRefs ? await tx.getAll(challengeRefs.result, challengeRefs.challenge) : []
    const previousChallengeScore = challengeResultSnap?.get("score")
    // Ô cất chỉ "mở vĩnh viễn" khi người chơi tự mở trong ván; ván thách đấu thừa hưởng ô cất của người thách.
    const stashEarned = summary.stashUnlocked && (mode !== "challenge" || !stashUnlocked)

    const stats = applyVerifiedGameToPlayerStats(stored.stats, summary)
    const streak = day && countsForDaily ? advanceDailyStreak(stored.streak, day) : stored.streak
    const missionsRef = userRef.collection(MISSIONS_SUBCOLLECTION).doc(today)
    const inviterRef = referralIsDue(stored, summary.moveCount) && stored.referredBy ? db.collection(USERS_COLLECTION).doc(stored.referredBy) : null
    const [missionsSnap, inviterSnap] = await tx.getAll(missionsRef, ...(inviterRef ? [inviterRef] : []))
    const duelDocRef = mode === "duel" && duelId ? duelRef(db, duelId) : null
    const duel = duelDocRef ? parseDuel((await tx.get(duelDocRef)).data()) : null
    const levelDefinition = mode === "level" && levelId !== null ? findLevel(levelId) : undefined
    const progression = applyProgressionForVerifiedGame({
      stored,
      stats,
      streak,
      summary,
      countedDaily: countsForDaily,
      missionDay: today,
      missionProgress: dailyMissionProgressSchema.parse(missionsSnap.get("progress")),
      inviter: inviterSnap?.exists ? parseStoredPlayer(inviterSnap.data()) : null,
      level: levelDefinition ? { id: levelDefinition.id, stars: starsForLevel(levelDefinition, replay.state) } : null,
    })

    // ── Ghi ──
    const row = { uid, displayName: stored.displayName, score: summary.score }
    improved.forEach((boardId, index) => {
      const ref = leaderboardRef(db, boardId)
      tx.set(ref.collection(LEADERBOARD_ENTRIES_SUBCOLLECTION).doc(uid), { ...row, updatedAt: finishedAt })
      const top = mergeScoreIntoTopList(parseLeaderboardTop(boardSnaps[index].data()), row)
      if (top) tx.set(ref, { top, updatedAt: finishedAt })
    })

    // Thách đấu đã bị xoá → vẫn ghi thống kê, bỏ phần kết quả thách đấu (không để lượt nộp lỗi mãi).
    if (challengeRefs && challengeSnap?.exists) {
      // Điểm tốt nhất của người nhận thách đấu + đếm số lượt chơi thách đấu.
      if (typeof previousChallengeScore !== "number" || summary.score > previousChallengeScore) {
        tx.set(challengeRefs.result, { displayName: stored.displayName, score: summary.score, updatedAt: finishedAt })
      }
      tx.update(challengeRefs.challenge, { attempts: FieldValue.increment(1) })
    }
    if (dailyResultRef && countsForDaily) {
      tx.set(dailyResultRef, { status: "done", score: summary.score, moveCount: summary.moveCount, gameId, finishedAt }, { merge: true })
    }
    tx.set(missionsRef, { progress: progression.missionProgress, updatedAt: finishedAt }, { merge: true })
    if (inviterRef && progression.inviterReward) {
      const { coins, addTheme, achievements } = progression.inviterReward
      tx.set(
        inviterRef,
        {
          referralCount: FieldValue.increment(1),
          coins: FieldValue.increment(coins),
          unlockedThemes: FieldValue.arrayUnion(addTheme),
          ...(achievements.length > 0 ? { achievements: FieldValue.arrayUnion(...achievements) } : {}),
        },
        { merge: true }
      )
    }
    tx.set(
      userRef,
      {
        stats,
        stashUnlocked: stored.stashUnlocked || stashEarned,
        ...(day && countsForDaily ? { streak } : {}),
        ...progression.playerFields,
        updatedAt: finishedAt,
        ...(userSnap.exists ? {} : { displayName: null, createdAt: finishedAt }),
      },
      { merge: true }
    )
    const duelState = duel && duelId ? recordDuelResultInTransaction(tx, db, duelId, duel, uid, summary.score, now.getTime()) : null
    tx.update(sessionRef, { status: "done", score: summary.score, moveCount: summary.moveCount, finishedAt })
    return { ok: true, response: { score: summary.score, stats, improvedBoards: improved, rewards: progression.rewards }, duelState }
  })

  if (!outcome.ok) throw outcome.error
  if (outcome.duelState) await mirrorDuelState(outcome.duelState)
  return outcome.response
}
