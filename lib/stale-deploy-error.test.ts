import { describe, expect, it } from "vitest"

import { isStaleDeployError } from "./stale-deploy-error"

describe("isStaleDeployError", () => {
  it("nhận lỗi tải chunk của webpack và dynamic import", () => {
    const chunk = new Error("Loading chunk 4521 failed.\n(error: http://x/_next/static/chunks/4521-abc.js)")
    chunk.name = "ChunkLoadError"
    expect(isStaleDeployError(chunk)).toBe(true)
    expect(isStaleDeployError(new Error("Loading CSS chunk app/(main)/page failed"))).toBe(true)
    expect(isStaleDeployError(new TypeError("Failed to fetch dynamically imported module: http://x/a.js"))).toBe(true)
    expect(isStaleDeployError(new TypeError("Importing a module script failed."))).toBe(true)
  })

  it("bỏ qua lỗi thường để không che lỗi thật", () => {
    expect(isStaleDeployError(new TypeError("Cannot read properties of undefined (reading 'replace')"))).toBe(false)
    expect(isStaleDeployError("Loading chunk 1 failed")).toBe(false)
  })
})
