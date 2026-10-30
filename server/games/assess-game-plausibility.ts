/**
 * Replay chứng minh nước đi HỢP LỆ, không chứng minh NGƯỜI chơi. Đánh giá nhịp chơi để gắn cờ ván nghi bot:
 * ván bị gắn cờ không vào BXH, không lưu replay công khai, không được xu (vẫn cộng XP/thống kê để người thật
 * bị nhầm không mất tiến trình). Ngưỡng bảo thủ — chỉnh sau khi xem log `suspectReason`.
 */
export const PLAUSIBILITY_RULES = {
  /** Ván ngắn hơn thế này không đánh giá (ít dữ liệu, ít giá trị). */
  minMovesToAssess: 20,
  /** Thời gian session (từ lúc cấp seed tới lúc nộp) chia số nước nhỏ hơn mức này = quá nhanh. */
  minMsPerMove: 250,
  /** Cần ít nhất bấy nhiêu khoảng giữa các nước có thời điểm mới xét nhịp. */
  minGapsForTiming: 50,
  /** Khoảng > mức này coi là nghỉ, bỏ khỏi thống kê nhịp. */
  pauseGapMs: 30_000,
  /** Hệ số biến thiên khoảng cách giữa các nước nhỏ hơn mức này = đều như máy. */
  minGapVariation: 0.15,
  /** Khoảng < mức này coi là "siêu nhanh"; quá tỉ lệ bên dưới = không giống người. */
  inhumanGapMs: 120,
  maxInhumanShare: 0.3,
} as const

export type SuspectReason = "too-fast" | "uniform-timing" | "inhuman-speed"

export interface PlausibilityResult {
  suspect: boolean
  reason: SuspectReason | null
}

const OK: PlausibilityResult = { suspect: false, reason: null }

/** `times` = thời điểm từng nước (epoch ms) do client gửi; thiếu / không tăng dần → bỏ qua phần nhịp. */
export function assessGamePlausibility(input: { durationMs: number | null; moveCount: number; times?: readonly number[] | null }): PlausibilityResult {
  const rules = PLAUSIBILITY_RULES
  if (input.moveCount < rules.minMovesToAssess) return OK
  if (input.durationMs !== null && input.durationMs >= 0 && input.durationMs / input.moveCount < rules.minMsPerMove) {
    return { suspect: true, reason: "too-fast" }
  }

  const times = input.times
  if (!times || times.length < 2) return OK
  const gaps: number[] = []
  for (let index = 1; index < times.length; index++) {
    const gap = times[index] - times[index - 1]
    if (gap < 0) return OK
    if (gap <= rules.pauseGapMs) gaps.push(gap)
  }
  if (gaps.length < rules.minGapsForTiming) return OK

  const inhumanShare = gaps.filter((gap) => gap < rules.inhumanGapMs).length / gaps.length
  if (inhumanShare > rules.maxInhumanShare) return { suspect: true, reason: "inhuman-speed" }
  const mean = gaps.reduce((sum, gap) => sum + gap, 0) / gaps.length
  const variance = gaps.reduce((sum, gap) => sum + (gap - mean) ** 2, 0) / gaps.length
  if (mean > 0 && Math.sqrt(variance) / mean < rules.minGapVariation) return { suspect: true, reason: "uniform-timing" }
  return OK
}
