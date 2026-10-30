import { describe, expect, it } from "vitest"

import { STASH_SLOT } from "./game-types"
import { decodeAction, decodeActions, encodeAction, encodeActions } from "./recorded-action-codec"
import type { RecordedGameAction } from "./replay-recorded-game-actions"

describe("recorded action codec", () => {
  it("round-trips every action type and board edge", () => {
    const actions: RecordedGameAction[] = [
      { type: "PLACE_PIECE", slot: 0, row: 0, col: 0 },
      { type: "PLACE_PIECE", slot: 2, row: 7, col: 7 },
      { type: "PLACE_PIECE", slot: STASH_SLOT, row: -8, col: 15 },
      { type: "PLACE_PIECE", slot: 1, row: 15, col: -8 },
      { type: "STASH_PIECE", slot: 2 },
      { type: "REPLACE_TRAY" },
      { type: "REVIVE" },
    ]
    const codes = encodeActions(actions)
    expect(codes.every((code) => code >= 0 && code < 1 << 14)).toBe(true)
    expect(decodeActions(codes)).toEqual(actions)
  })

  it("rejects junk numbers", () => {
    expect(decodeAction(-1)).toBeNull()
    expect(decodeAction(1.5)).toBeNull()
    expect(decodeAction(1 << 14)).toBeNull()
    expect(decodeAction(2 | (1 << 4))).toBeNull()
    expect(decodeAction(1 | (3 << 2))).toBeNull()
    expect(decodeActions([encodeAction({ type: "REVIVE" }), "x"])).toBeNull()
  })
})
