import { isPureRun } from "@/modules/block-puzzle/engine/game-run-stats"
import type { ReplaySummary } from "@/modules/block-puzzle/engine/replay-recorded-game-actions"
import { CATEGORY_PERIODS, LEADERBOARD_CATEGORIES, type LeaderboardCategory } from "@/modules/leaderboard/leaderboard-categories"
import type { LeaderboardPeriod } from "@/modules/leaderboard/leaderboard-types"
import type { RankedGameMode } from "@/modules/player-profile/player-profile-types"
import { isQualifyingGame } from "@/modules/progression/player-level-curve"
import { seasonKeyFor } from "@/lib/vn-calendar"
import { rankedSeasonKeyFor } from "@/modules/ranked/rating-rules"
import { isoWeekKeyFor } from "@/server/daily/daily-challenge-calendar"

import { ALLTIME_BOARD_ID, boardIdForPeriod, boardIdsForRankedGame } from "./leaderboard-board-ids"

/** "max" = giữ giá trị cao nhất (điểm, combo…); "replace" = ghi đè, giảm được (phong độ). */
export type BoardPolicy = "max" | "replace"

export interface BoardWrite {
  boardId: string
  value: number
  policy: BoardPolicy
}

/**
 * Id bảng hiện hành của một hạng mục + kỳ: score giữ id cũ; hạng mục khác `${category}-alltime`,
 * `${category}-weekly-YYYY-Www`, `${category}-season-YYYY-MM`.
 */
export function boardIdFor(category: LeaderboardCategory, period: LeaderboardPeriod, now: Date): string {
  if (category === "score") return boardIdForPeriod(period, now)
  if (category === "ranked") return `ranked-lp-${rankedSeasonKeyFor(now)}`
  if (period === "weekly") return `${category}-weekly-${isoWeekKeyFor(now)}`
  if (period === "season") return `${category}-season-${seasonKeyFor(now)}`
  return `${category}-${ALLTIME_BOARD_ID}`
}

/** Mọi bảng hiện hành (đổi tên người chơi cập nhật hết). */
export function currentBoardIds(now: Date): string[] {
  return LEADERBOARD_CATEGORIES.flatMap((category) => CATEGORY_PERIODS[category].map((period) => boardIdFor(category, period, now)))
}

export interface RankedGameBoardInput {
  mode: RankedGameMode
  now: Date
  day: string | null
  countsForDaily: boolean
  firstDailyRun: boolean
  summary: ReplaySummary
  /** Phong độ trước / sau ván (null = chưa đủ ván). */
  formBefore: number | null
  formAfter: number | null
  /** Tổng sao màn trước / sau ván. */
  levelStarsBefore: number
  levelStarsAfter: number
  /** LP sau trận xếp hạng (null = chưa xong trận xếp hạng / không phải trận xếp hạng). */
  rankedLp?: number | null
}

/**
 * Các bảng một ván đã replay được ghi vào. Bảng điểm như cũ (`boardIdsForRankedGame`); các hạng mục khác chỉ
 * tính cùng tập ván với bảng Mọi lúc (Vô tận + lượt đầu thử thách ngày), riêng Sao màn tính ván màn chơi.
 */
export function boardWritesForRankedGame(input: RankedGameBoardInput): BoardWrite[] {
  const { mode, now, summary } = input
  const writes: BoardWrite[] = boardIdsForRankedGame(mode, now, input.day, input.countsForDaily, input.firstDailyRun).map((boardId) => ({
    boardId,
    value: summary.score,
    policy: "max",
  }))
  const scoreSet = mode === "classic" || (mode === "daily" && input.countsForDaily && input.firstDailyRun)
  if (scoreSet && summary.moveCount > 0) {
    if (input.formAfter !== null && input.formAfter !== input.formBefore) {
      for (const period of CATEGORY_PERIODS.form) writes.push({ boardId: boardIdFor("form", period, now), value: input.formAfter, policy: "replace" })
    }
    if (isPureRun(summary.runStats) && isQualifyingGame(summary.moveCount)) {
      for (const period of CATEGORY_PERIODS.pure) writes.push({ boardId: boardIdFor("pure", period, now), value: summary.score, policy: "max" })
    }
    if (summary.bestCombo > 0) writes.push({ boardId: boardIdFor("combo", "alltime", now), value: summary.bestCombo, policy: "max" })
  }
  if (mode === "logic") {
    for (const period of CATEGORY_PERIODS.logic) writes.push({ boardId: boardIdFor("logic", period, now), value: summary.score, policy: "max" })
  }
  if (mode === "ranked" && input.rankedLp != null) {
    writes.push({ boardId: boardIdFor("ranked", "alltime", now), value: input.rankedLp, policy: "replace" })
  }
  if (mode === "level" && input.levelStarsAfter > input.levelStarsBefore) {
    writes.push({ boardId: boardIdFor("stars", "alltime", now), value: input.levelStarsAfter, policy: "max" })
  }
  return writes
}
