"use client"

import { useCallback, useEffect, useState } from "react"

/** Khoảng giữa 2 nước khi phát ở tốc độ ×1. */
const STEP_MS = 700
export const REPLAY_SPEEDS = [1, 2, 4] as const
export type ReplaySpeed = (typeof REPLAY_SPEEDS)[number]

/** Điều khiển phát lại: vị trí nước hiện tại (0 = đầu ván), phát/dừng, tốc độ. */
export function useReplayPlayer(lastIndex: number) {
  const [index, setIndex] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [speed, setSpeed] = useState<ReplaySpeed>(1)

  useEffect(() => {
    if (!playing) return
    if (index >= lastIndex) {
      const stop = window.setTimeout(() => setPlaying(false), 0)
      return () => window.clearTimeout(stop)
    }
    const timer = window.setTimeout(() => setIndex((value) => Math.min(lastIndex, value + 1)), STEP_MS / speed)
    return () => window.clearTimeout(timer)
  }, [playing, index, lastIndex, speed])

  const seek = useCallback(
    (value: number) => {
      setPlaying(false)
      setIndex(Math.max(0, Math.min(lastIndex, value)))
    },
    [lastIndex]
  )
  const toggle = useCallback(() => {
    // Đã ở cuối mà bấm phát → phát lại từ đầu.
    setIndex((value) => (value >= lastIndex ? 0 : value))
    setPlaying((value) => !value)
  }, [lastIndex])

  return { index, playing, speed, setSpeed, seek, toggle, step: (delta: number) => seek(index + delta) }
}
