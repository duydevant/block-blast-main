import { describe, expect, it } from "vitest"

import { findFullLines } from "@/modules/block-puzzle/engine/board-grid-operations"
import { gameReducer } from "@/modules/block-puzzle/engine/game-state-reducer"
import { createRankedGameStartState, replayRecordedGame } from "@/modules/block-puzzle/engine/replay-recorded-game-actions"

import { findLesson, LESSONS } from "./lesson-catalog"
import { lessonGoalProgress, lessonStart, lessonStatus, nextLessonHint, parseLessonBoard, verifyLessonActions } from "./lesson-rules"

describe("lesson catalog", () => {
  it("has 12 lessons with unique slugs and valid 8x8 boards without full lines", () => {
    expect(LESSONS).toHaveLength(12)
    expect(new Set(LESSONS.map((lesson) => lesson.slug)).size).toBe(12)
    for (const lesson of LESSONS) {
      expect(lesson.board).toHaveLength(8)
      expect(lesson.board.every((row) => row.length === 8)).toBe(true)
      const lines = findFullLines(parseLessonBoard(lesson.board))
      expect(lines.rows.length + lines.cols.length).toBe(0)
    }
  })

  it.each(LESSONS.map((lesson, index) => [lesson.slug, index] as const))("solves %s with the reference solution", (_slug, index) => {
    const lesson = LESSONS[index]
    const replay = replayRecordedGame(lessonStart(lesson, index), lesson.solution)
    expect(replay.ok).toBe(true)
    if (!replay.ok) return
    expect(lessonGoalProgress(lesson, replay.state)).toBeGreaterThanOrEqual(lesson.goal.target)
    expect(lessonStatus(lesson, replay.state)).toBe("complete")
    expect(verifyLessonActions(lesson, index, lesson.solution)).toBe(true)
  })

  it("rejects incomplete or wrong attempts", () => {
    const { lesson, index } = findLesson("avoid-holes")!
    // Đặt khối L lệch → để lại ô kín, khối thứ hai không lấp được → không đạt mục tiêu.
    expect(verifyLessonActions(lesson, index, [{ type: "PLACE_PIECE", slot: 0, row: 6, col: 1 }])).toBe(false)
    expect(verifyLessonActions(lesson, index, [])).toBe(false)
  })

  it("deals the same fixed trays (with the same colours) every time", () => {
    const { lesson, index } = findLesson("keep-the-combo")!
    const a = createRankedGameStartState(lessonStart(lesson, index))
    const b = createRankedGameStartState(lessonStart(lesson, index))
    expect(a.tray).toEqual(b.tray)
    expect(a.tray.map((piece) => piece?.shapeId ?? null)).toEqual(["line2-r0", "dot", "line2-r0"])
    expect(a.fixedTrays).toEqual([["line2-r0"]])
    let state = a
    for (const action of lesson.solution.slice(0, 3)) state = gameReducer(state, action)
    expect(state.tray.map((piece) => piece?.shapeId ?? null)).toEqual(["line2-r0", null, null])
    expect(state.fixedTrays).toEqual([])
  })

  it("only hints while the player follows the reference solution", () => {
    const { lesson } = findLesson("keep-the-combo")!
    expect(nextLessonHint(lesson, [])).toEqual(lesson.solution[0])
    expect(nextLessonHint(lesson, [lesson.solution[0]])).toEqual(lesson.solution[1])
    expect(nextLessonHint(lesson, [{ type: "PLACE_PIECE", slot: 1, row: 3, col: 3 }])).toBeNull()
  })
})
