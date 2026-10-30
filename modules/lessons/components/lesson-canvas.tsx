"use client"

import { useEffect, useRef } from "react"

import { useI18n } from "@/lib/i18n"
import { playSound, unlockAudio } from "@/modules/block-puzzle/audio/sound-effects-player"
import { holdLabels, moveEffectTexts } from "@/modules/block-puzzle/components/game-canvas-texts"
import type { GameState } from "@/modules/block-puzzle/engine/game-types"
import type { RecordedGameAction } from "@/modules/block-puzzle/engine/replay-recorded-game-actions"
import { prefersReducedMotion } from "@/modules/block-puzzle/input/haptic-feedback"
import { attachPointerDragController, type DragState } from "@/modules/block-puzzle/input/pointer-drag-controller"
import { renderFrame } from "@/modules/block-puzzle/render/board-canvas-renderer"
import { setBlockTheme } from "@/modules/block-puzzle/render/block-cell-painter"
import { DEFAULT_BLOCK_THEME } from "@/modules/block-puzzle/render/block-color-palette"
import { computeLayout, type CanvasLayout } from "@/modules/block-puzzle/render/canvas-layout-metrics"
import { createMoveEffects, pruneEffects, type GameEffect } from "@/modules/block-puzzle/render/effects-timeline"
import { resolveReducedMotion, useBlockPuzzleSettingsStore } from "@/modules/block-puzzle/store/block-puzzle-settings-store"

import { drawLessonHint } from "./lesson-hint-painter"

interface LessonCanvasProps {
  game: GameState
  hint: RecordedGameAction | null
  /** Có hàng "Cất | Đổi khối" (bài dạy Cất / Đổi khay). */
  powerUps: boolean
  /** Áp nước đi; trả về state mới hoặc null nếu không hợp lệ. */
  onAction: (action: RecordedGameAction) => GameState | null
}

const soundOn = () => useBlockPuzzleSettingsStore.getState().sound

/**
 * Bàn bài học: renderer + kéo thả của game trên state CỤC BỘ (không đụng save / ván đang chơi), như màn hướng dẫn.
 * Props mới nhất đọc qua ref để vòng vẽ không phải gắn lại.
 */
export function LessonCanvas({ game, hint, powerUps, onAction }: LessonCanvasProps) {
  const i18n = useI18n()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const latest = useRef({ game, hint, onAction, i18n })
  useEffect(() => {
    latest.current = { game, hint, onAction, i18n }
  }, [game, hint, onAction, i18n])

  useEffect(() => {
    const canvas = canvasRef.current
    const container = containerRef.current
    const ctx = canvas?.getContext("2d")
    if (!canvas || !container || !ctx) return
    let layout: CanvasLayout | null = null
    let drag: DragState | null = null
    let effects: GameEffect[] = []
    let frame = 0
    let disposed = false
    const reduced = resolveReducedMotion(useBlockPuzzleSettingsStore.getState().reduceMotion, prefersReducedMotion())

    const draw = (now: number) => {
      if (disposed) return
      if (layout) {
        setBlockTheme(DEFAULT_BLOCK_THEME)
        effects = pruneEffects(effects, now)
        const { game: current, hint: currentHint, i18n: texts } = latest.current
        renderFrame(ctx, layout, { game: current, drag, effects, now, ...holdLabels(texts) })
        if (!drag) drawLessonHint(ctx, layout, current, currentHint, now)
      }
      frame = requestAnimationFrame(draw)
    }

    const apply = (action: RecordedGameAction) => {
      const before = latest.current.game
      const next = latest.current.onAction(action)
      if (!next) return false
      const move = next.lastMove
      if (move) {
        const board = [...before.board]
        for (const cell of move.placedCells) board[cell] = move.colorId
        effects = createMoveEffects(move, board, performance.now(), moveEffectTexts(next, latest.current.i18n), reduced)
        const lines = move.clearedRows.length + move.clearedCols.length
        if (soundOn()) playSound(lines > 0 ? "clear" : "place", lines)
      }
      return true
    }

    const controller = attachPointerDragController({
      canvas,
      getLayout: () => layout,
      getGame: () => latest.current.game,
      onDragChange: (next) => {
        drag = next
      },
      onPickUp: () => {
        unlockAudio()
        if (soundOn()) playSound("pick")
      },
      onInvalidDrop: () => {
        if (soundOn()) playSound("invalid")
      },
      onDrop: (slot, row, col) => apply({ type: "PLACE_PIECE", slot, row, col }),
      onStash: (slot) => apply({ type: "STASH_PIECE", slot }),
    })
    const resize = () => {
      const { width, height } = container.getBoundingClientRect()
      layout = computeLayout(width, height, window.devicePixelRatio, powerUps)
      canvas.width = Math.round(width * layout.dpr)
      canvas.height = Math.round(height * layout.dpr)
      canvas.style.width = `${width}px`
      canvas.style.height = `${height}px`
      controller.cancelDrag()
    }
    const observer = new ResizeObserver(resize)
    observer.observe(container)
    resize()
    frame = requestAnimationFrame(draw)
    return () => {
      disposed = true
      cancelAnimationFrame(frame)
      observer.disconnect()
      controller.detach()
    }
  }, [powerUps])

  return (
    <div ref={containerRef} className="relative aspect-[8.6/13.6] w-full max-w-sm touch-none select-none">
      <canvas ref={canvasRef} role="img" className="absolute inset-0" aria-label={i18n.t("lessons.canvas")} />
    </div>
  )
}
