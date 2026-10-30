import type { Firestore } from "firebase-admin/firestore"
import { z } from "zod"

import { ARENA_TYPES, type ArenaLevelDefinition, findArenaLevel } from "@/modules/game-modes/arena-catalog"
import { type ArenaRunProgress, attemptsLeft } from "@/modules/game-modes/arena-goal-rules"
import type { ArenaRunView } from "@/modules/game-modes/arena-types"

/** arenaRuns/{runId}: một lượt Đấu trường đã trả xu. */
export const ARENA_RUNS_COLLECTION = "arenaRuns"

const count = z.number().int().nonnegative()
const storedRunSchema = z.object({
  uid: z.string(),
  type: z.enum(ARENA_TYPES),
  level: z.number().int().min(1).max(5),
  status: z.enum(["open", "won", "lost", "expired"]),
  attemptsUsed: count.catch(0),
  gamesDone: count.catch(0),
  createdAtMs: count,
  expiresAtMs: count,
  entryCoins: count.catch(0),
  /** Session của lần thử đang chơi (chưa nộp); null = không có. */
  openGameId: z.string().nullable().catch(null),
})

export type StoredArenaRun = z.infer<typeof storedRunSchema> & { definition: ArenaLevelDefinition }

export function parseArenaRun(data: unknown): StoredArenaRun | null {
  const parsed = storedRunSchema.safeParse(data)
  if (!parsed.success) return null
  const definition = findArenaLevel(parsed.data.type, parsed.data.level)
  return definition ? { ...parsed.data, definition } : null
}

export const arenaRunRef = (db: Firestore, runId: string) => db.collection(ARENA_RUNS_COLLECTION).doc(runId)

export const progressOf = (run: StoredArenaRun): ArenaRunProgress => ({ status: run.status, attemptsUsed: run.attemptsUsed, gamesDone: run.gamesDone })

/** Lượt còn mở nhưng đã quá hạn (chưa ai ghi trạng thái) → coi như hết hạn. */
export function effectiveStatus(run: StoredArenaRun, nowMs: number): ArenaRunProgress["status"] {
  return run.status === "open" && nowMs >= run.expiresAtMs ? "expired" : run.status
}

export function toArenaRunView(runId: string, run: StoredArenaRun, nowMs: number): ArenaRunView {
  const status = effectiveStatus(run, nowMs)
  return {
    runId,
    type: run.type,
    level: run.level,
    status,
    attemptsUsed: run.attemptsUsed,
    gamesDone: run.gamesDone,
    attemptsLeft: attemptsLeft(run.definition, { ...progressOf(run), status }),
    expiresAt: run.expiresAtMs,
  }
}
