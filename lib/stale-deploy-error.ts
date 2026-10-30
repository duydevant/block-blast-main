/** Khoá sessionStorage chống vòng lặp tải lại khi lỗi không tự hết sau một lần reload. */
const RELOAD_STAMP_KEY = "stale-deploy-reload-at"
/** Trong khoảng này đã tự reload một lần rồi → không reload nữa, hiện màn lỗi. */
const RELOAD_COOLDOWN_MS = 60_000

/**
 * Lỗi do tab đang chạy JS của bản build cũ sau khi server deploy bản mới: file chunk cũ đã bị xoá
 * nên tải chunk thất bại. Tải lại cả trang là hết (HTML mới trỏ đúng chunk mới).
 */
export function isStaleDeployError(error: unknown): boolean {
  if (!(error instanceof Error)) return false
  if (error.name === "ChunkLoadError") return true
  return /Loading (CSS )?chunk \S+ failed|Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module/i.test(
    error.message
  )
}

/** Tự reload một lần cho lỗi bản build cũ; trả false nếu vừa reload gần đây (để hiện màn lỗi thay vì lặp). */
export function reloadOnceForStaleDeploy(now = Date.now()): boolean {
  try {
    const last = Number(window.sessionStorage.getItem(RELOAD_STAMP_KEY) ?? 0)
    if (now - last < RELOAD_COOLDOWN_MS) return false
    window.sessionStorage.setItem(RELOAD_STAMP_KEY, String(now))
  } catch {
    // sessionStorage bị chặn → không ghi được dấu chống lặp, để người chơi tự bấm tải lại.
    return false
  }
  window.location.reload()
  return true
}
