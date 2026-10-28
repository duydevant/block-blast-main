import { z } from "zod"

import { CHALLENGE_ID_PATTERN, type ChallengeOpponent } from "@/modules/challenge/challenge-types"
import { DUEL_ID_PATTERN } from "@/modules/duel/duel-types"
import { LEVEL_COUNT } from "@/modules/game-modes/level-catalog"
import type { VariantRun } from "@/modules/game-modes/variant-run"

import type { GameState } from "../engine/game-types"
import { POWER_UP_RULES } from "../engine/power-up-rules"
import type { RecordedGameAction } from "../engine/replay-recorded-game-actions"

/** Ván hiện tại đang tính điểm trên cloud (seed do server cấp). */
export interface RankedSession {
  gameId: string
  uid: string
  /** true = đã đưa vào hàng chờ nộp (hết ván, hết hồi sinh); không nộp lại lần nữa. */
  queued: boolean
}

/** Seed server cấp sẵn cho ván kế tiếp, để bấm "Chơi lại" là có ván tính điểm ngay. */
export interface IssuedRankedSeed {
  gameId: string
  uid: string
  seed: number
  stashUnlocked: boolean
}

export interface PendingSubmission {
  gameId: string
  uid: string
  actions: RecordedGameAction[]
}

export interface RankedGameCloudState {
  rankedSession: RankedSession | null
  /** Nước đi của ván hiện tại (ghi cả ván offline, rẻ và giúp nhận seed server cho ván chưa chơi). */
  actionLog: RecordedGameAction[]
  nextRankedSeed: IssuedRankedSeed | null
  pendingSubmissions: PendingSubmission[]
  /** Ván hiện tại là thử thách của ngày này ("YYYYMMDD"); có rankedSession = lượt tính điểm, không = luyện tập. */
  dailyDay: string | null
  /** Ván hiện tại là lượt nhận thách đấu này (so điểm ở màn hết ván). */
  challenge: ChallengeOpponent | null
  /** Ván hiện tại thuộc sự kiện tuần / màn chơi / đấu 1v1 (biến thể + HUD riêng). */
  variantRun: VariantRun | null
}

export const EMPTY_RANKED_GAME_CLOUD_STATE: RankedGameCloudState = {
  rankedSession: null,
  actionLog: [],
  nextRankedSeed: null,
  pendingSubmissions: [],
  dailyDay: null,
  challenge: null,
  variantRun: null,
}

/** Ván chế độ đặc biệt: gameId null = chơi offline/không tính (VD màn chơi khi mất mạng). */
export interface IssuedVariantStart {
  gameId: string | null
  uid: string | null
  seed: number
  run: VariantRun
}

/** Seed thách đấu server cấp: seed + ô cất giống ván của người thách. */
export interface IssuedChallengeStart {
  gameId: string
  uid: string
  seed: number
  stashUnlocked: boolean
  opponent: ChallengeOpponent
}

/** Seed daily server trả về: gameId null = lượt luyện tập (đã chơi lượt tính điểm hôm nay). */
export interface IssuedDailyStart {
  gameId: string | null
  uid: string
  seed: number
  day: string
}

/**
 * Ván chưa có tiến độ gì → thay bằng ván khác không mất gì của người chơi.
 * `initialReplaceCharges`: số lượt đổi lúc đầu ván (sự kiện có thể khác mặc định).
 */
export function isUntouchedGame(game: GameState | null, initialReplaceCharges: number = POWER_UP_RULES.replaceChargesPerGame): boolean {
  return Boolean(
    game && game.moveCount === 0 && game.score === 0 && !game.stash && !game.isGameOver
      && (game.replaceCharges ?? POWER_UP_RULES.replaceChargesPerGame) === initialReplaceCharges
  )
}

// Save nằm trong localStorage (người dùng sửa được) → chỉ validate kiểu; server mới là nơi kiểm tra thật.
const actionSchema = z.object({ type: z.enum(["PLACE_PIECE", "STASH_PIECE", "REPLACE_TRAY", "REVIVE"]) }).passthrough()
const idSchema = z.string().min(1).max(128)
const rankedStateSchema = z.object({
  rankedSession: z.object({ gameId: idSchema, uid: idSchema, queued: z.boolean() }).nullable().catch(null),
  actionLog: z.array(actionSchema).catch([]),
  nextRankedSeed: z
    .object({ gameId: idSchema, uid: idSchema, seed: z.number().int().nonnegative(), stashUnlocked: z.boolean() })
    .nullable()
    .catch(null),
  pendingSubmissions: z
    .array(z.object({ gameId: idSchema, uid: idSchema, actions: z.array(actionSchema) }))
    .max(20)
    .catch([]),
  dailyDay: z.string().regex(/^\d{8}$/).nullable().catch(null),
  challenge: z
    .object({
      id: z.string().regex(CHALLENGE_ID_PATTERN),
      creatorName: z.string().max(64).nullable(),
      creatorTag: z.string().max(8),
      creatorScore: z.number().int().nonnegative(),
    })
    .nullable()
    .catch(null),
  variantRun: z
    .discriminatedUnion("kind", [
      z.object({ kind: z.literal("event"), week: z.string().regex(/^\d{4}-W\d{2}$/), ruleId: z.string().max(32) }),
      z.object({ kind: z.literal("level"), levelId: z.number().int().min(1).max(LEVEL_COUNT) }),
      z.object({
        kind: z.literal("duel"),
        duelId: z.string().regex(DUEL_ID_PATTERN),
        // Save trước khi có phòng nhiều ván: round 0 (không trùng ván nào của phòng mới).
        round: z.number().int().nonnegative().catch(0),
        seed: z.number().int().nonnegative().catch(0),
        opponent: z.object({ uid: z.string().max(128), name: z.string().max(64).nullable() }),
        startAt: z.number(),
        endsAt: z.number(),
        // Lệch giờ máy so với server lúc vào ván (save cũ không có → 0).
        clockOffset: z.number().catch(0),
      }),
    ])
    .nullable()
    .catch(null),
})

export function parseSavedRankedGameCloudState(value: unknown): RankedGameCloudState {
  const parsed = rankedStateSchema.safeParse(value ?? {})
  return parsed.success ? (parsed.data as RankedGameCloudState) : EMPTY_RANKED_GAME_CLOUD_STATE
}
