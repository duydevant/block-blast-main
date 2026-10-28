/** Node RTDB: /presence/{uid} = thời điểm vào (server timestamp); mất kết nối thì RTDB tự xoá. */
export const PRESENCE_PATH = "presence"

/** GET /api/presence */
export interface PresenceCountResponse {
  playing: number
}

/** Dưới mốc này không hiện "X người đang chơi" (1 người = chính mình, không thuyết phục ai). */
export const MIN_PLAYING_TO_SHOW = 2
