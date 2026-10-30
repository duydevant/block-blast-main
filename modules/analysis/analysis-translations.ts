/** Chuỗi phân tích sau ván ("Vì sao thua?") en/vi, spread vào lib/i18n.tsx. */
export const analysisEn = {
  "analysis.button": "Why did I lose?",
  "analysis.title": "Why did I lose?",
  "analysis.running": "Analysing your last moves…",
  "analysis.mistake": "Move #{move} left no way to fit the rest of the tray.",
  "analysis.unlucky": "Not your fault: there was no way to fit all three pieces of the last tray.",
  "analysis.unknown": "This game could not be analysed (Hold / Swap was used, the board was too complex, or it took too long).",
  "analysis.suggestion": "Placing that piece on the dashed cells would have kept a way to fit the whole tray.",
  "analysis.noSuggestion": "No other spot worked for that piece — placing another piece first was the way out.",
  "analysis.holes": "That move also created {count} closed-in empty cell(s).",
  "analysis.yourMove": "Your move",
  "analysis.betterMove": "Better spot",
  "analysis.close": "Close",
  "analysis.stats": "Last {count} analysed games: {unlucky}% bad luck, {mistake}% mistakes",
} as const

export const analysisVi: Record<keyof typeof analysisEn, string> = {
  "analysis.button": "Vì sao thua?",
  "analysis.title": "Vì sao thua?",
  "analysis.running": "Đang phân tích các nước cuối…",
  "analysis.mistake": "Nước #{move} làm khay không còn cách đặt hết các khối còn lại.",
  "analysis.unlucky": "Không phải lỗi của bạn: khay cuối không có cách nào đặt hết 3 khối.",
  "analysis.unknown": "Chưa phân tích được ván này (có dùng Cất / Đổi khối, bàn quá rối hoặc quá lâu).",
  "analysis.suggestion": "Đặt khối đó vào các ô viền cam thì vẫn còn cách đặt hết khay.",
  "analysis.noSuggestion": "Khối đó không có chỗ nào khác ổn — lẽ ra nên đặt khối khác trước.",
  "analysis.holes": "Nước đó còn tạo thêm {count} ô trống bị bao kín.",
  "analysis.yourMove": "Nước bạn đi",
  "analysis.betterMove": "Nên đặt",
  "analysis.close": "Đóng",
  "analysis.stats": "{count} ván phân tích gần nhất: {unlucky}% xui, {mistake}% sai lầm",
}
