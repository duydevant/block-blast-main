/** Kiểu + hằng số đấu 1v1 dùng chung client (phòng, HUD) và server (API, kết quả). */

/**
 * Mã phòng = id phòng: 6 ký tự in hoa không dễ nhầm (bảng chữ của mã mời) — vừa gõ tay được vừa nằm trong link.
 * Vẫn nhận id 10 ký tự của các phòng tạo trước khi đổi sang mã.
 */
export const DUEL_CODE_LENGTH = 6
export const DUEL_ID_PATTERN = /^(?:[A-HJ-NP-Za-km-z2-9]{10}|[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{6})$/

/** Mã gõ tay → mã chuẩn (in hoa, bỏ khoảng trắng), null nếu sai dạng. */
export function normalizeDuelCode(raw: string): string | null {
  const code = raw.replace(/\s+/g, "").toUpperCase()
  return code.length === DUEL_CODE_LENGTH && DUEL_ID_PATTERN.test(code) ? code : null
}

/** Mỗi trận 3 phút, đếm ngược 5 giây trước khi bắt đầu. */
export const DUEL_DURATION_MS = 3 * 60_000
export const DUEL_COUNTDOWN_MS = 5_000
/** Ván nộp trễ quá hạn này (mạng chập chờn…) không được tính → coi như bỏ cuộc. */
export const DUEL_SUBMIT_GRACE_MS = 60_000
/** Phòng chờ quá lâu không ai vào thì hết hạn. */
export const DUEL_WAITING_TTL_MS = 60 * 60_000

export type DuelStatus = "waiting" | "playing" | "finished" | "expired"

export interface DuelPlayer {
  uid: string
  /** null = khách chưa đặt tên → UI hiện "Khách #ABCD". */
  name: string | null
}

/** Trạng thái phòng (server ghi, mirror lên RTDB `/duels/{id}/state` để client nghe realtime). */
export interface DuelState {
  id: string
  status: DuelStatus
  host: DuelPlayer
  guest: DuelPlayer | null
  /** Mốc thời gian theo đồng hồ server (ms). */
  startAt: number | null
  endsAt: number | null
  /** Điểm đã được server replay của từng người (uid → điểm). */
  results: Record<string, number>
  /** null khi chưa xong hoặc hoà. */
  winnerUid: string | null
  /** Trận đấu lại do một trong hai người tạo. */
  rematchId: string | null
  /** uid đã vào ván đấu (mỗi người chỉ một ván) — để phòng không đưa người đã chơi quay lại. */
  started: string[]
}

/** Phản hồi API trận (khác bản RTDB): kèm giờ server để client tính lệch đồng hồ khi chưa có RTDB. */
export type DuelStateResponse = DuelState & { serverNow: number }

/** Cho phép vào ván sớm hơn giờ bắt đầu một chút (độ trễ mạng/đồng hồ), không hơn. */
export const DUEL_EARLY_START_TOLERANCE_MS = 1_500

/** Trạng thái "tiến xa" hơn thắng khi hai bản (RTDB / API, hoặc hai lần ghi) lệch nhau. */
export function duelStateRank(state: Pick<DuelState, "status" | "results" | "started" | "rematchId">): number {
  const status = state.status === "waiting" ? 0 : state.status === "playing" ? 1 : 2
  return status * 1000 + Object.keys(state.results ?? {}).length * 100 + (state.started?.length ?? 0) * 10 + (state.rematchId ? 1 : 0)
}

/** Điểm trực tiếp mỗi người tự ghi lên RTDB `/duels/{id}/live/{uid}` (chỉ để hiển thị). */
export interface DuelLiveScore {
  score: number
  over: boolean
}

/** Thông tin trận trả kèm khi xin session mode "duel". */
export interface DuelStartInfo {
  id: string
  opponent: DuelPlayer
  startAt: number
  endsAt: number
  /** Giờ server lúc cấp ván → client tự tính lệch đồng hồ, không phụ thuộc RTDB. */
  serverNow: number
}

/** POST /api/duels */
export interface CreateDuelResponse {
  duelId: string
}

export const DUEL_RTDB_PATH = "duels"

/** Bản nào "tiến xa" hơn thì dùng (RTDB realtime nhưng mirror là best-effort; API là nguồn thật). */
export function freshestDuelState(live: DuelState | null, fetched: DuelState | null): DuelState | null {
  if (!live || !fetched) return live ?? fetched
  return duelStateRank(fetched) > duelStateRank(live) ? fetched : live
}
