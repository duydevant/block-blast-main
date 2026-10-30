"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { PlayCircleIcon } from "lucide-react"
import { toast } from "sonner"

import { ApiRequestError, fetchJsonWithFirebaseIdToken } from "@/lib/firebase/fetch-json-with-firebase-id-token"
import { useI18n } from "@/lib/i18n"
import { ApiRoutes, Routes } from "@/lib/routes"
import { SECONDARY_BUTTON } from "@/modules/block-puzzle/components/game-ui-styles"
import { withoutActionTime } from "@/modules/block-puzzle/engine/recorded-action-timing"
import { useBlockPuzzleGameStore } from "@/modules/block-puzzle/store/block-puzzle-game-store"
import { useLastGameRewardsStore } from "@/modules/progression/last-game-rewards-store"

import type { SaveReplayResponse } from "../replay-types"

/**
 * "Xem lại ván" ở hộp hết ván (chỉ ván đã nộp + đã xác minh): ván kỷ lục / lọt top đã có replay tự lưu → mở luôn;
 * ván khác → lưu theo yêu cầu (server replay lại, điểm phải khớp) rồi mở. Ván bị gắn cờ không có nút.
 */
export function GameOverReplayButton() {
  const { t } = useI18n()
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const gameId = useBlockPuzzleGameStore((state) => state.rankedSession?.gameId ?? null)
  const rewards = useLastGameRewardsStore((state) => (state.gameId !== null && state.gameId === gameId ? state.rewards : null))
  if (!gameId || !rewards || rewards.flagged) return null

  const open = async () => {
    if (rewards.replayId) return router.push(`${Routes.REPLAY}/${rewards.replayId}`)
    setSaving(true)
    try {
      const actions = useBlockPuzzleGameStore.getState().actionLog.map(withoutActionTime)
      const { replayId } = await fetchJsonWithFirebaseIdToken<SaveReplayResponse>(ApiRoutes.REPLAYS, { method: "POST", body: { gameId, actions } })
      router.push(`${Routes.REPLAY}/${replayId}`)
    } catch (error) {
      toast.error(t(error instanceof ApiRequestError && error.code === "replay-limit" ? "replay.limit" : "replay.saveFailed"))
      setSaving(false)
    }
  }

  return (
    <button className={`${SECONDARY_BUTTON} w-full`} onClick={open} disabled={saving}>
      <PlayCircleIcon className="size-4" aria-hidden="true" />
      {t(saving ? "replay.saving" : "replay.watch")}
    </button>
  )
}
