import { describe, expect, it } from "vitest"

import type { LeaderboardRow } from "@/modules/leaderboard/leaderboard-types"

import { ALLTIME_BOARD_ID, boardIdForPeriod, boardIdsForRankedGame } from "./leaderboard-board-ids"
import { mergeScoreIntoTopList, replaceScoreInTopList, standingFromTop } from "./merge-score-into-top-list"

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
    expect(boardIdForPeriod("challenge", now)).toBe("challenge-week-2026-W44")
    expect(boardIdForPeriod("weekly", now)).toBe("weekly-2026-W44")
    expect(boardIdForPeriod("alltime", now)).toBe(ALLTIME_BOARD_ID)
    expect(boardIdForPeriod("season", now)).toBe("season-2026-10")
  })

  it("puts classic games and the first daily run on today + weekly + season + all-time; later runs only on the day board", () => {
    expect(boardIdsForRankedGame("classic", now, null, false)).toEqual(["today-20261027", "weekly-2026-W44", "season-2026-10", "alltime"])
    // Lượt daily nộp muộn (thử thách hôm qua): bảng thử thách theo ngày của thử thách, bảng "hôm nay" theo ngày nộp.
    expect(boardIdsForRankedGame("daily", now, "20261026", true)).toEqual(["daily-20261026", "today-20261027", "weekly-2026-W44", "season-2026-10", "alltime"])
    expect(boardIdsForRankedGame("daily", now, "20261027", true, false)).toEqual(["daily-20261027"])
    expect(boardIdsForRankedGame("duel", now, null, false)).toEqual([])
    expect(boardIdsForRankedGame("level", now, null, false)).toEqual([])
    expect(boardIdsForRankedGame("daily", now, "20261026", false)).toEqual([])
  })
})

describe("replaceScoreInTopList", () => {
  const top = [row("a", 900), row("b", 500), row("c", 300)]

  it("moves a player down when the value drops", () => {
    expect(replaceScoreInTopList(top, row("a", 400))?.map((item) => `${item.uid}:${item.score}`)).toEqual(["b:500", "a:400", "c:300"])
  })

  it("drops a player who falls below a full top list", () => {
    expect(replaceScoreInTopList(top, row("a", 100), 3)?.map((item) => item.uid)).toEqual(["b", "c"])
    expect(replaceScoreInTopList(top, row("z", 100), 3)).toBeNull()
  })

  it("inserts newcomers and ignores unchanged rows", () => {
    expect(replaceScoreInTopList(top, row("d", 600))?.map((item) => item.uid)).toEqual(["a", "d", "b", "c"])
    expect(replaceScoreInTopList(top, row("b", 500))).toBeNull()
  })
})
