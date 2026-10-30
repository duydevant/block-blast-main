/**
 * Emote trong phòng đấu 1v1: 6 biểu cảm cố định (không chat chữ tự do → không cần kiểm duyệt).
 * RTDB `duels/{id}/emotes/{uid}` = { e, at } — rules chỉ cho người chơi ghi của chính mình, `at == now`, cách nhau ≥ 3 s.
 */
export const DUEL_EMOTES = ["👍", "😮", "😂", "🔥", "😭", "GG"] as const

/** Khoảng tối thiểu giữa 2 emote của một người (khớp rules RTDB). */
export const EMOTE_COOLDOWN_MS = 3000
/** Emote hiện trên màn bấy lâu. */
export const EMOTE_SHOW_MS = 2000

export interface EmoteRecord {
  e: number
  at: number
}

export function isValidEmoteIndex(index: unknown): index is number {
  return typeof index === "number" && Number.isInteger(index) && index >= 0 && index < DUEL_EMOTES.length
}

/** Còn bao lâu (ms) mới gửi được emote tiếp; 0 = gửi được ngay. `lastSentAt` theo giờ máy lúc bấm gửi. */
export function emoteCooldownLeft(lastSentAt: number | null, now: number): number {
  return lastSentAt === null ? 0 : Math.max(0, lastSentAt + EMOTE_COOLDOWN_MS - now)
}

/** Bản ghi đọc từ RTDB → emote mới (chỉ khi `at` khác lần trước); dữ liệu hỏng → null. */
export function newEmoteFrom(previousAt: number | null, value: unknown): EmoteRecord | null {
  const record = value as Partial<EmoteRecord> | null
  if (!record || !isValidEmoteIndex(record.e) || typeof record.at !== "number" || record.at === previousAt) return null
  return { e: record.e, at: record.at }
}
