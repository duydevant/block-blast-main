import "server-only"

import { FieldValue, type Firestore } from "firebase-admin/firestore"

import { replayRecordedGame, type RecordedGameAction } from "@/modules/block-puzzle/engine/replay-recorded-game-actions"
import { seasonKeyFor } from "@/lib/vn-calendar"
import { NO_GAME_REWARDS, type SubmitRankedGameResponse } from "@/modules/player-profile/player-profile-types"
import { totalLevelStars } from "@/modules/progression/achievement-catalog"
import { missionBandForTier } from "@/modules/progression/daily-mission-catalog"
import { formFromRecent, tierForForm } from "@/modules/progression/player-form-rules"
import { seasonRef, writeSeasonProgress } from "@/server/seasons/season-documents"
import { findLevel, starsForLevel } from "@/modules/game-modes/level-catalog"
import { withRecentBest } from "@/modules/progression/daily-challenge-goals"
import { advanceDailyStreak } from "@/server/daily/advance-daily-streak"
import { dailyRunOutcome, readDailyRunContext, releaseDailyRun, writeDailyRunResult } from "@/server/daily/apply-daily-run-result"
import { dayKeyFor } from "@/server/daily/daily-challenge-calendar"
import { getAdminFirestore } from "@/server/firebase/firebase-admin-app"
import { HttpError } from "@/server/http/authenticated-json-route"
import { applyProgressionForVerifiedGame, referralIsDue } from "@/server/progression/apply-progression-for-verified-game"
import { parseMissionDay } from "@/server/progression/mission-day-documents"
import {
  GAME_SESSIONS_COLLECTION,
  MISSIONS_SUBCOLLECTION,
  parseStoredPlayer,
  USERS_COLLECTION,
} from "@/server/profile/stored-player-document"

import { CHALLENGE_RESULTS_SUBCOLLECTION, CHALLENGES_COLLECTION } from "@/server/challenges/challenge-documents"

import { arenaPoints } from "@/modules/game-modes/arena-catalog"
import { failArenaAttempt, readArenaContext, summarizeArenaAttempt } from "@/server/arena/apply-arena-attempt"

import { isCountedPureGame, statsForSubmission } from "./apply-verified-game-to-player-stats"
import { assessGamePlausibility } from "./assess-game-plausibility"
import { storedSessionSchema, variantForSession } from "./stored-game-session"
import { prepareBoardsAndReplay, writeBoardsAndReplay } from "./submitted-game-boards-and-replay"
import { verifiedGamePlayerUpdates } from "./verified-game-player-updates"
import { writeSubmittedSideDocuments } from "./write-submitted-side-documents"


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
 * Mọi chế độ: cộng XP/xu, nhiệm vụ ngày (theo ngày nộp), thành tích, quà mời bạn, phong độ/Bậc, lịch sử ván
 * (users/{uid}/games) và bộ đếm năm (users/{uid}/years). Bảng theo hạng mục (điểm, phong độ, thuần, combo, sao);
 * kỷ lục cá nhân / ván làm đổi top được lưu replay (gameReplays). Ván nghi bot (nhịp chơi) hoặc tài khoản bị khoá:
 * không vào bảng, không lưu replay, không nhận xu, không tính phong độ.
 */
