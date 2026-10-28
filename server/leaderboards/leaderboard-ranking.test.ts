import { describe, expect, it } from "vitest"

import type { LeaderboardRow } from "@/modules/leaderboard/leaderboard-types"

import { ALLTIME_BOARD_ID, boardIdForPeriod, boardIdsForRankedGame } from "./leaderboard-board-ids"
import { mergeScoreIntoTopList, standingFromTop } from "./merge-score-into-top-list"

const row = (uid: string, score: number): LeaderboardRow => ({ uid, displayName: null, score })

describe("mergeScoreIntoTopList", () => {
  const top = [row("a", 900), row("b", 500), row("c", 500), row("d", 100)]

  it("inserts in descending order, below existing equal scores", () => {
    expect(mergeScoreIntoTopList(top, row("e", 500))?.map((item) => item.uid)).toEqual(["a", "b", "c", "e", "d"])
  })

  it("moves an improved player and keeps one row per uid", () => {
    expect(mergeScoreIntoTopList(top, row("d", 950))?.map((item) => item.uid)).toEqual(["d", "a", "b", "c"])
  })

  it("returns null when nothing changes", () => {
    expect(mergeScoreIntoTopList(top, row("a", 800))).toBeNull()
    expect(mergeScoreIntoTopList(top, row("z", 50), 4)).toBeNull()
  })

  it("trims to the configured size", () => {
    expect(mergeScoreIntoTopList(top, row("z", 600), 4)?.map((item) => item.uid)).toEqual(["a", "z", "b", "c"])
  })
})

describe("standingFromTop", () => {
  const top = [row("a", 900), row("b", 500), row("c", 500), row("d", 100)]

  it("shares rank on ties and points at the next score to beat", () => {
    expect(standingFromTop(top, 500)).toEqual({ score: 500, rank: 2, nextScore: 900 })
    expect(standingFromTop(top, 100)).toEqual({ score: 100, rank: 4, nextScore: 500 })
    expect(standingFromTop(top, 900)).toEqual({ score: 900, rank: 1, nextScore: null })
  })
})

describe("board ids", () => {
  const now = new Date("2026-10-27T03:00:00Z")

  it("maps periods to the current boards", () => {
    expect(boardIdForPeriod("today", now)).toBe("today-20261027")
    expect(boardIdForPeriod("daily", now)).toBe("daily-20261027")
    expect(boardIdForPeriod("event", now)).toBe("event-2026-W44")
    expect(boardIdForPeriod("weekly", now)).toBe("weekly-2026-W44")
    expect(boardIdForPeriod("alltime", now)).toBe(ALLTIME_BOARD_ID)
  })

  it("puts classic games and counted daily runs on today + weekly + all-time; practice daily runs nowhere", () => {
    // Vô tận còn tính cho sự kiện tuần này.
    expect(boardIdsForRankedGame("classic", now, null, false)).toEqual(["today-20261027", "weekly-2026-W44", "alltime", "event-2026-W44"])
    // Lượt daily nộp muộn (thử thách hôm qua): bảng thử thách theo ngày của thử thách, bảng "hôm nay" theo ngày nộp.
    expect(boardIdsForRankedGame("daily", now, "20261026", true)).toEqual(["daily-20261026", "today-20261027", "weekly-2026-W44", "alltime"])
    expect(boardIdsForRankedGame("event", now, null, false, "2026-W44")).toEqual(["event-2026-W44"])
    expect(boardIdsForRankedGame("level", now, null, false)).toEqual([])
    expect(boardIdsForRankedGame("daily", now, "20261026", false)).toEqual([])
  })
})
