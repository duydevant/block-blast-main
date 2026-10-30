import "server-only"

import { FieldPath, Timestamp } from "firebase-admin/firestore"
import { z } from "zod"

import { GAME_HISTORY_MODES, GAME_HISTORY_PAGE_SIZE, type GameHistoryResponse } from "@/modules/player-profile/game-history-types"
import { getAdminFirestore } from "@/server/firebase/firebase-admin-app"
import { GAMES_HISTORY_SUBCOLLECTION, USERS_COLLECTION } from "@/server/profile/stored-player-document"

import { toGameHistoryEntry } from "./game-history-documents"

/** Cursor = "<giây>.<nano>_<gameId>" của doc cuối trang trước (giữ đủ độ chính xác của serverTimestamp). */
const cursorSchema = z
  .string()
  .regex(/^\d{1,12}\.\d{1,9}_[A-Za-z0-9]{20}$/)
  .transform((value) => {
    const [time, gameId] = value.split("_")
    const [seconds, nanos] = time.split(".")
    return { seconds: Number(seconds), nanos: Number(nanos), gameId }
  })

export const gameHistoryQuerySchema = z.object({
  mode: z.enum(GAME_HISTORY_MODES).optional(),
  cursor: cursorSchema.optional(),
})

export type GameHistoryQuery = z.infer<typeof gameHistoryQuerySchema>

/** Một trang lịch sử của chính người gọi, mới nhất trước (1 truy vấn). */
export async function listGameHistory(uid: string, query: GameHistoryQuery): Promise<GameHistoryResponse> {
  let ref = getAdminFirestore()
    .collection(USERS_COLLECTION)
    .doc(uid)
    .collection(GAMES_HISTORY_SUBCOLLECTION)
    .orderBy("finishedAt", "desc")
    .orderBy(FieldPath.documentId(), "desc")
  if (query.mode) ref = ref.where("mode", "==", query.mode)
  if (query.cursor) ref = ref.startAfter(new Timestamp(query.cursor.seconds, query.cursor.nanos), query.cursor.gameId)

  const snap = await ref.limit(GAME_HISTORY_PAGE_SIZE + 1).get()
  const docs = snap.docs.slice(0, GAME_HISTORY_PAGE_SIZE)
  const items = docs.flatMap((doc) => toGameHistoryEntry(doc.id, doc.data()) ?? [])
  // Cursor lấy từ doc thô cuối trang (kể cả doc hỏng bị bỏ qua) để không lặp lại / dừng sớm.
  const last = docs.at(-1)
  const lastTime = last?.get("finishedAt")
  const nextCursor =
    snap.docs.length > GAME_HISTORY_PAGE_SIZE && last && lastTime instanceof Timestamp ? `${lastTime.seconds}.${lastTime.nanoseconds}_${last.id}` : null
  return { items, nextCursor }
}
