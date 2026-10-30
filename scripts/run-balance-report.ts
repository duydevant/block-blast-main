/**
 * In báo cáo cân bằng: `npm run balance` (mặc định 300 ván) hoặc `npm run balance -- 1000`.
 * `npm run balance -- 300 logic` = chế độ "Không bế tắc" (khay luôn có lối đi).
 * `npm run balance -- 300 v2` = luật v2 (chuỗi dọn sạch bàn + bộ chia theo điểm, chế độ vô tận).
 * Chạy lại sau mỗi lần chỉnh tray-generator-config.ts / score-and-combo-rules.ts để so sánh.
 */
import { simulateGames } from "../modules/block-puzzle/engine/balance-simulator"

const games = Number(process.argv[2]) || 300
// Giống LOGIC_VARIANT (modules/game-modes/variant-run.ts) — vite-node không resolve alias "@/".
const variant = process.argv[3] === "logic" ? { guaranteedTray: true } : process.argv[3] === "v2" ? { rulesVersion: 2 as const } : undefined
const started = performance.now()
const report = simulateGames({ games, variant })
console.table(report)
console.log(`${games} ván${process.argv[3] ? ` (${process.argv[3]})` : ""} trong ${((performance.now() - started) / 1000).toFixed(1)}s`)
