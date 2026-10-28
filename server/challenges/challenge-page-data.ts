import "server-only"

import { cache } from "react"

import { CHALLENGE_ID_PATTERN, type ChallengeView } from "@/modules/challenge/challenge-types"

import { getChallengeView } from "./challenge-store"

/** Dùng chung cho page, generateMetadata và ảnh OG trong cùng một request (chỉ đọc Firestore một lần). */
export const loadChallengeView = cache(async (id: string): Promise<ChallengeView | null> =>
  CHALLENGE_ID_PATTERN.test(id) ? getChallengeView(id) : null
)

/** Tên người thách cho metadata/OG (server không có i18n client → dùng tiếng Việt, khán giả chính). */
export function challengerLabel(view: ChallengeView): string {
  return view.creatorName ?? `Khách #${view.creatorTag}`
}

export function formatScoreVi(score: number): string {
  return score.toLocaleString("vi-VN")
}
