import { describe, expect, it } from "vitest"

import { relatedLessonSlugs } from "./components/related-lesson-links"

describe("relatedLessonSlugs", () => {
  it("suggests the holes lesson and the full-board lesson from the analysis", () => {
    const full = Array.from({ length: 64 }, (_, index) => (index < 50 ? 3 : 0))
    expect(relatedLessonSlugs({ holesCreated: 0, finalBoard: null })).toEqual([])
    expect(relatedLessonSlugs({ holesCreated: 2, finalBoard: null })).toEqual(["avoid-holes"])
    expect(relatedLessonSlugs({ holesCreated: 0, finalBoard: full })).toEqual(["rescue-a-full-board"])
    expect(relatedLessonSlugs({ holesCreated: 0, finalBoard: Array(64).fill(0) })).toEqual([])
  })
})
