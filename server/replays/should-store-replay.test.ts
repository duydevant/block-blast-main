import { describe, expect, it } from "vitest"

import { decideReplayStorage, isAllTimeBoard } from "./should-store-replay"

const base = { moveCount: 40, score: 1000, previousBestScore: 2000, topChangedBoards: [] as string[] }

describe("decideReplayStorage", () => {
  it("skips ordinary games", () => {
    expect(decideReplayStorage(base).store).toBe(false)
  })

  it("keeps personal bests forever", () => {
    expect(decideReplayStorage({ ...base, score: 2500 })).toEqual({ store: true, permanent: true, pinnedByBoard: false, personalBest: true })
  })

  it("keeps games that change a top list, permanently only for all-time boards", () => {
    expect(decideReplayStorage({ ...base, topChangedBoards: ["today-20261029"] })).toEqual({ store: true, permanent: false, pinnedByBoard: false, personalBest: false })
    expect(decideReplayStorage({ ...base, topChangedBoards: ["combo-alltime"] })).toMatchObject({ permanent: true, pinnedByBoard: true })
  })

  it("never stores empty or suspect games", () => {
    expect(decideReplayStorage({ ...base, score: 9000, moveCount: 0 }).store).toBe(false)
    expect(decideReplayStorage({ ...base, score: 9000, suspect: true }).store).toBe(false)
  })

  it("recognises all-time boards", () => {
    expect(isAllTimeBoard("alltime")).toBe(true)
    expect(isAllTimeBoard("pure-alltime")).toBe(true)
    expect(isAllTimeBoard("weekly-2026-W44")).toBe(false)
  })
})
