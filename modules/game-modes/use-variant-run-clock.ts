"use client"

import { useEffect, useState } from "react"

import { useBlockPuzzleGameStore } from "@/modules/block-puzzle/store/block-puzzle-game-store"

/**
 * Đồng hồ ván có giờ (Đấu trường Tốc độ, trận xếp hạng) theo giờ server: trả ms còn lại (null = không giới hạn);
 * hết giờ → chốt ván để sync tự nộp. Chỉ chạy khi ván chưa hết.
 */
export function useVariantRunClock(endsAt: number | null, clockOffset: number): number | null {
  const endVariantRun = useBlockPuzzleGameStore((state) => state.endVariantRun)
  const isOver = useBlockPuzzleGameStore((state) => state.game?.isGameOver ?? true)
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    if (endsAt === null || isOver) return
    const timer = window.setInterval(() => {
      setNow(Date.now())
      if (Date.now() + clockOffset >= endsAt) endVariantRun()
    }, 250)
    return () => window.clearInterval(timer)
  }, [endsAt, clockOffset, isOver, endVariantRun])

  return endsAt === null ? null : Math.max(0, endsAt - (now + clockOffset))
}

/** "m:ss" từ ms còn lại. */
export function formatClock(msLeft: number): string {
  const seconds = Math.ceil(msLeft / 1000)
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`
}