export async function recordSubmittedRankedGame(
  uid: string,
  gameId: string,
  actions: RecordedGameAction[],
  times?: readonly number[]
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
    const arena = mode === "arena" ? await readArenaContext(tx, db, uid, session.data.arenaRunId) : null

    const replay = replayRecordedGame({ seed, stashUnlocked, variant: variantForSession(session.data) }, actions)
    const startedMs = session.data.createdAt?.toMillis() ?? now.getTime()
    // Đấu trường: lần thử không chấm được (log hỏng / 0 nước) vẫn tính là trượt → không rút lại để đổi seed.
    const failArena = () => {
      if (arena && failArenaAttempt(tx, arena, gameId, startedMs) && parseStoredPlayer(userSnap.data()).arenaRunOpen === arena.ref.id) {
        tx.set(userRef, { arenaRunOpen: null }, { merge: true })
      }
    }
    if (!replay.ok) {
      failArena()
      tx.update(sessionRef, { status: "rejected", rejectReason: replay.reason, finishedAt })
      return { ok: false, error: new HttpError(422, "replay-rejected") }
    }

    const stored = parseStoredPlayer(userSnap.data())
    const { summary } = replay
    // Ván bỏ ngang chưa đi nước nào: đóng session, không tính gì. Daily thì trả lại lượt (seed trong ngày
    // không đổi nên mở lại không có lợi gì).
    if (summary.moveCount === 0) {
      if (daily?.counts) releaseDailyRun(tx, daily, gameId)
      failArena()
      tx.update(sessionRef, { status: "abandoned", finishedAt })
      return { ok: true, response: { score: 0, stats: stored.stats, improvedBoards: [], rewards: NO_GAME_REWARDS } }
    }
    const firstDailyRun = daily?.firstRun ?? true
    const createdAtMs = session.data.createdAt?.toMillis() ?? null
    const plausibility = assessGamePlausibility({
      durationMs: createdAtMs === null ? null : now.getTime() - createdAtMs,
      moveCount: summary.moveCount,
      times: times?.length === actions.length ? times : null,
    })
    // Không được hưởng gì công khai: nghi bot hoặc tài khoản đã bị khoá.
    const flagged = plausibility.suspect || stored.banned
    // Đấu trường: chấm lần thử (giờ server), lượt thắng → xu + XP + cấp cao nhất của loại.
    const durationMs = createdAtMs === null ? 0 : now.getTime() - createdAtMs
    const playSpanMs = times && times.length === actions.length && times.length > 1 ? times[times.length - 1] - times[0] : null
    const arenaResult = summarizeArenaAttempt({ context: arena, arenaLevels: stored.arena, gameId, summary, durationMs, playSpanMs, startedMs, flagged })
    const challengeRefs = mode === "challenge" && challengeId && !flagged ? challengeResultRefs(db, challengeId, uid) : null
    const [challengeResultSnap, challengeSnap] = challengeRefs ? await tx.getAll(challengeRefs.result, challengeRefs.challenge) : []
    // Ô cất chỉ "mở vĩnh viễn" khi người chơi tự mở trong ván; ván thách đấu thừa hưởng ô cất của người thách.
    const stashEarned = summary.stashUnlocked && (mode !== "challenge" || !stashUnlocked)

    const stats = statsForSubmission(stored.stats, summary, flagged)
    const streak = day && countsForDaily ? advanceDailyStreak(stored.streak, day) : stored.streak
    // Ván bị gắn cờ vẫn đóng lượt daily (không kẹt "đang chơi") nhưng như điểm 0: không sao, không xu, không tổng tuần.
    const dailyOutcome = daily?.counts ? dailyRunOutcome(daily, flagged ? 0 : summary.score, stored.dailyBest) : null
    const missionsRef = userRef.collection(MISSIONS_SUBCOLLECTION).doc(today)
    const inviterRef = !flagged && referralIsDue(stored, summary.moveCount) && stored.referredBy ? db.collection(USERS_COLLECTION).doc(stored.referredBy) : null
    const season = seasonKeyFor(now)
    const seasonDocRef = seasonRef(db, uid, season)
    const [missionsSnap, seasonSnap, inviterSnap] = await tx.getAll(missionsRef, seasonDocRef, ...(inviterRef ? [inviterRef] : []))
    const levelDefinition = mode === "level" && levelId !== null ? findLevel(levelId) : undefined
    const missionDay = parseMissionDay(missionsSnap.data())
    const updates = verifiedGamePlayerUpdates({
      stored,
      summary,
      mode,
      countsForDaily,
      firstDailyRun,
      missionDay,
      dailyReward: dailyOutcome?.reward ?? null,
      suspect: flagged,
    })
    const progression = applyProgressionForVerifiedGame({
      stored,
      stats,
      streak,
      summary,
      countedDaily: countsForDaily,
      missionDay: today,
      missionProgress: missionDay.progress,
      mode,
      missionBand: updates.missionBand,
      missionReplacedSlot: missionDay.replacedSlot,
      tierAfter: updates.tierAfter,
      dailyStars: dailyOutcome?.reward.stars ?? 0,
      todayGames1000: updates.games1000,
      dailyThreeStarDays: updates.dailyThreeStarDays,
      flagged,
      bonusXp: arenaResult.xp,
      arenaPoints: arenaPoints(arenaResult.levels),
      inviter: inviterSnap?.exists ? parseStoredPlayer(inviterSnap.data()) : null,
      level: levelDefinition ? { id: levelDefinition.id, stars: starsForLevel(levelDefinition, replay.state) } : null,
    })

    const boardsInput = {
      uid,
      gameId,
      stored,
      session: { mode, seed, stashUnlocked, levelId, day },
      now,
      countsForDaily,
      firstDailyRun,
      summary,
      actions,
      recentFormScores: updates.recentFormScores,
      tierAfter: updates.tierAfter,
      levelStarsAfter: progression.playerFields.levelStars,
      flagged,
    }
    const boards = await prepareBoardsAndReplay(tx, db, boardsInput)

    // ── Ghi ──
    const replayFields = writeBoardsAndReplay(tx, db, boardsInput, boards, finishedAt)
    if (arena && arenaResult.outcome && Object.keys(arenaResult.outcome.runPatch).length > 0) tx.update(arena.ref, arenaResult.outcome.runPatch)
    // Mùa giải: ván bị gắn cờ không tính (số ván, Bậc cao nhất, nhiệm vụ mùa).
    if (!flagged) {
      writeSeasonProgress(tx, {
        ref: seasonDocRef,
        snap: seasonSnap,
        season,
        bandIfNew: missionBandForTier(tierForForm(formFromRecent(stored.recentFormScores))),
        stamp: finishedAt,
        game: {
          linesCleared: summary.linesCleared,
          firstDailyRun: mode === "daily" && countsForDaily && firstDailyRun,
          tierAfter: updates.tierAfter,
          levelStarsGained: totalLevelStars(progression.playerFields.levelStars) - totalLevelStars(stored.levelStars),
          pureScore: isCountedPureGame(summary) ? summary.score : 0,
          isDuel: mode === "duel",
          arenaWon: arenaResult.won,
        },
      })
    }
    writeSubmittedSideDocuments(tx, {
      userRef,
      gameId,
      mode,
      summary,
      levelId,
      day,
      today,
      stamp: finishedAt,
      nowMs: now.getTime(),
      firstGameToday: updates.firstGameToday,
      missionsRef,
      missions: { progress: progression.missionProgress, band: updates.missionBand, gamesToday: updates.gamesToday, games1000: updates.games1000 },
      inviter: inviterRef && progression.inviterReward ? { ref: inviterRef, reward: progression.inviterReward } : null,
      // Thách đấu đã bị xoá → vẫn ghi thống kê, bỏ phần kết quả thách đấu (không để lượt nộp lỗi mãi).
      challenge:
        challengeRefs && challengeSnap?.exists
          ? { challengeRef: challengeRefs.challenge, resultRef: challengeRefs.result, previousScore: challengeResultSnap?.get("score"), displayName: stored.displayName }
          : null,
    })
    if (daily && dailyOutcome) {
      writeDailyRunResult(tx, daily, dailyOutcome, { uid, displayName: stored.displayName, gameId, moveCount: summary.moveCount, stamp: finishedAt })
    }
    // Xu mốc thử thách cộng chung với xu của ván (nhiệm vụ, thành tích…).
    const dailyCoins = dailyOutcome?.reward.coins ?? 0
    tx.set(
      userRef,
      {
        stats,
        statsByMode: updates.statsByMode,
        recentFormScores: updates.recentFormScores,
        dailyThreeStarDays: updates.dailyThreeStarDays,
        stashUnlocked: stored.stashUnlocked || stashEarned,
        ...(day && countsForDaily ? { streak } : {}),
        ...progression.playerFields,
        ...replayFields,
        // Bị gắn cờ: không nhận xu của ván này (XP / thống kê vẫn cộng để người thật bị nhầm không mất tiến trình).
        coins: flagged ? stored.coins : progression.playerFields.coins + dailyCoins + arenaResult.coins,
        ...(arena
          ? { arena: arenaResult.levels, ...(arenaResult.outcome?.closed && stored.arenaRunOpen === arena.ref.id ? { arenaRunOpen: null } : {}) }
          : {}),
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
    tx.update(sessionRef, {
      status: "done",
      score: summary.score,
      moveCount: summary.moveCount,
      finishedAt,
      ...(plausibility.suspect ? { suspect: true, suspectReason: plausibility.reason } : {}),
      ...(boards.replay.store ? { replayId: gameId } : {}),
    })
    const rewards = {
      ...progression.rewards,
      coins: flagged ? 0 : progression.rewards.coins + dailyCoins + arenaResult.coins,
      arena: arenaResult.outcome?.reward ?? null,
      daily: dailyOutcome?.reward ?? null,
      flagged,
      replayId: boards.replay.store ? gameId : null,
    }
    return { ok: true, response: { score: summary.score, stats, improvedBoards: boards.updates.map((update) => update.boardId), rewards } }
  })

  if (!outcome.ok) throw outcome.error
  return outcome.response
}
