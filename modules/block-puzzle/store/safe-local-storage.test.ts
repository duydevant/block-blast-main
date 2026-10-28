import { describe, expect, it } from "vitest"

import { safeLocalStorage } from "./safe-local-storage"

describe("safeLocalStorage without window.localStorage (node)", () => {
  it("falls back to memory instead of throwing", () => {
    expect(safeLocalStorage.getItem("block-puzzle.test")).toBeNull()
    safeLocalStorage.setItem("block-puzzle.test", "1")
    expect(safeLocalStorage.getItem("block-puzzle.test")).toBe("1")
    safeLocalStorage.removeItem("block-puzzle.test")
    expect(safeLocalStorage.getItem("block-puzzle.test")).toBeNull()
  })
})
