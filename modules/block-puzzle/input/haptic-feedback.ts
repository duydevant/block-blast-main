/** Rung nhẹ trên thiết bị hỗ trợ; iOS Safari không có navigator.vibrate nên tự bỏ qua. */
export function vibrate(pattern: number | number[]) {
  try {
    if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") navigator.vibrate(pattern)
  } catch {}
}

export function prefersReducedMotion(): boolean {
  return typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true
}
