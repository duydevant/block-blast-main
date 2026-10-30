"use client"

import { useEffect, useRef, useState } from "react"

import { useI18n } from "@/lib/i18n"
import type { GameState } from "@/modules/block-puzzle/engine/game-types"
import { holdLabels } from "@/modules/block-puzzle/components/game-canvas-texts"
import { renderFrame } from "@/modules/block-puzzle/render/board-canvas-renderer"
import { computeLayout } from "@/modules/block-puzzle/render/canvas-layout-metrics"

/** Vẽ một trạng thái ván (không kéo thả, không hiệu ứng) — dùng renderer của màn chơi nên giống hệt ván thật. */
export function ReplayBoardCanvas({ game, label }: { game: GameState; label: string }) {
  const i18n = useI18n()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [size, setSize] = useState({ width: 0, height: 0 })

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const observer = new ResizeObserver(([entry]) => setSize({ width: entry.contentRect.width, height: entry.contentRect.height }))
    observer.observe(canvas)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext("2d")
    if (!canvas || !ctx || size.width === 0) return
    const layout = computeLayout(size.width, size.height, window.devicePixelRatio || 1, !game.noPowerUps)
    canvas.width = Math.round(size.width * layout.dpr)
    canvas.height = Math.round(size.height * layout.dpr)
    renderFrame(ctx, layout, { game, drag: null, effects: [], now: performance.now(), ...holdLabels(i18n) })
  }, [game, size, i18n])

  return <canvas ref={canvasRef} role="img" aria-label={label} className="aspect-[8.6/13.6] w-full max-w-sm touch-none" />
}
