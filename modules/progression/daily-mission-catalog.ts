import { z } from "zod"

import { nextRandomInt, normalizeSeed } from "@/modules/block-puzzle/engine/seeded-random-generator"

import { isQualifyingGame } from "./player-level-curve"

/**
 * Nhiệm vụ ngày: mọi người chơi cùng 3 nhiệm vụ trong một ngày (giờ VN), chọn tất định từ khoá ngày
 * nên server không cần lưu danh sách — chỉ lưu tiến độ users/{uid}/missions/{day}.
 */
export type DailyMissionKind = "games" | "lines" | "score" | "combo" | "boardClears" | "daily"

export interface DailyMission {
  /** `${kind}-${target}`, dùng làm key tiến độ và key dịch. */
  id: string
  kind: DailyMissionKind
  target: number
  coins: number
  xp: number
}

/** Tiến độ đã lưu: missionId → giá trị (đã chặn ở target). */
export type DailyMissionProgress = Record<string, number>

/** Doc tiến độ thiếu/hỏng → coi như chưa làm gì. */
export const dailyMissionProgressSchema: z.ZodType<DailyMissionProgress> = z
  .record(z.string(), z.number().int().nonnegative())
  .catch({})

/** Nhiệm vụ kèm tiến độ, trả về cho UI. */
export interface DailyMissionStatus extends DailyMission {
  progress: number
}

export const DAILY_MISSION_COUNT = 3

const mission = (kind: DailyMissionKind, target: number, coins: number, xp: number): DailyMission => ({
  id: `${kind}-${target}`,
  kind,
  target,
  coins,
  xp,
})

/** Mỗi loại vài mức khó; mỗi ngày lấy 3 loại khác nhau, mỗi loại 1 mức. */
const MISSION_VARIANTS: Record<DailyMissionKind, DailyMission[]> = {
  games: [mission("games", 3, 20, 30), mission("games", 5, 30, 50)],
  lines: [mission("lines", 20, 25, 30), mission("lines", 40, 40, 50)],
  score: [mission("score", 1500, 25, 30), mission("score", 3000, 40, 50)],
  combo: [mission("combo", 8, 25, 30), mission("combo", 15, 40, 50)],
  boardClears: [mission("boardClears", 1, 40, 50)],
  daily: [mission("daily", 1, 30, 40)],
}

const MISSION_KINDS = Object.keys(MISSION_VARIANTS) as DailyMissionKind[]

/** 3 nhiệm vụ của ngày "YYYYMMDD" (tất định). */
export function dailyMissionsForDay(day: string): DailyMission[] {
  // Trộn hằng số để seed nhiệm vụ không trùng seed bàn chơi daily.
  let state = normalizeSeed(Math.imul(Number(day) | 0, 0x9e3779b1) ^ 0x5bd1e995)
  const kinds = [...MISSION_KINDS]
  for (let i = kinds.length - 1; i > 0; i--) {
    const [j, next] = nextRandomInt(state, i + 1)
    state = next
    ;[kinds[i], kinds[j]] = [kinds[j], kinds[i]]
  }
  return kinds.slice(0, DAILY_MISSION_COUNT).map((kind) => {
    const variants = MISSION_VARIANTS[kind]
    const [index, next] = nextRandomInt(state, variants.length)
    state = next
    return variants[index]
  })
}

/** Số liệu một ván đã replay mà nhiệm vụ cần. */
export interface MissionGameResult {
  moveCount: number
  score: number
  linesCleared: number
  bestCombo: number
  boardClears: number
  /** Ván là lượt tính điểm của thử thách ngày. */
  countedDaily: boolean
}

/** Loại cộng dồn qua nhiều ván; còn lại (điểm, combo) lấy kỷ lục trong 1 ván. */
const CUMULATIVE_KINDS: ReadonlySet<DailyMissionKind> = new Set(["games", "lines", "boardClears", "daily"])

function gameValue(kind: DailyMissionKind, game: MissionGameResult): number {
  switch (kind) {
    case "games":
      return isQualifyingGame(game.moveCount) ? 1 : 0
    case "lines":
      return game.linesCleared
    case "score":
      return game.score
    case "combo":
      return game.bestCombo
    case "boardClears":
      return game.boardClears
    case "daily":
      return game.countedDaily ? 1 : 0
  }
}

/** Cộng một ván vào tiến độ; trả tiến độ mới và các nhiệm vụ vừa hoàn thành ở ván này. */
export function advanceDailyMissions(
  missions: DailyMission[],
  progress: DailyMissionProgress,
  game: MissionGameResult
): { progress: DailyMissionProgress; completed: DailyMission[] } {
  const next: DailyMissionProgress = { ...progress }
  const completed: DailyMission[] = []
  for (const item of missions) {
    const before = Math.min(progress[item.id] ?? 0, item.target)
    const value = gameValue(item.kind, game)
    const after = Math.min(item.target, CUMULATIVE_KINDS.has(item.kind) ? before + value : Math.max(before, value))
    next[item.id] = after
    if (before < item.target && after >= item.target) completed.push(item)
  }
  return { progress: next, completed }
}

export function dailyMissionStatuses(missions: DailyMission[], progress: DailyMissionProgress): DailyMissionStatus[] {
  return missions.map((item) => ({ ...item, progress: Math.min(progress[item.id] ?? 0, item.target) }))
}
