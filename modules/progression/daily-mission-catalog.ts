import { z } from "zod"

import { nextRandomInt, normalizeSeed } from "@/modules/block-puzzle/engine/seeded-random-generator"

import type { PlayerTier } from "./player-form-rules"
import { isQualifyingGame } from "./player-level-curve"

/**
 * Nhiệm vụ ngày: mọi người chơi cùng *loại* nhiệm vụ trong một ngày (giờ VN), chọn tất định từ khoá ngày;
 * *mức* theo band kỹ năng (Bậc) chốt ở lần ghi đầu tiên trong ngày. Server chỉ lưu tiến độ + band + slot đã đổi
 * (users/{uid}/missions/{day}), không lưu danh sách.
 */
export type DailyMissionKind =
  | "games"
  | "lines"
  | "score"
  | "combo"
  | "boardClears"
  | "daily"
  | "pureScore"
  | "multiClear"
  | "efficiency"
  | "levelStars"
  | "duel"
  | "dailyStars"

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

/** Band kỹ năng 0..3 quyết định mức nhiệm vụ (Minesweeper: rank cao → quest level cao, thưởng cao). */
export type MissionBand = 0 | 1 | 2 | 3
export const MISSION_BANDS: readonly MissionBand[] = [0, 1, 2, 3]

export function missionBandForTier(tier: PlayerTier): MissionBand {
  if (tier === "diamond" || tier === "master") return 3
  if (tier === "gold" || tier === "platinum") return 2
  return tier === "silver" ? 1 : 0
}

type Level = readonly [target: number, coins: number, xp: number]
/** Một mức cho cả 4 band (nhiệm vụ không phụ thuộc kỹ năng). */
const flat = (level: Level): readonly Level[] => [level, level, level, level]

/** Mức theo band 0..3. Loại kỹ năng tăng mục tiêu + thưởng theo band. */
const MISSION_LEVELS: Record<DailyMissionKind, readonly Level[]> = {
  games: [[3, 20, 30], [3, 20, 30], [5, 30, 50], [5, 30, 50]],
  lines: [[20, 25, 30], [30, 30, 40], [40, 40, 50], [60, 60, 80]],
  score: [[1000, 25, 30], [1500, 30, 40], [3000, 40, 50], [8000, 60, 80]],
  combo: [[6, 25, 30], [8, 30, 40], [15, 40, 50], [25, 60, 80]],
  boardClears: flat([1, 40, 50]),
  daily: flat([1, 30, 40]),
  pureScore: [[600, 30, 40], [1000, 35, 45], [2000, 45, 55], [5000, 70, 90]],
  multiClear: [[1, 25, 30], [2, 30, 40], [3, 40, 50], [5, 60, 80]],
  efficiency: [[12, 25, 30], [18, 30, 40], [25, 40, 50], [35, 60, 80]],
  levelStars: flat([1, 30, 40]),
  duel: flat([1, 30, 40]),
  dailyStars: flat([2, 35, 45]),
}

const MISSION_KINDS = Object.keys(MISSION_LEVELS) as DailyMissionKind[]

/** Nhiệm vụ "hiệu suất" chỉ tính ván đủ dài (ván 3 nước điểm/nước cao là chuyện ngẫu nhiên). */
export const EFFICIENCY_MIN_MOVES = 30

function missionFor(kind: DailyMissionKind, band: MissionBand): DailyMission {
  const [target, coins, xp] = MISSION_LEVELS[kind][band]
  return { id: `${kind}-${target}`, kind, target, coins, xp }
}

/** Thứ tự loại nhiệm vụ của ngày (tất định): 3 loại đầu là nhiệm vụ, loại thứ 4 dùng khi đổi nhiệm vụ. */
function kindOrderForDay(day: string): DailyMissionKind[] {
  // Trộn hằng số để seed nhiệm vụ không trùng seed bàn chơi daily.
  let state = normalizeSeed(Math.imul(Number(day) | 0, 0x9e3779b1) ^ 0x5bd1e995)
  const kinds = [...MISSION_KINDS]
  for (let i = kinds.length - 1; i > 0; i--) {
    const [j, next] = nextRandomInt(state, i + 1)
    state = next
    ;[kinds[i], kinds[j]] = [kinds[j], kinds[i]]
  }
  return kinds
}

/**
 * 3 nhiệm vụ của ngày "YYYYMMDD" (tất định theo ngày + band). `replacedSlot` = ô người chơi đã đổi
 * (mỗi ngày 1 lần) → thay bằng loại kế tiếp trong thứ tự của ngày.
 */
export function dailyMissionsForDay(day: string, band: MissionBand = 0, replacedSlot: number | null = null): DailyMission[] {
  const kinds = kindOrderForDay(day)
  return kinds.slice(0, DAILY_MISSION_COUNT).map((kind, slot) => missionFor(slot === replacedSlot ? kinds[DAILY_MISSION_COUNT] : kind, band))
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
  /** Ván thuần đủ nước (không Cất / Đổi khối / Hồi sinh). */
  pure: boolean
  /** Số nước xoá ≥ 3 dòng. */
  multiClears3: number
  /** Ván màn chơi đạt 3 sao. */
  levelThreeStars: boolean
  isDuel: boolean
  /** Số sao thử thách ngày sau lượt này (0 nếu không phải lượt tính điểm). */
  dailyStars: number
}

/** Loại cộng dồn qua nhiều ván; còn lại lấy kỷ lục trong 1 ván. */
const CUMULATIVE_KINDS: ReadonlySet<DailyMissionKind> = new Set(["games", "lines", "boardClears", "daily", "multiClear", "levelStars", "duel"])

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
    case "pureScore":
      return game.pure ? game.score : 0
    case "multiClear":
      return game.multiClears3
    case "efficiency":
      return game.moveCount >= EFFICIENCY_MIN_MOVES ? Math.floor(game.score / game.moveCount) : 0
    case "levelStars":
      return game.levelThreeStars ? 1 : 0
    case "duel":
      return game.isDuel ? 1 : 0
    case "dailyStars":
      return game.dailyStars
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

/** POST /api/missions/replace */
export interface ReplaceDailyMissionResponse {
  missions: DailyMissionStatus[]
}

export function dailyMissionStatuses(missions: DailyMission[], progress: DailyMissionProgress): DailyMissionStatus[] {
  return missions.map((item) => ({ ...item, progress: Math.min(progress[item.id] ?? 0, item.target) }))
}
