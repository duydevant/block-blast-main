import { fetchJsonWithFirebaseIdToken } from "@/lib/firebase/fetch-json-with-firebase-id-token"
import { ApiRoutes, Routes } from "@/lib/routes"
import { siteConfig } from "@/lib/site"

import type { CreateDuelResponse, DuelStateResponse } from "./duel-types"

/** Link tuyệt đối của phòng để gửi qua Zalo/Messenger. */
export function duelUrl(duelId: string): string {
  return new URL(`${Routes.DUEL}/${duelId}`, siteConfig.url).toString()
}

export function createDuelRoom(rematchOf?: string): Promise<CreateDuelResponse> {
  return fetchJsonWithFirebaseIdToken<CreateDuelResponse>(ApiRoutes.DUELS, { method: "POST", body: rematchOf ? { rematchOf } : {} })
}

export function joinDuelRoom(duelId: string): Promise<DuelStateResponse> {
  return fetchJsonWithFirebaseIdToken<DuelStateResponse>(`${ApiRoutes.DUELS}/${duelId}/join`, { method: "POST" })
}

/** Trạng thái công khai (không cần đăng nhập); quá hạn nộp thì server chốt trận luôn. */
export async function fetchDuelState(duelId: string): Promise<DuelStateResponse | null> {
  const response = await fetch(`${ApiRoutes.DUELS}/${duelId}`, { cache: "no-store" })
  if (response.status === 404) return null
  if (!response.ok) throw new Error(`duel ${response.status}`)
  return (await response.json()) as DuelStateResponse
}
