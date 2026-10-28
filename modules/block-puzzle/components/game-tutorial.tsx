"use client"

import { useEffect, useRef, useState } from "react"
import { useI18n } from "@/lib/i18n"
import { playSound, unlockAudio } from "../audio/sound-effects-player"
import { createTutorialStage, placeTutorialPiece, TUTORIAL_SLOT, tutorialTarget, type TutorialStage } from "../engine/tutorial"
import { findShape } from "../engine/piece-shape-catalog"
import { attachPointerDragController, type DragState } from "../input/pointer-drag-controller"
import { renderFrame } from "../render/board-canvas-renderer"
import { holdLabels } from "./block-puzzle-game-canvas"
import { drawBlock, setBlockTheme } from "../render/block-cell-painter"
import { DEFAULT_BLOCK_THEME } from "../render/block-color-palette"
import { computeLayout, trayPieceOrigin, type CanvasLayout } from "../render/canvas-layout-metrics"
import { createMoveEffects, pruneEffects, type GameEffect } from "../render/effects-timeline"
import { useBlockPuzzleSettingsStore } from "../store/block-puzzle-settings-store"

/** A separate, ephemeral tutorial: classic progress and best score are never replaced. */
export function GameTutorial({ onComplete }: { onComplete: () => void }) {
  const i18n = useI18n()
  const { t } = i18n
  const i18nRef = useRef(i18n)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const completeRef = useRef(onComplete)
  const [stage, setStage] = useState<TutorialStage>(1)
  useEffect(() => { completeRef.current = onComplete }, [onComplete])
  useEffect(() => { i18nRef.current = i18n }, [i18n])

  useEffect(() => {
    const canvas = canvasRef.current
    const container = containerRef.current
    const ctx = canvas?.getContext("2d")
    if (!canvas || !container || !ctx) return
    let currentStage: TutorialStage = 1
    let game = createTutorialStage(1)
    let layout: CanvasLayout | null = null
    let drag: DragState | null = null
    let effects: GameEffect[] = []
    let frame = 0
    let timer = 0
    let settling = false
    let disposed = false
    let cycleStart = performance.now()
    const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches
    const draw = (now: number) => {
      if (disposed) return
      if (layout) {
        setBlockTheme(DEFAULT_BLOCK_THEME)
        effects = pruneEffects(effects, now)
        renderFrame(ctx, layout, { game, drag, effects, now, ...holdLabels(i18nRef.current) })
        const piece = game.tray[TUTORIAL_SLOT]
        const shape = piece && findShape(piece.shapeId)
        if (!drag && !settling && piece && shape) {
          const origin = trayPieceOrigin(layout, TUTORIAL_SLOT, shape)
          const target = tutorialTarget(currentStage)
          const progress = reduced ? 0 : ((now - cycleStart) % 2400) / 2400
          const p = Math.min(1, progress * 1.2)
          const eased = p < 0.5 ? 4 * p ** 3 : 1 - (-2 * p + 2) ** 3 / 2
          const size = layout.cellSize * (0.5 + eased * 0.5)
          const x = origin.x + (layout.board.x + target.col * layout.cellSize - origin.x) * eased
          const y = origin.y + (layout.board.y + target.row * layout.cellSize - origin.y) * eased
          for (const [r, c] of shape.cells) drawBlock(ctx, x + c * size, y + r * size, size, piece.colorId, 0.5)
          // Con trỏ hướng dẫn: chấm tròn + vòng toả, vẽ bằng code.
          const cx = x + (shape.width * size) / 2
          const cy = y + (shape.height * size) / 2
          const radius = layout.cellSize * 0.28
          ctx.save()
          ctx.fillStyle = "rgba(255, 255, 255, 0.9)"
          ctx.beginPath()
          ctx.arc(cx, cy, radius, 0, Math.PI * 2)
          ctx.fill()
          ctx.strokeStyle = `rgba(255, 255, 255, ${0.6 * (1 - p)})`
          ctx.lineWidth = Math.max(1, layout.cellSize * 0.06)
          ctx.beginPath()
          ctx.arc(cx, cy, radius * (1.3 + p), 0, Math.PI * 2)
          ctx.stroke()
          ctx.restore()
        }
      }
      frame = requestAnimationFrame(draw)
    }
    const controller = attachPointerDragController({
      canvas, getLayout: () => layout, getGame: () => settling ? null : game,
      onDragChange: (next) => { drag = next; cycleStart = performance.now() },
      onPickUp: () => { unlockAudio(); if (useBlockPuzzleSettingsStore.getState().sound) playSound("pick") },
      onInvalidDrop: () => { if (useBlockPuzzleSettingsStore.getState().sound) playSound("invalid") },
      onDrop: (slot, row, col) => {
        const next = placeTutorialPiece(currentStage, game, slot, row, col)
        if (!next) return false
        const before = [...game.board]
        for (const cell of next.lastMove!.placedCells) before[cell] = next.lastMove!.colorId
        const move = next.lastMove!
        const { t: translate, formatNumber } = i18nRef.current
        const texts = {
          points: translate("game.points", { points: formatNumber(move.points) }),
          combo: move.combo >= 2 ? translate("game.combo", { count: move.combo }) : null,
          boardClear: move.boardCleared ? translate("game.boardClear") : null,
        }
        effects = createMoveEffects(move, before, performance.now(), texts, reduced)
        game = next
        settling = true
        if (useBlockPuzzleSettingsStore.getState().sound) playSound("clear", next.lastMove!.clearedRows.length + next.lastMove!.clearedCols.length)
        timer = window.setTimeout(() => {
          if (currentStage === 3) { completeRef.current(); return }
          currentStage = (currentStage + 1) as TutorialStage
          game = createTutorialStage(currentStage, game.score)
          settling = false
          cycleStart = performance.now()
          setStage(currentStage)
        }, 650)
        return true
      },
    })
    const resize = () => {
      const { width, height } = container.getBoundingClientRect()
      layout = computeLayout(width, height, window.devicePixelRatio)
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
    return () => { disposed = true; cancelAnimationFrame(frame); clearTimeout(timer); observer.disconnect(); controller.detach() }
  }, [])

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="mx-4 mt-3 flex items-center justify-between gap-3 rounded-2xl bg-white/8 px-4 py-3">
        <p className="text-lg font-bold text-white" aria-live="polite">{t(`game.tutorial${stage}`)}</p>
        <span className="shrink-0 text-sm text-violet-200/70 tabular-nums">{stage}/3</span>
      </div>
      <div ref={containerRef} className="relative min-h-0 flex-1 touch-none select-none">
        <canvas ref={canvasRef} role="img" className="absolute inset-0" aria-label={t("game.tutorialCanvas")} />
      </div>
      <button className="mx-auto mb-3 rounded-2xl px-4 py-2 font-bold text-violet-200 hover:bg-white/10" onClick={onComplete}>
        {t("game.skip")} <span aria-hidden="true">&rarr;</span>
      </button>
    </div>
  )
}
