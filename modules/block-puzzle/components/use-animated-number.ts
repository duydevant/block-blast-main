"use client"

import { useEffect, useRef, useState } from "react"

import { prefersReducedMotion } from "../input/haptic-feedback"

const DURATION_MS = 400

/** Đếm số tăng dần tới `target` (hiệu ứng điểm nhảy). Giảm (ván mới) thì nhảy thẳng. */
export function useAnimatedNumber(target: number): number {
  const [display, setDisplay] = useState(target)
  const displayRef = useRef(target)

  useEffect(() => {
    const from = displayRef.current
    let frameId = 0
    const start = performance.now()

    const step = (now: number) => {
      const t = target < from || prefersReducedMotion() ? 1 : Math.min(1, (now - start) / DURATION_MS)
      const value = Math.round(from + (target - from) * (1 - (1 - t) ** 3))
      displayRef.current = value
      setDisplay(value)
      if (t < 1) frameId = requestAnimationFrame(step)
    }
    frameId = requestAnimationFrame(step)
    return () => cancelAnimationFrame(frameId)
  }, [target])

  return display
}
