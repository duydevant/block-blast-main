import type { GameVariant } from "@/modules/block-puzzle/engine/game-types"
import type { DuelPlayer } from "@/modules/duel/duel-types"

import { findLevel, levelVariant } from "./level-catalog"
import { findEventRule } from "./weekly-event-catalog"

/** Ván hiện tại thuộc chế độ đặc biệt nào (lưu trong save, quyết định biến thể + HUD). */
export type VariantRun =
  | { kind: "event"; week: string; ruleId: string }
  | { kind: "level"; levelId: number }
  | { kind: "duel"; duelId: string; opponent: DuelPlayer; startAt: number; endsAt: number; clockOffset: number }

/** Biến thể ván theo chế độ; id lạ (save cũ/bị sửa) → undefined = ván thường. */
export function variantForRun(run: { kind: "event"; ruleId: string } | { kind: "level"; levelId: number } | { kind: "duel" }): GameVariant | undefined {
  if (run.kind === "event") return findEventRule(run.ruleId)?.variant
  if (run.kind === "level") {
    const definition = findLevel(run.levelId)
    return definition ? levelVariant(definition) : undefined
  }
  return undefined
}
