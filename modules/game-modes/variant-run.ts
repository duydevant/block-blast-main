import type { GameVariant } from "@/modules/block-puzzle/engine/game-types"
import type { DuelPlayer } from "@/modules/duel/duel-types"

import { findLevel, levelVariant } from "./level-catalog"

/** Ván hiện tại thuộc chế độ đặc biệt nào (lưu trong save, quyết định biến thể + HUD). */
export type VariantRun =
  | { kind: "level"; levelId: number }
  /** "Không bế tắc": ván thường nhưng mọi khay đều có lối đi; BXH riêng. */
  | { kind: "logic" }
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
export function variantForRun(run: { kind: "level"; levelId: number } | { kind: "duel" } | { kind: "logic" }): GameVariant | undefined {
  if (run.kind === "logic") return LOGIC_VARIANT
  if (run.kind === "level") {
    const definition = findLevel(run.levelId)
    return definition ? levelVariant(definition) : undefined
  }
  return DUEL_VARIANT
}
