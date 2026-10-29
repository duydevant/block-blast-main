import { z } from "zod"

import {
  DAILY_MISSION_COUNT,
  dailyMissionProgressSchema,
  dailyMissionsForDay,
  dailyMissionStatuses,
  type DailyMissionStatus,
  type MissionBand,
  missionBandForTier,
} from "@/modules/progression/daily-mission-catalog"
import { formFromRecent, tierForForm } from "@/modules/progression/player-form-rules"
import type { StoredPlayer } from "@/server/profile/stored-player-document"

const count = z.number().int().nonnegative().catch(0)

/** Doc users/{uid}/missions/{YYYYMMDD}: tiến độ nhiệm vụ + mức đã chốt + bộ đếm trong ngày. */
const missionDaySchema = z.object({
  progress: dailyMissionProgressSchema,
  /** Mức nhiệm vụ chốt ở lần ghi đầu tiên trong ngày (đổi Bậc giữa ngày không đổi nhiệm vụ). */
  band: z
    .number()
    .int()
    .min(0)
    .max(3)
    .transform((value) => value as MissionBand)
    .optional()
    .catch(undefined),
  /** Ô nhiệm vụ đã đổi hôm nay (mỗi ngày 1 lần); null = chưa đổi. */
  replacedSlot: z
    .number()
    .int()
    .min(0)
    .max(DAILY_MISSION_COUNT - 1)
    .nullable()
    .catch(null),
  /** Số ván đã nộp hôm nay (0 = ván đầu tiên của ngày → +1 ngày chơi trong bộ đếm năm). */
  gamesToday: count,
  /** Số ván ≥ 1.000 điểm hôm nay (thành tích Marathon). */
  games1000: count,
})

export type MissionDay = z.infer<typeof missionDaySchema>

export function parseMissionDay(data: unknown): MissionDay {
  const parsed = missionDaySchema.safeParse(data ?? {})
  return parsed.success ? parsed.data : { progress: {}, band: undefined, replacedSlot: null, gamesToday: 0, games1000: 0 }
}

/** Mức nhiệm vụ hôm nay: đã chốt thì giữ, chưa thì theo Bậc hiện tại của người chơi. */
export function missionBandFor(day: MissionDay, stored: Pick<StoredPlayer, "recentFormScores">): MissionBand {
  return day.band ?? missionBandForTier(tierForForm(formFromRecent(stored.recentFormScores)))
}

/** Nhiệm vụ hôm nay kèm tiến độ (hiển thị). */
export function missionStatusesFor(dayKey: string, day: MissionDay, band: MissionBand): DailyMissionStatus[] {
  return dailyMissionStatuses(dailyMissionsForDay(dayKey, band, day.replacedSlot), day.progress)
}
