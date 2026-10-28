import type { Database } from "firebase/database"

type Toggle = (db: Database) => void

/** Số chỗ đang cần kết nối RTDB (presence, phòng đấu…). Chỉ ngắt khi không còn ai cần. */
let holders = 0

/**
 * Giữ kết nối Realtime DB; trả hàm nhả (gọi nhiều lần vẫn chỉ nhả một lần).
 * Ngắt kết nối khi rảnh để tiết kiệm (gói Spark chỉ 100 kết nối đồng thời) mà không cắt ngang
 * tính năng khác đang dùng chung kết nối.
 */
export function holdRealtimeConnection(db: Database, goOnline: Toggle, goOffline: Toggle): () => void {
  holders++
  goOnline(db)
  let released = false
  return () => {
    if (released) return
    released = true
    holders--
    if (holders === 0) goOffline(db)
  }
}
