import type { LeaderboardRow } from "@/modules/leaderboard/leaderboard-types"
import { totalLevelStars } from "@/modules/progression/achievement-catalog"
import { FORM_WINDOW, formFromRecent, tierForForm } from "@/modules/progression/player-form-rules"
import type { StoredPlayer } from "@/server/profile/stored-player-document"

/**
 * Điền sẵn bảng Phong độ + Sao màn từ dữ liệu có từ trước Phase 01/02 (thuần, không I/O — script
 * `scripts/backfill-form-and-stars-leaderboards.ts` đọc Firestore rồi gọi hàm này).
 * - Phong độ: session ván đã nộp còn trong `gameSessions` (TTL 30 ngày) cùng tập với bảng Mọi lúc (Vô tận + lượt đầu
 *   thử thách ngày), bỏ ván đã có trong lịch sử mới (đã nằm trong `recentFormScores`) và ván bị gắn cờ.
 * - Sao: tổng `levelStars` trong doc người chơi.
 */

/** Session đã nộp (chỉ các field cần). */
export interface BackfillSession {
  gameId: string
  uid: string
  mode: string
  score: number
  moveCount: number
  /** Epoch ms lúc nộp. */
  finishedAt: number
  /** Thứ tự lượt thử thách trong ngày (0 = lượt đầu). */
  dailyRun: number
  suspect: boolean
}

export interface BackfillPlayer {
  uid: string
  stored: StoredPlayer
}

export interface FormAndStarsBackfillPlan {
  /** Điểm cũ (cũ → mới) cần gộp vào trước recentFormScores, kèm kết quả gộp với giá trị lúc đọc. */
  formScores: { uid: string; oldScores: number[]; recentFormScores: number[] }[]
  /** Hàng bảng `form-alltime` (người chơi đủ ván). */
  formRows: LeaderboardRow[]
  /** Hàng bảng `stars-alltime`. */
  starsRows: LeaderboardRow[]
}

/** Ván cũ có tính phong độ không (giống `countsTowardForm` + loại ván bị gắn cờ). */
export function isFormSession(session: BackfillSession): boolean {
  if (session.suspect || session.moveCount < 1) return false
  return session.mode === "classic" || (session.mode === "daily" && session.dailyRun === 0)
}

function rowFor(player: BackfillPlayer, value: number, form: number | null): LeaderboardRow {
  const tier = tierForForm(form)
  return {
    uid: player.uid,
    displayName: player.stored.displayName,
    score: value,
    ...(tier !== "unranked" ? { tier } : {}),
    ...(player.stored.referralCode ? { tag: player.stored.referralCode } : {}),
  }
}

export function planFormAndStarsBackfill(input: {
  players: readonly BackfillPlayer[]
  sessions: readonly BackfillSession[]
  /** gameId đã có doc lịch sử mới (users/{uid}/games) → điểm đã nằm trong recentFormScores. */
  historyGameIds: ReadonlySet<string>
}): FormAndStarsBackfillPlan {
  const oldScoresByUid = new Map<string, BackfillSession[]>()
  for (const session of input.sessions) {
    if (!isFormSession(session) || input.historyGameIds.has(session.gameId)) continue
    const list = oldScoresByUid.get(session.uid) ?? []
    list.push(session)
    oldScoresByUid.set(session.uid, list)
  }

  const plan: FormAndStarsBackfillPlan = { formScores: [], formRows: [], starsRows: [] }
  for (const player of input.players) {
    if (player.stored.banned) continue
    const old = (oldScoresByUid.get(player.uid) ?? []).sort((a, b) => a.finishedAt - b.finishedAt).map((session) => session.score)
    // Điểm cũ đứng trước điểm đã ghi sau deploy (mới hơn), giữ FORM_WINDOW ván cuối.
    const recentFormScores = [...old, ...player.stored.recentFormScores].slice(-FORM_WINDOW)
    if (old.length > 0) plan.formScores.push({ uid: player.uid, oldScores: old, recentFormScores })
    const form = formFromRecent(recentFormScores)
    if (form !== null) plan.formRows.push(rowFor(player, form, form))
    const stars = totalLevelStars(player.stored.levelStars)
    if (stars > 0) plan.starsRows.push(rowFor(player, stars, form))
  }
  return plan
}
