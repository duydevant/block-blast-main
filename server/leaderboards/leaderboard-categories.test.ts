import { describe, expect, it } from "vitest"

import { EMPTY_RUN_STATS } from "@/modules/block-puzzle/engine/game-run-stats"
import type { ReplaySummary } from "@/modules/block-puzzle/engine/replay-recorded-game-actions"

import { boardIdFor, boardWritesForRankedGame, currentBoardIds, type RankedGameBoardInput } from "./leaderboard-categories"

const NOW = new Date("2026-10-29T05:00:00Z")
const summary = (overrides: Partial<ReplaySummary> = {}): ReplaySummary => ({
  score: 1200,
  moveCount: 40,
  linesCleared: 10,
  bestCombo: 6,
  boardClears: 0,
  isGameOver: true,
  stashUnlocked: false,
  runStats: { ...EMPTY_RUN_STATS, stashUses: 1 },
  ...overrides,
})
const input = (overrides: Partial<RankedGameBoardInput> = {}): RankedGameBoardInput => ({
  mode: "classic",
  now: NOW,
  day: null,
  countsForDaily: false,
  firstDailyRun: true,
  summary: summary(),
  formBefore: null,
  formAfter: null,
  levelStarsBefore: 0,
  levelStarsAfter: 0,
  ...overrides,
})
const ids = (writes: { boardId: string }[]) => writes.map((write) => write.boardId)

describe("boardWritesForRankedGame", () => {
  it("writes score boards plus combo for an assisted endless game", () => {
    expect(ids(boardWritesForRankedGame(input()))).toEqual(["today-20261029", "weekly-2026-W44", "season-2026-10", "alltime", "combo-alltime"])
  })

  it("adds pure boards for a pure game and the form board when form changes", () => {
    const writes = boardWritesForRankedGame(input({ summary: summary({ runStats: EMPTY_RUN_STATS }), formBefore: 900, formAfter: 950 }))
    expect(ids(writes)).toEqual(expect.arrayContaining(["pure-weekly-2026-W44", "pure-season-2026-10", "pure-alltime", "form-alltime", "form-season-2026-10"]))
    expect(writes.find((write) => write.boardId === "form-alltime")).toEqual({ boardId: "form-alltime", value: 950, policy: "replace" })
  })

  it("keeps logic, level and duel games off the regular boards", () => {
    expect(ids(boardWritesForRankedGame(input({ mode: "logic" })))).toEqual(["logic-weekly-2026-W44", "logic-alltime"])
    expect(ids(boardWritesForRankedGame(input({ mode: "level", levelStarsBefore: 4, levelStarsAfter: 6 })))).toEqual(["stars-alltime"])
    expect(boardWritesForRankedGame(input({ mode: "duel" }))).toEqual([])
    expect(boardWritesForRankedGame(input({ mode: "challenge" }))).toEqual([])
  })

  it("lists every current board for renames", () => {
    const boards = currentBoardIds(NOW)
    expect(boards).toContain(boardIdFor("form", "alltime", NOW))
    expect(boards).toContain("daily-20261029")
    expect(new Set(boards).size).toBe(boards.length)
  })
})
