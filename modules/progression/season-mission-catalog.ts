import { z } from "zod"

import { nextRandomInt, normalizeSeed } from "@/modules/block-puzzle/engine/seeded-random-generator"

import type { MissionBand } from "./daily-mission-catalog"
import { type PlayerTier, tierRank } from "./player-form-rules"

/**
 * Nhiệm vụ mùa (5 nhiệm vụ lớn / tháng, giống season quests của Minesweeper): loại tất định theo mùa, mức theo band
 * chốt ở ván đầu tiên của mùa. Thưởng lớn hơn nhiệm vụ ngày và phải bấm nhận (tạo thói quen quay lại).
 */
export type SeasonMissionKind = "lines" | "dailyDays" | "tierReach" | "levelStars" | "pureScore" | "duelGames" | "arenaWins"

export interface SeasonMission {
  /** `season-${kind}-${target}` (không trùng id nhiệm vụ ngày). */
  id: string
  kind: SeasonMissionKind
  target: number
  coins: number
  xp: number
}

export interface SeasonMissionStatus extends SeasonMission {
  progress: number
  claimed: boolean
}

export const SEASON_MISSION_COUNT = 5

/** Mục tiêu theo band 0..3. tierReach: 2 = Bạc, 3 = Vàng, 4 = Bạch kim, 5 = Kim cương (tierRank + 1). */
const TARGETS: Record<SeasonMissionKind, readonly [number, number, number, number]> = {
  lines: [300, 500, 800, 1200],
  dailyDays: [10, 12, 15, 18],
  tierReach: [2, 3, 4, 5],
  levelStars: [6, 8, 10, 12],
  pureScore: [1500, 2500, 4000, 8000],
  duelGames: [5, 8, 10, 15],
  arenaWins: [2, 3, 4, 5],
}
const KINDS = Object.keys(TARGETS) as SeasonMissionKind[]

/** Loại cộng dồn qua các ván; còn lại lấy giá trị cao nhất. */
const CUMULATIVE: ReadonlySet<SeasonMissionKind> = new Set(["lines", "dailyDays", "levelStars", "duelGames", "arenaWins"])

export function seasonMissionsFor(season: string, band: MissionBand): SeasonMission[] {
  let state = normalizeSeed(Math.imul(Number(season.replace("-", "")) | 0, 0x85ebca6b) ^ 0x27d4eb2f)
  const kinds = [...KINDS]
  for (let i = kinds.length - 1; i > 0; i--) {
    const [j, next] = nextRandomInt(state, i + 1)
    state = next
    ;[kinds[i], kinds[j]] = [kinds[j], kinds[i]]
  }
  return kinds.slice(0, SEASON_MISSION_COUNT).map((kind) => {
    const target = TARGETS[kind][band]
    return { id: `season-${kind}-${target}`, kind, target, coins: 150 + band * 50, xp: 200 + band * 100 }
  })
}

/** Số liệu một ván đã replay mà nhiệm vụ mùa cần. */
export interface SeasonGameResult {
  linesCleared: number
  /** Lượt đầu thử thách ngày được tính điểm (mỗi ngày tối đa 1). */
  firstDailyRun: boolean
  tierAfter: PlayerTier
  /** Sao màn mới đạt ở ván này. */
  levelStarsGained: number
  /** Điểm nếu là ván thuần đủ nước, không thì 0. */
  pureScore: number
  isDuel: boolean
  arenaWon: boolean
}

function gameValue(kind: SeasonMissionKind, game: SeasonGameResult): number {
  switch (kind) {
    case "lines":
      return game.linesCleared
    case "dailyDays":
      return game.firstDailyRun ? 1 : 0
    case "tierReach":
      return tierRank(game.tierAfter) + 1
    case "levelStars":
      return game.levelStarsGained
    case "pureScore":
      return game.pureScore
    case "duelGames":
      return game.isDuel ? 1 : 0
    case "arenaWins":
      return game.arenaWon ? 1 : 0
  }
}

export type SeasonMissionProgress = Record<string, number>
export const seasonMissionProgressSchema: z.ZodType<SeasonMissionProgress> = z.record(z.string(), z.number().int().nonnegative()).catch({})

/** Cộng một ván vào tiến độ nhiệm vụ mùa (đã chặn ở target). */
export function advanceSeasonMissions(missions: readonly SeasonMission[], progress: SeasonMissionProgress, game: SeasonGameResult): SeasonMissionProgress {
  const next = { ...progress }
  for (const item of missions) {
    const before = Math.min(progress[item.id] ?? 0, item.target)
    const value = gameValue(item.kind, game)
    next[item.id] = Math.min(item.target, CUMULATIVE.has(item.kind) ? before + value : Math.max(before, value))
  }
  return next
}

export function seasonMissionStatuses(missions: readonly SeasonMission[], progress: SeasonMissionProgress, claimed: readonly string[]): SeasonMissionStatus[] {
  return missions.map((item) => ({ ...item, progress: Math.min(progress[item.id] ?? 0, item.target), claimed: claimed.includes(item.id) }))
}
