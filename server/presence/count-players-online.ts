import "server-only"

import { PRESENCE_PATH, type PresenceCountResponse } from "@/modules/presence/presence-paths"
import { getAdminDatabase } from "@/server/firebase/firebase-admin-app"

/** Đọc cả node presence tốn băng thông theo số người → cache trong process, đủ cho con số "đang chơi". */
const CACHE_MS = 30_000
let cached: { at: number; value: Promise<PresenceCountResponse> } | null = null

async function readCount(): Promise<PresenceCountResponse> {
  const snapshot = await getAdminDatabase().ref(PRESENCE_PATH).once("value")
  return { playing: snapshot.numChildren() }
}

/** Số người đang mở màn chơi (Admin SDK đọc; client không đọc được danh sách uid). */
export function countPlayersOnline(now = Date.now()): Promise<PresenceCountResponse> {
  if (cached && now - cached.at < CACHE_MS) return cached.value
  const value = readCount().catch((error: unknown) => {
    cached = null
    throw error
  })
  cached = { at: now, value }
  return value
}
