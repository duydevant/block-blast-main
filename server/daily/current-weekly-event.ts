import type { WeeklyEventInfo } from "@/modules/player-profile/player-profile-types"
import { eventRuleForWeek } from "@/modules/game-modes/weekly-event-catalog"

import { isoWeekKeyFor } from "./daily-challenge-calendar"

/** Sự kiện của tuần hiện tại (tuần ISO theo giờ VN). */
export function currentWeeklyEvent(now: Date): WeeklyEventInfo {
  const week = isoWeekKeyFor(now)
  return { week, ruleId: eventRuleForWeek(week).id }
}
