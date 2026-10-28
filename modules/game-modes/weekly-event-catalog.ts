import type { GameVariant } from "@/modules/block-puzzle/engine/game-types"

import { BOARD_PATTERNS } from "./board-patterns"

/** Luật sự kiện tuần: mỗi tuần một luật, xoay vòng theo số tuần ISO; tên/mô tả ở i18n `event.<id>`. */
export interface WeeklyEventRule {
  id: string
  variant: GameVariant
}

export const WEEKLY_EVENT_RULES: readonly WeeklyEventRule[] = [
  { id: "stone-cross", variant: { startBoard: BOARD_PATTERNS.cross } },
  { id: "four-corners", variant: { startBoard: BOARD_PATTERNS.corners } },
  { id: "replace-frenzy", variant: { replaceCharges: 6 } },
  { id: "pillars", variant: { startBoard: BOARD_PATTERNS.pillars, replaceCharges: 3 } },
  { id: "checker", variant: { startBoard: BOARD_PATTERNS.checker } },
]

/** "2026-W44" → luật của tuần đó (tất định, client và server cùng kết quả). */
export function eventRuleForWeek(weekKey: string): WeeklyEventRule {
  const match = /^(\d{4})-W(\d{2})$/.exec(weekKey)
  const index = match ? Number(match[1]) * 53 + Number(match[2]) : 0
  return WEEKLY_EVENT_RULES[index % WEEKLY_EVENT_RULES.length]
}

export function findEventRule(id: string): WeeklyEventRule | undefined {
  return WEEKLY_EVENT_RULES.find((rule) => rule.id === id)
}
