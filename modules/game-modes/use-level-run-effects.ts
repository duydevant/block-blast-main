"use client"

import { useEffect } from "react"

import { useBlockPuzzleGameStore } from "@/modules/block-puzzle/store/block-puzzle-game-store"

import { findLevel, isLevelGoalMet, starsForLevel } from "./level-catalog"
import { useLevelProgressStore } from "./level-progress-store"

/**
 * Màn chơi: đạt mục tiêu là qua màn ngay (chốt ván để không đi thêm nước làm giảm sao)
 * và lưu số sao trên máy; server xác nhận lại khi ván được nộp.
 */
export function useLevelRunEffects() {
  const run = useBlockPuzzleGameStore((state) => state.variantRun)
  const game = useBlockPuzzleGameStore((state) => state.game)
  const endVariantRun = useBlockPuzzleGameStore((state) => state.endVariantRun)
  const recordStars = useLevelProgressStore((state) => state.recordStars)

  useEffect(() => {
    if (run?.kind !== "level" || !game) return
    const definition = findLevel(run.levelId)
    if (!definition || !isLevelGoalMet(definition, game)) return
    recordStars(definition.id, starsForLevel(definition, game))
    endVariantRun()
  }, [run, game, endVariantRun, recordStars])
}
