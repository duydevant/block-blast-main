import { randomInt } from "node:crypto"

import { z } from "zod"

import type { ChallengeOpponent } from "@/modules/challenge/challenge-types"
import { guestTagFromUid } from "@/modules/player-profile/player-profile-types"

/** challenges/{id} và challenges/{id}/results/{uid} (điểm tốt nhất của từng người nhận). */
export const CHALLENGES_COLLECTION = "challenges"
export const CHALLENGE_RESULTS_SUBCOLLECTION = "results"

const ID_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789"

/** 10 ký tự, bỏ ký tự dễ nhầm (0/O, 1/l/I). */
export function generateChallengeId(): string {
  return Array.from({ length: 10 }, () => ID_ALPHABET[randomInt(ID_ALPHABET.length)]).join("")
}

export const storedChallengeSchema = z.object({
  creatorUid: z.string(),
  creatorName: z.string().nullable().catch(null),
  creatorScore: z.number().int().nonnegative(),
  seed: z.number().int().nonnegative(),
  stashUnlocked: z.boolean(),
  attempts: z.number().int().nonnegative().catch(0),
  /** Hạn thưởng 2 chiều (ms); thách đấu cũ không có → không thưởng. */
  expiresAtMs: z.number().int().nullable().catch(null),
  /** uid người nhận đã được thưởng. */
  rewardedUids: z.record(z.string(), z.boolean()).catch({}),
})

export type StoredChallenge = z.infer<typeof storedChallengeSchema>

export function toChallengeOpponent(id: string, challenge: StoredChallenge): ChallengeOpponent {
  return {
    id,
    creatorName: challenge.creatorName,
    creatorTag: guestTagFromUid(challenge.creatorUid),
    creatorScore: challenge.creatorScore,
  }
}
