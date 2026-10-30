/**
 * In báo cáo cân bằng: `npm run balance` (mặc định 300 ván) hoặc `npm run balance -- 1000`.
 * `npm run balance -- 300 logic` = chế độ "Không bế tắc" (khay luôn có lối đi).
 * Chạy lại sau mỗi lần chỉnh tray-generator-config.ts / score-and-combo-rules.ts để so sánh.
 */
import { simulateGames } from "../modules/block-puzzle/engine/balance-simulator"

const games = Number(process.argv[2]) || 300
// Giống LOGIC_VARIANT (modules/game-modes/variant-run.ts) — vite-node không resolve alias "@/".
const variant = process.argv[3] === "logic" ? { guaranteedTray: true } : undefined
const started = performance.now()
const report = simulateGames({ games, variant })
console.table(report)
console.log(`${games} ván${variant ? " (Không bế tắc)" : ""} trong ${((performance.now() - started) / 1000).toFixed(1)}s`)
