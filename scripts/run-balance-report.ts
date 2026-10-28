/**
 * In báo cáo cân bằng: `npm run balance` (mặc định 300 ván) hoặc `npm run balance -- 1000`.
 * Chạy lại sau mỗi lần chỉnh tray-generator-config.ts / score-and-combo-rules.ts để so sánh.
 */
import { simulateGames } from "../modules/block-puzzle/engine/balance-simulator"

const games = Number(process.argv[2]) || 300
const started = performance.now()
const report = simulateGames({ games })
console.table(report)
console.log(`${games} ván trong ${((performance.now() - started) / 1000).toFixed(1)}s`)
