import type { GameVariant } from "@/modules/block-puzzle/engine/game-types"
import type { DuelPlayer } from "@/modules/duel/duel-types"

import type { GhostView } from "@/modules/ranked/ranked-types"

import { type ArenaType, findArenaLevel } from "./arena-catalog"
import { findLevel, levelVariant } from "./level-catalog"

/** Ván hiện tại thuộc chế độ đặc biệt nào (lưu trong save, quyết định biến thể + HUD). */
export type VariantRun =
  | { kind: "level"; levelId: number }
  /** "Không bế tắc": ván thường nhưng mọi khay đều có lối đi; BXH riêng. */
  | { kind: "logic" }
  | {
      /** Trận xếp hạng với bóng ma (cùng seed, phát lại theo nhịp thật); không cất. */
      kind: "ranked"
      seed: number
      ghost: GhostView
      /** Giờ server trận kết thúc (3 phút). */
      endsAt: number
      clockOffset: number
    }
  | {
      /** Một lần thử của lượt Đấu trường (không cất: rời ván = nộp phần đã chơi). */
      kind: "arena"
      runId: string
      type: ArenaType
      level: number
      attempt: number
      /** Giờ server đồng hồ lần thử hết (loại Tốc độ); null = không giới hạn giờ. */
      endsAt: number | null
      clockOffset: number
    }
  | {
      kind: "duel"
      duelId: string
      /** Ván thứ mấy trong phòng (phòng đấu nhiều ván cùng mã). */
      round: number
      /** Seed ván (đối thủ/người xem replay nước đi từ seed này). */
      seed: number
      opponent: DuelPlayer
      startAt: number
      endsAt: number
      clockOffset: number
    }

/** Chế độ "Không bế tắc": bàn thường, mọi khay đều đặt hết được theo một thứ tự nào đó. */
export const LOGIC_VARIANT: GameVariant = { guaranteedTray: true }

/** Đấu 1v1: bàn thường, không hồi sinh (chết là dừng, chờ kết quả), không cất / đổi khối. */
export const DUEL_VARIANT: GameVariant = { noRevive: true, noPowerUps: true }

/** Biến thể ván theo chế độ; id lạ (save cũ/bị sửa) → undefined = ván thường. */
export function variantForRun(
  run: { kind: "level"; levelId: number } | { kind: "duel" } | { kind: "ranked" } | { kind: "logic" } | { kind: "arena"; type: string; level: number }
): GameVariant | undefined {
  // Trận xếp hạng dùng luật đấu 1v1 (giống RANKED_VARIANT phía server).
  if (run.kind === "ranked") return DUEL_VARIANT
  if (run.kind === "logic") return LOGIC_VARIANT
  if (run.kind === "arena") return findArenaLevel(run.type, run.level)?.variant
  if (run.kind === "level") {
    const definition = findLevel(run.levelId)
    return definition ? levelVariant(definition) : undefined
  }
  return DUEL_VARIANT
}
