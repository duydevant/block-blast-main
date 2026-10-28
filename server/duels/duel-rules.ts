import { DUEL_SUBMIT_GRACE_MS, DUEL_WAITING_TTL_MS, type DuelStatus } from "@/modules/duel/duel-types"

/** Phần trạng thái trận cần cho luật (thuần, test được). */
export interface DuelRuleState {
  status: DuelStatus
  hostUid: string
  guestUid: string | null
  createdAtMs: number
  endsAt: number | null
  results: Record<string, number>
}

/** Phòng chờ quá lâu không ai vào → hết hạn (hiển thị + chặn vào). */
export function effectiveDuelStatus(duel: DuelRuleState, now: number): DuelStatus {
  return duel.status === "waiting" && now > duel.createdAtMs + DUEL_WAITING_TTL_MS ? "expired" : duel.status
}

/** Còn nhận ván nộp không: đang đấu và chưa quá hạn chót + ân hạn. */
export function acceptsDuelSubmission(duel: DuelRuleState, now: number): boolean {
  return duel.status === "playing" && duel.endsAt !== null && now <= duel.endsAt + DUEL_SUBMIT_GRACE_MS
}

/** Hết hạn nộp mà trận chưa xong (một/cả hai không nộp) → chốt bằng điểm đang có. */
export function isDuelOverdue(duel: DuelRuleState, now: number): boolean {
  return duel.status === "playing" && duel.endsAt !== null && now > duel.endsAt + DUEL_SUBMIT_GRACE_MS
}

/** Người thắng: điểm cao hơn; không nộp = thua; bằng điểm hoặc cả hai không nộp = hoà (null). */
export function duelWinner(duel: Pick<DuelRuleState, "hostUid" | "guestUid" | "results">): string | null {
  if (!duel.guestUid) return null
  const host = duel.results[duel.hostUid]
  const guest = duel.results[duel.guestUid]
  if (host === undefined && guest === undefined) return null
  if (guest === undefined) return duel.hostUid
  if (host === undefined) return duel.guestUid
  return host === guest ? null : host > guest ? duel.hostUid : duel.guestUid
}

/** Cả hai đã có điểm hợp lệ → xong trận ngay, không đợi hết hạn. */
export function bothResultsIn(duel: Pick<DuelRuleState, "hostUid" | "guestUid" | "results">): boolean {
  return duel.guestUid !== null && duel.results[duel.hostUid] !== undefined && duel.results[duel.guestUid] !== undefined
}
