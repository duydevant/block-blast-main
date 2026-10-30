import { describe, expect, it } from "vitest"

import { ARENA_LEVEL_COUNT, ARENA_TYPES, arenaPoints, findArenaLevel, MAX_ARENA_POINTS } from "./arena-catalog"
import { ARENA_SUBMIT_GRACE_MS, attemptsLeft, evaluateArenaAttempt, nextArenaRun } from "./arena-goal-rules"

const open = { status: "open" as const, attemptsUsed: 0, gamesDone: 0 }
const result = { score: 0, linesCleared: 0, bestCombo: 0, durationMs: 60_000 }

describe("arena catalog", () => {
  it("defines every type × level with rising costs, rewards and goals", () => {
    for (const type of ARENA_TYPES) {
      let previous = findArenaLevel(type, 1)!
      for (let level = 2; level <= ARENA_LEVEL_COUNT; level++) {
        const current = findArenaLevel(type, level)!
        expect(current.entryCoins).toBeGreaterThan(previous.entryCoins)
        expect(current.rewardCoins).toBeGreaterThan(current.entryCoins)
        expect(current.goal.target).toBeGreaterThanOrEqual(previous.goal.target)
        previous = current
      }
    }
    expect(findArenaLevel("speed", 0)).toBeUndefined()
    expect(findArenaLevel("nope", 1)).toBeUndefined()
  })

  it("sums the best level of each type", () => {
    expect(arenaPoints({ speed: 3, pure: 5, combo: 9 })).toBe(13)
    expect(arenaPoints(Object.fromEntries(ARENA_TYPES.map((type) => [type, 5])))).toBe(MAX_ARENA_POINTS)
  })
})

describe("arena goals", () => {
  it("checks score, lines and combo goals and the speed clock", () => {
    const speed = findArenaLevel("speed", 1)!
    expect(evaluateArenaAttempt(speed, { ...result, score: 900 }).met).toBe(true)
    expect(evaluateArenaAttempt(speed, { ...result, score: 900, durationMs: speed.attemptTimeMs! + ARENA_SUBMIT_GRACE_MS + 1 }).met).toBe(false)
    // Nộp trễ trong ân hạn nhưng nhịp chơi thực vượt đồng hồ → không đạt.
    expect(evaluateArenaAttempt(speed, { ...result, score: 900, durationMs: speed.attemptTimeMs! + 30_000, playSpanMs: speed.attemptTimeMs! + 20_000 }).met).toBe(false)
    expect(evaluateArenaAttempt(speed, { ...result, score: 900, durationMs: speed.attemptTimeMs! + 30_000, playSpanMs: speed.attemptTimeMs! - 1 }).met).toBe(true)
    expect(evaluateArenaAttempt(findArenaLevel("obstacle", 1)!, { ...result, linesCleared: 6 }).met).toBe(true)
    expect(evaluateArenaAttempt(findArenaLevel("combo", 1)!, { ...result, bestCombo: 5 }).met).toBe(false)
  })

  it("wins on success, loses after the last failed attempt", () => {
    const pure = findArenaLevel("pure", 1)!
    expect(nextArenaRun(pure, open, true, false).status).toBe("won")
    const once = nextArenaRun(pure, open, false, false)
    expect(once).toEqual({ status: "open", attemptsUsed: 1, gamesDone: 0 })
    expect(attemptsLeft(pure, once)).toBe(2)
    expect(nextArenaRun(pure, { ...open, attemptsUsed: 2 }, false, false).status).toBe("lost")
    expect(nextArenaRun(pure, open, true, true).status).toBe("expired")
  })

  it("needs consecutive successes in endurance and loses on the first miss", () => {
    const endurance = findArenaLevel("endurance", 1)!
    let run = nextArenaRun(endurance, open, true, false)
    run = nextArenaRun(endurance, run, true, false)
    expect(run).toMatchObject({ status: "open", gamesDone: 2 })
    expect(nextArenaRun(endurance, run, true, false).status).toBe("won")
    expect(nextArenaRun(endurance, run, false, false).status).toBe("lost")
  })
})
