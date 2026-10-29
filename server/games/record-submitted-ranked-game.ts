import "server-only"

import { FieldValue, type Firestore } from "firebase-admin/firestore"

import { replayRecordedGame, type RecordedGameAction } from "@/modules/block-puzzle/engine/replay-recorded-game-actions"
import { NO_GAME_REWARDS, type SubmitRankedGameResponse } from "@/modules/player-profile/player-profile-types"
import { findLevel, starsForLevel } from "@/modules/game-modes/level-catalog"
import { withRecentBest } from "@/modules/progression/daily-challenge-goals"
import { dailyMissionProgressSchema } from "@/modules/progression/daily-mission-catalog"
import { advanceDailyStreak } from "@/server/daily/advance-daily-streak"
import { dailyRunOutcome, readDailyRunContext, releaseDailyRun, writeDailyRunResult } from "@/server/daily/apply-daily-run-result"
import { dayKeyFor } from "@/server/daily/daily-challenge-calendar"
import { getAdminFirestore } from "@/server/firebase/firebase-admin-app"
import { HttpError } from "@/server/http/authenticated-json-route"
import { boardIdsForRankedGame } from "@/server/leaderboards/leaderboard-board-ids"
import { leaderboardRef, parseLeaderboardTop } from "@/server/leaderboards/leaderboard-documents"
import { mergeScoreIntoTopList } from "@/server/leaderboards/merge-score-into-top-list"
import { applyProgressionForVerifiedGame, referralIsDue } from "@/server/progression/apply-progression-for-verified-game"
import {
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
  | { ok: true; response: SubmitRankedGameResponse }
  | { ok: false; error: HttpError }

/**
 * Replay ván rồi ghi kết quả trong một transaction: thống kê, streak + kết quả daily, bảng xếp hạng.
 * Mỗi session chỉ nộp được một lần; log sai → session `rejected` và 422.
 * Daily: lượt đã giữ chỗ lúc bắt đầu (tối đa 3/ngày) và nộp chậm nhất hết ngày hôm sau mới tính mốc + xu, bảng ngày,
 * tổng tuần, streak (`apply-daily-run-result`); chỉ lượt đầu vào bảng Hôm nay / Tuần / Mọi lúc. Lượt khác cộng thống kê.
 * Challenge: không vào bảng xếp hạng, chỉ ghi điểm tốt nhất vào challenges/{id}/results/{uid}.
 * Duel: chỉ cộng thống kê/thưởng; kết quả trận do server chấm từ nước đi trên RTDB (settle-duel-round).
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
    const { mode, day, seed, stashUnlocked, challengeId, levelId } = session.data
    // Sự kiện tuần đã bỏ: không replay như ván thường (thiếu luật của tuần → điểm sai).
    if (mode === "event") {
      tx.update(sessionRef, { status: "rejected", rejectReason: "mode-retired", finishedAt })
      return { ok: false, error: new HttpError(422, "replay-rejected") }
    }
    const daily = mode === "daily" && day ? await readDailyRunContext(tx, db, { uid, gameId, dayKey: day, today, now }) : null
    const countsForDaily = daily?.counts ?? false

    const replay = replayRecordedGame({ seed, stashUnlocked, variant: variantForSession(session.data) }, actions)
    if (!replay.ok) {
      tx.update(sessionRef, { status: "rejected", rejectReason: replay.reason, finishedAt })
      return { ok: false, error: new HttpError(422, "replay-rejected") }
    }

    const stored = parseStoredPlayer(userSnap.data())
    const { summary } = replay
    // Ván bỏ ngang chưa đi nước nào: đóng session, không tính gì. Daily thì trả lại lượt (seed trong ngày
    // không đổi nên mở lại không có lợi gì).
    if (summary.moveCount === 0) {
      if (daily?.counts) releaseDailyRun(tx, daily, gameId)
      tx.update(sessionRef, { status: "abandoned", finishedAt })
      return { ok: true, response: { score: 0, stats: stored.stats, improvedBoards: [], rewards: NO_GAME_REWARDS } }
    }
    const boardIds = boardIdsForRankedGame(mode, now, day, countsForDaily, daily?.firstRun ?? true)
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
    const dailyOutcome = daily?.counts ? dailyRunOutcome(daily, summary.score, stored.dailyBest) : null
    const missionsRef = userRef.collection(MISSIONS_SUBCOLLECTION).doc(today)
    const inviterRef = referralIsDue(stored, summary.moveCount) && stored.referredBy ? db.collection(USERS_COLLECTION).doc(stored.referredBy) : null
    const [missionsSnap, inviterSnap] = await tx.getAll(missionsRef, ...(inviterRef ? [inviterRef] : []))
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
    if (daily && dailyOutcome) {
      writeDailyRunResult(tx, daily, dailyOutcome, { uid, displayName: stored.displayName, gameId, moveCount: summary.moveCount, stamp: finishedAt })
    }
    // Xu mốc thử thách cộng chung với xu của ván (nhiệm vụ, thành tích…).
    const dailyCoins = dailyOutcome?.reward.coins ?? 0
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
        coins: progression.playerFields.coins + dailyCoins,
        ...(dailyOutcome ? { dailyBest: dailyOutcome.dailyBest } : {}),
        updatedAt: finishedAt,
        ...(userSnap.exists ? {} : { displayName: null, createdAt: finishedAt }),
      },
      { merge: true }
    )
    // Điểm ngày cho phong độ các ngày sau; thay nguyên map (merge sâu sẽ giữ lại ngày cũ đã bỏ).
    // Người chơi cũ chưa chuyển (dailyRecent thiếu) → để lượt bắt đầu sau đọc lịch sử đầy đủ, không ghi map 1 ngày.
    if (day && dailyOutcome && stored.dailyRecent) {
      tx.set(userRef, { dailyRecent: withRecentBest(stored.dailyRecent, day, dailyOutcome.dayBest) }, { mergeFields: ["dailyRecent"] })
    }
    tx.update(sessionRef, { status: "done", score: summary.score, moveCount: summary.moveCount, finishedAt })
    const rewards = { ...progression.rewards, coins: progression.rewards.coins + dailyCoins, daily: dailyOutcome?.reward ?? null }
    return { ok: true, response: { score: summary.score, stats, improvedBoards: improved, rewards } }
  })

  if (!outcome.ok) throw outcome.error
  return outcome.response
}
