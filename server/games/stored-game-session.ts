import { z } from "zod"

import type { GameVariant } from "@/modules/block-puzzle/engine/game-types"
import { variantForRun } from "@/modules/game-modes/variant-run"

/** Doc gameSessions/{gameId} do server tạo lúc cấp seed. */
export const storedSessionSchema = z.object({
  uid: z.string(),
  seed: z.number().int().nonnegative(),
  stashUnlocked: z.boolean(),
  status: z.enum(["open", "done", "rejected", "abandoned"]),
  // Session tạo trước phase 02 không có mode/day → classic.
  mode: z.enum(["classic", "daily", "challenge", "event", "level", "duel"]).catch("classic"),
  day: z.string().regex(/^\d{8}$/).nullable().catch(null),
  challengeId: z.string().nullable().catch(null),
  eventWeek: z.string().regex(/^\d{4}-W\d{2}$/).nullable().catch(null),
  eventRuleId: z.string().nullable().catch(null),
  levelId: z.number().int().positive().nullable().catch(null),
  duelId: z.string().nullable().catch(null),
})

export type StoredGameSession = z.infer<typeof storedSessionSchema>

/** Biến thể ván để replay — luôn từ catalog theo session, không bao giờ từ client. */
export function variantForSession(session: StoredGameSession): GameVariant | undefined {
  if (session.mode === "event" && session.eventRuleId) return variantForRun({ kind: "event", ruleId: session.eventRuleId })
  if (session.mode === "level" && session.levelId !== null) return variantForRun({ kind: "level", levelId: session.levelId })
  if (session.mode === "duel") return variantForRun({ kind: "duel" })
  return undefined
}
