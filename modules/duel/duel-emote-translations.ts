/** Chuỗi emote phòng đấu 1v1 (en/vi), spread vào lib/i18n.tsx. */
export const duelEmoteEn = {
  "emote.barLabel": "Send an emote",
  "emote.send": "Send {emote}",
  "emote.hideSetting": "Hide opponent emotes",
  "emote.hideSettingHint": "Only your own emotes show in 1v1 rooms",
} as const

export const duelEmoteVi: Record<keyof typeof duelEmoteEn, string> = {
  "emote.barLabel": "Gửi biểu cảm",
  "emote.send": "Gửi {emote}",
  "emote.hideSetting": "Ẩn biểu cảm của đối thủ",
  "emote.hideSettingHint": "Trong phòng đấu 1v1 chỉ hiện biểu cảm của bạn",
}
