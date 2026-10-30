import "server-only"

import { randomInt } from "node:crypto"

import { type Firestore, Timestamp } from "firebase-admin/firestore"
import { z } from "zod"

import { CURRENT_RULES_VERSION } from "@/modules/block-puzzle/engine/game-types"
import { playBotGhost } from "@/modules/ranked/bot-ghost"
import { mmrBucket } from "@/modules/ranked/rating-rules"
import { PLAYER_TIER_IDS, type PlayerTierId } from "@/modules/progression/player-form-rules"

/** ghostPool/{gameId}: ván xếp hạng đã nộp làm bóng ma cho người cùng nhóm MMR. TTL `expireAt` 30 ngày. */
export const GHOST_POOL_COLLECTION = "ghostPool"
export const GHOST_TTL_MS = 30 * 24 * 60 * 60 * 1000
/** Mở rộng tìm sang nhóm MMR lân cận tối đa chừng này nhóm (±300 MMR). */
const MAX_BUCKET_SPREAD = 3
/** Tỉ lệ ghép thẳng với bot (seed mới): ván thắng/thua bot vào hồ → hồ bóng ma luôn có seed mới, khó học thuộc seed. */
const BOT_INJECT_RATE = 0.15

const count = z.number().int().nonnegative()
const ghostSchema = z.object({
  uid: z.string().nullable().catch(null),
  displayName: z.string().nullable().catch(null),
  tier: z
    .string()
    .refine((value): value is PlayerTierId => (PLAYER_TIER_IDS as readonly string[]).includes(value))
    .nullable()
    .catch(null),
  mmr: count,
  seed: count,
  score: count,
  actions: z.array(count),
  times: z.array(count),
  isBot: z.boolean().catch(false),
  /** Phiên bản luật của ván (thiếu = 1); chỉ ghép với trận cùng phiên bản (cùng seed phải ra cùng khay). */
  rulesVersion: z.literal(2).optional().catch(undefined),
})

export type StoredGhost = z.infer<typeof ghostSchema> & { id: string }

export function ghostDocFor(input: Omit<StoredGhost, "id" | "isBot">, nowMs: number) {
  const { rulesVersion, ...rest } = input
  return { ...rest, ...(rulesVersion === 2 ? { rulesVersion } : {}), isBot: false, bucket: mmrBucket(input.mmr), rand: Math.random(), expireAt: Timestamp.fromMillis(nowMs + GHOST_TTL_MS) }
}

/**
 * Chọn bóng ma: nhóm MMR của mình trước rồi lan ±1..±3 nhóm; mỗi nhóm lấy ngẫu nhiên (field `rand`) vài ván, bỏ ván
 * của chính mình và đối thủ gần đây. Không có ai (hoặc rơi vào BOT_INJECT_RATE) → bot cùng MMR (seed mới).
 */
export async function pickGhost(db: Firestore, input: { uid: string; mmr: number; recentOpponents: readonly string[] }): Promise<StoredGhost> {
  const home = mmrBucket(input.mmr)
  const pool = db.collection(GHOST_POOL_COLLECTION)
  const maxSpread = Math.random() < BOT_INJECT_RATE ? -1 : MAX_BUCKET_SPREAD
  for (let spread = 0; spread <= maxSpread; spread++) {
    const buckets = spread === 0 ? [home] : [home - spread, home + spread].filter((bucket) => bucket >= 0)
    for (const bucket of buckets) {
      const pivot = Math.random()
      const [above, below] = await Promise.all([
        pool.where("bucket", "==", bucket).where("rand", ">=", pivot).orderBy("rand").limit(5).get(),
        pool.where("bucket", "==", bucket).where("rand", "<", pivot).orderBy("rand").limit(5).get(),
      ])
      for (const doc of [...above.docs, ...below.docs]) {
        const parsed = ghostSchema.safeParse(doc.data())
        if (!parsed.success || parsed.data.uid === input.uid || (parsed.data.uid && input.recentOpponents.includes(parsed.data.uid))) continue
        // Bóng ma luật cũ (hết dần theo TTL 30 ngày) không ghép với trận luật hiện tại.
        if ((parsed.data.rulesVersion ?? 1) !== CURRENT_RULES_VERSION) continue
        return { ...parsed.data, id: doc.id }
      }
    }
  }
  const bot = playBotGhost(randomInt(0, 0x1_0000_0000), input.mmr, CURRENT_RULES_VERSION)
  return { id: "bot", uid: null, displayName: null, tier: null, mmr: input.mmr, isBot: true, rulesVersion: CURRENT_RULES_VERSION, ...bot }
}
