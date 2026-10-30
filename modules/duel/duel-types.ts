/** Kiểu + hằng số đấu 1v1 dùng chung client (phòng, HUD, người xem) và server (API, chấm ván). */

import type { RulesVersion } from "@/modules/block-puzzle/engine/game-types"

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

/** Mỗi ván 3 phút, đếm ngược 5 giây trước khi bắt đầu. */
export const DUEL_DURATION_MS = 3 * 60_000
export const DUEL_COUNTDOWN_MS = 5_000
/**
 * Nước đi ghi lên RTDB trễ hơn hạn chót tối đa từng này vẫn được tính (độ trễ mạng). Rules RTDB
 * (`database.rules.json`) dùng cùng con số — đổi thì sửa cả hai.
 */
export const DUEL_MOVE_GRACE_MS = 3_000
/** Cho phép vào ván / ghi nước sớm hơn giờ bắt đầu một chút (lệch đồng hồ), không hơn — rules RTDB cùng số. */
export const DUEL_EARLY_START_TOLERANCE_MS = 1_500
/** Phòng không có hoạt động (chờ người vào / chờ đấu lại) quá lâu thì hết hạn. */
export const DUEL_ROOM_IDLE_TTL_MS = 60 * 60_000
/** Số ván gần nhất giữ trong lịch sử phòng. */
export const DUEL_HISTORY_LIMIT = 20

export type DuelStatus = "waiting" | "playing" | "finished" | "expired"
/** Vì sao ván kết thúc: vượt điểm khi đối thủ đã hết nước / cả hai hết nước / hết giờ. */
export type DuelEndReason = "clinched" | "both-over" | "time"

export interface DuelPlayer {
  uid: string
  /** null = khách chưa đặt tên → UI hiện "Khách #ABCD". */
  name: string | null
}

/** Kết quả một ván đã xong (lịch sử phòng). */
export interface DuelRoundResult {
  round: number
  scores: Record<string, number>
  winnerUid: string | null
  endReason: DuelEndReason
}

/** Trạng thái phòng (server ghi, mirror lên RTDB `/duels/{id}/state` để client nghe realtime). */
export interface DuelState {
  id: string
  /** Tăng mỗi lần server ghi phòng: bản version cao hơn là bản mới hơn (RTDB và API có thể lệch nhau). */
  version: number
  /** Trạng thái của ván hiện tại (waiting = chưa có đối thủ). */
  status: DuelStatus
  host: DuelPlayer
  guest: DuelPlayer | null
  /** Số thứ tự ván hiện tại, 0 = chưa đấu ván nào. */
  round: number
  /** Khoá ván trên RTDB: nước đi nằm ở `moves/{roundKey}/{uid}`. */
  roundKey: string
  /** Seed ván hiện tại (đã bắt đầu) — người xem replay nước đi từ seed này. */
  seed: number | null
  /** Mốc thời gian theo đồng hồ server (ms). */
  startAt: number | null
  endsAt: number | null
  /** Điểm chốt của ván hiện tại (server replay nước đi). */
  results: Record<string, number>
  /** null khi chưa xong hoặc hoà. */
  winnerUid: string | null
  endReason: DuelEndReason | null
  /** Số ván thắng của mỗi người trong phòng. */
  series: Record<string, number>
  /** Người đã bấm "Sẵn sàng" cho ván tiếp theo. */
  ready: string[]
  /** Các ván đã xong, mới nhất cuối. */
  history: DuelRoundResult[]
  /** uid đã vào ván hiện tại (mỗi người một ván mỗi lượt). */
  started: string[]
  /** Phiên bản luật của ván hiện tại (thiếu = 1) — người xem dựng bàn đúng luật. */
  rulesVersion?: RulesVersion
}

/** Phản hồi API trận (khác bản RTDB): kèm giờ server để client tính lệch đồng hồ khi chưa có RTDB. */
export type DuelStateResponse = DuelState & { serverNow: number }

export const duelRoundKey = (round: number) => `r${round}`
/** Khoá nước đi thứ `index` (0-pad để RTDB sắp đúng thứ tự; tối đa 10.000 nước như log ván). */
export const duelMoveKey = (index: number) => String(index).padStart(4, "0")

/** Một nước đi trên RTDB: action + giờ server lúc ghi (rules ép `at == now`). */
export interface DuelMoveRecord {
  a: unknown
  at: number
}

/** Bản nào mới hơn (version cao hơn) thì dùng — RTDB realtime nhưng mirror là best-effort; API là nguồn thật. */
export function freshestDuelState(live: DuelState | null, fetched: DuelState | null): DuelState | null {
  if (!live || !fetched) return live ?? fetched
  return fetched.version > live.version ? fetched : live
}

/** Thông tin ván trả kèm khi xin session mode "duel". */
export interface DuelStartInfo {
  id: string
  round: number
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
