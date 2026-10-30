import type { RecordedGameAction } from "./replay-recorded-game-actions"

/**
 * Nước đi trong log của client kèm thời điểm (epoch ms, `t`). Thời gian chỉ dùng để server phát hiện nhịp chơi
 * bất thường (bot) và phát lại replay theo nhịp thật — KHÔNG bao giờ ảnh hưởng điểm. Schema replay/nộp ván bỏ `t`.
 */
export type TimedRecordedAction = RecordedGameAction & { t?: number }

export function withActionTime(action: RecordedGameAction, now = Date.now()): RecordedGameAction {
  return { ...action, t: now } as TimedRecordedAction
}

/** Bỏ `t` (VD trước khi ghi nước đấu lên RTDB — rules từ chối field lạ). */
export function withoutActionTime(action: RecordedGameAction): RecordedGameAction {
  const { t, ...rest } = action as TimedRecordedAction
  void t
  return rest as RecordedGameAction
}

/** Mảng thời điểm của cả log; null nếu thiếu ở bất kỳ nước nào (save cũ, tải lại trang). */
export function actionTimesOf(actions: readonly RecordedGameAction[]): number[] | null {
  const times: number[] = []
  for (const action of actions) {
    const t = (action as TimedRecordedAction).t
    if (typeof t !== "number" || !Number.isFinite(t)) return null
    times.push(Math.round(t))
  }
  return times
}
