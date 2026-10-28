import { DUEL_MOVE_GRACE_MS, DUEL_ROOM_IDLE_TTL_MS, type DuelEndReason, type DuelStatus } from "@/modules/duel/duel-types"

/** Điểm + đã hết nước chưa của một người, replay từ nước đi trên RTDB. */
export interface DuelPlayerProgress {
  score: number
  over: boolean
}

export interface DuelRoundDecision {
  finished: boolean
  winnerUid: string | null
  endReason: DuelEndReason | null
  scores: Record<string, number>
}

/**
 * Chốt ván (thuần):
 * - cả hai hết nước → so điểm;
 * - một người hết nước và người kia đã **vượt** điểm của họ → người kia thắng ngay (điểm không bao giờ giảm);
 * - hết giờ (+ ân hạn ghi nước) → so điểm;
 * - còn lại: người còn sống chơi tiếp tới khi hết nước / hết giờ. Bằng điểm = hoà.
 */
export function decideDuelRound(input: {
  hostUid: string
  guestUid: string
  endsAt: number
  now: number
  progress: Record<string, DuelPlayerProgress>
}): DuelRoundDecision {
  const { hostUid, guestUid } = input
  const host = input.progress[hostUid] ?? { score: 0, over: false }
  const guest = input.progress[guestUid] ?? { score: 0, over: false }
  const scores = { [hostUid]: host.score, [guestUid]: guest.score }
  const winnerUid = host.score === guest.score ? null : host.score > guest.score ? hostUid : guestUid
  const finish = (endReason: DuelEndReason): DuelRoundDecision => ({ finished: true, winnerUid, endReason, scores })

  if (host.over && guest.over) return finish("both-over")
  if ((host.over && guest.score > host.score) || (guest.over && host.score > guest.score)) return finish("clinched")
  if (input.now > input.endsAt + DUEL_MOVE_GRACE_MS) return finish("time")
  return { finished: false, winnerUid: null, endReason: null, scores }
}

/** Phần trạng thái phòng cần cho luật hết hạn. */
export interface DuelIdleState {
  status: DuelStatus
  lastActiveAtMs: number
}

/** Phòng không ai vào quá lâu → hết hạn (hiển thị + chặn vào). */
export function effectiveDuelStatus(duel: DuelIdleState, now: number): DuelStatus {
  return duel.status === "waiting" && isDuelRoomIdle(duel, now) ? "expired" : duel.status
}

/** Quá lâu không có hoạt động (chờ người vào / chờ đấu lại) → không mở ván mới nữa. */
export function isDuelRoomIdle(duel: Pick<DuelIdleState, "lastActiveAtMs">, now: number): boolean {
  return now > duel.lastActiveAtMs + DUEL_ROOM_IDLE_TTL_MS
}

/** Ván đang chơi đã quá hạn ghi nước mà chưa chốt → ai mở phòng cũng chốt được. */
export function isDuelRoundOverdue(duel: { status: DuelStatus; endsAt: number | null }, now: number): boolean {
  return duel.status === "playing" && duel.endsAt !== null && now > duel.endsAt + DUEL_MOVE_GRACE_MS
}

/** Danh sách sẵn sàng mới; trả `start: true` khi đủ cả hai người → mở ván tiếp. */
export function nextReadyList(ready: readonly string[], uid: string, wantReady: boolean, players: readonly string[]): { ready: string[]; start: boolean } {
  const next = wantReady ? [...new Set([...ready, uid])] : ready.filter((item) => item !== uid)
  return { ready: next, start: players.length === 2 && players.every((player) => next.includes(player)) }
}
