import { fetchJsonWithFirebaseIdToken } from "@/lib/firebase/fetch-json-with-firebase-id-token"
import { ApiRoutes, Routes } from "@/lib/routes"
import { siteConfig } from "@/lib/site"

import type { CreateDuelResponse, DuelStateResponse } from "./duel-types"

/** Link tuyệt đối của phòng để gửi qua Zalo/Messenger (chơi hoặc xem). */
export function duelUrl(duelId: string): string {
  return new URL(`${Routes.DUEL}/${duelId}`, siteConfig.url).toString()
}

/** Màn chơi của ván `round` trong phòng (round giúp nhận ra ván mới cùng mã phòng). */
export function duelPlayHref(duelId: string, round: number): string {
  return `${Routes.PLAY}?duel=${duelId}&round=${round}`
}

export function createDuelRoom(): Promise<CreateDuelResponse> {
  return fetchJsonWithFirebaseIdToken<CreateDuelResponse>(ApiRoutes.DUELS, { method: "POST", body: {} })
}

export function joinDuelRoom(duelId: string): Promise<DuelStateResponse> {
  return fetchJsonWithFirebaseIdToken<DuelStateResponse>(`${ApiRoutes.DUELS}/${duelId}/join`, { method: "POST" })
}

/** Nhờ server chấm ván từ nước đi (mình vừa dừng / vừa vượt điểm / quá hạn); chưa rõ kết quả thì không đổi gì. */
export function settleDuelRoom(duelId: string): Promise<DuelStateResponse> {
  return fetchJsonWithFirebaseIdToken<DuelStateResponse>(`${ApiRoutes.DUELS}/${duelId}/settle`, { method: "POST" })
}

/** Sẵn sàng (hoặc huỷ) đấu ván tiếp trong cùng phòng. */
export function setDuelReady(duelId: string, ready: boolean): Promise<DuelStateResponse> {
  return fetchJsonWithFirebaseIdToken<DuelStateResponse>(`${ApiRoutes.DUELS}/${duelId}/ready`, { method: "POST", body: { ready } })
}

/** Trạng thái công khai (không cần đăng nhập); quá hạn thì server chốt ván luôn. */
export async function fetchDuelState(duelId: string): Promise<DuelStateResponse | null> {
  const response = await fetch(`${ApiRoutes.DUELS}/${duelId}`, { cache: "no-store" })
  if (response.status === 404) return null
  if (!response.ok) throw new Error(`duel ${response.status}`)
  return (await response.json()) as DuelStateResponse
}
