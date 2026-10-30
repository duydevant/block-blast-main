"use client"

import { useEffect, useRef, useState } from "react"

import { useI18n } from "@/lib/i18n"
import { siteConfig } from "@/lib/site"

import { playSound, unlockAudio, type SoundName } from "../audio/sound-effects-player"
import { STASH_SLOT } from "../engine/game-types"
import { prefersReducedMotion, vibrate } from "../input/haptic-feedback"
import type { DragState } from "../input/pointer-drag-controller"
import { renderFrame } from "../render/board-canvas-renderer"
import { setBlockTheme, setColorblindMarks } from "../render/block-cell-painter"
import { computeLayout, type CanvasLayout, type Rect } from "../render/canvas-layout-metrics"
import { setCanvasFontFamily } from "../render/effects-painter"
import { createMoveEffects, pruneEffects, type GameEffect } from "../render/effects-timeline"
import { useBlockPuzzleGameStore } from "../store/block-puzzle-game-store"
import { resolveReducedMotion, useBlockPuzzleSettingsStore } from "../store/block-puzzle-settings-store"
import { attachGameCanvasInputs } from "./attach-game-canvas-inputs"
import { cursorAnnouncement, holdLabels, moveAnnouncement, moveEffectTexts } from "./game-canvas-texts"
import { TraySwapButton } from "./tray-swap-button"

// Màn hướng dẫn import nhãn ô "Cất" từ đây.
export { holdLabels }

/**
 * Canvas game: tự quản lý layout, kéo thả, hiệu ứng và vòng vẽ rAF.
 * Đọc store qua getState/subscribe nên không re-render React mỗi frame; idle thì không chạy rAF.
 */
export function BlockPuzzleGameCanvas() {
  const i18n = useI18n()
  const containerRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const i18nRef = useRef(i18n)
  // Chỗ của nút "Đổi khối" (HTML) theo bố cục canvas.
  const [swapRect, setSwapRect] = useState<Rect | null>(null)
  // Câu đọc cho trình đọc màn hình (nước đi, con trỏ bàn phím).
  const [announcement, setAnnouncement] = useState("")

  useEffect(() => {
    i18nRef.current = i18n
  }, [i18n])

  useEffect(() => {
    const canvas = canvasRef.current
    const container = containerRef.current
    const ctx = canvas?.getContext("2d")
    if (!canvas || !container || !ctx) return

    setCanvasFontFamily(getComputedStyle(canvas).fontFamily)
    let layout: CanvasLayout | null = null
    let drag: DragState | null = null
    let effects: GameEffect[] = []
    let frameId = 0
    let gameOverTimer = 0

    const draw = () => {
      frameId = 0
      const game = useBlockPuzzleGameStore.getState().game
      if (!layout || !game) return
      const now = performance.now()
      effects = pruneEffects(effects, now)
      const { colorTheme, colorblindMarks, linePreview } = useBlockPuzzleSettingsStore.getState()
      setBlockTheme(colorTheme)
      setColorblindMarks(colorblindMarks)
      renderFrame(ctx, layout, { game, drag, effects, now, linePreview, ...holdLabels(i18nRef.current) })
      if (effects.length > 0) requestDraw()
    }
    const requestDraw = () => {
      if (!frameId) frameId = requestAnimationFrame(draw)
    }

    const settings = () => useBlockPuzzleSettingsStore.getState()
    const sound = (name: SoundName, intensity?: number) => {
      if (settings().sound) playSound(name, intensity)
    }
    const haptic = (pattern: number | number[]) => {
      if (settings().haptics) vibrate(pattern)
    }

    const inputs = attachGameCanvasInputs({
      canvas,
      getLayout: () => layout,
      onDragChange: (next, cursor) => {
        drag = next
        if (cursor) setAnnouncement(cursorAnnouncement(cursor, next?.snap != null, i18nRef.current))
        requestDraw()
      },
      sound,
      haptic,
    })
    const { pointer: controller, keyboard } = inputs

    const resize = () => {
      const { width, height } = container.getBoundingClientRect()
      // Ván 1v1 không có hàng "Cất | Đổi khối" → bàn to hơn.
      const powerUps = !useBlockPuzzleGameStore.getState().game?.noPowerUps
      layout = computeLayout(width, height, window.devicePixelRatio, powerUps)
      canvas.width = Math.round(width * layout.dpr)
      canvas.height = Math.round(height * layout.dpr)
      canvas.style.width = `${width}px`
      canvas.style.height = `${height}px`
      setSwapRect(layout.cellSize > 0 && powerUps ? layout.swapButton : null)
      // Toạ độ snap cũ không còn đúng sau khi đổi kích thước (con trỏ bàn phím thì tính lại theo bố cục mới).
      controller.cancelDrag()
      keyboard.refresh()
      // Đổi kích thước canvas sẽ xoá nội dung → vẽ lại ngay để không chớp trắng.
      draw()
    }
    const observer = new ResizeObserver(resize)
    observer.observe(container)
    resize()

    const unsubscribe = useBlockPuzzleGameStore.subscribe((state, prev) => {
      const game = state.game
      const before = prev.game
      if (!game || game === before) return
      // Sang / rời ván 1v1 → bố cục có / không có hàng "Cất | Đổi khối".
      if (layout && layout.powerUps === Boolean(game.noPowerUps)) resize()

      if (keyboard.isActive()) keyboard.refresh()
      else if (drag && (drag.slot === STASH_SLOT ? game.stash : game.tray[drag.slot])?.uid !== drag.uid) controller.cancelDrag()
      const move = game.lastMove
      if (before && move && game.moveCount === before.moveCount + 1) {
        const boardBeforeClear = [...before.board]
        for (const index of move.placedCells) boardBeforeClear[index] = move.colorId
        const texts = moveEffectTexts(game, i18nRef.current)
        const reduced = resolveReducedMotion(settings().reduceMotion, prefersReducedMotion())
        effects.push(...createMoveEffects(move, boardBeforeClear, performance.now(), texts, reduced))
        setAnnouncement(moveAnnouncement(game, i18nRef.current))

        const lines = move.clearedRows.length + move.clearedCols.length
        if (lines > 0) {
          sound("clear", lines)
          if (move.combo >= 2) sound("combo", move.combo)
          haptic([18, 30, 36])
        } else {
          sound("place")
          haptic(10)
        }
        if (game.isGameOver) gameOverTimer = window.setTimeout(() => sound("gameOver"), 450)
      } else {
        // Ván mới / khôi phục / power-up: bỏ hiệu ứng cũ.
        effects = []
        window.clearTimeout(gameOverTimer)
        // Cất khối hoặc đổi khay cũng có thể làm hết nước.
        if (before && game.isGameOver && !before.isGameOver) {
          sound("gameOver")
          setAnnouncement(moveAnnouncement({ ...game, lastMove: null }, i18nRef.current))
        }
      }
      requestDraw()
    })
    const unsubscribeSettings = useBlockPuzzleSettingsStore.subscribe((state, prev) => {
      if (state.colorTheme !== prev.colorTheme || state.colorblindMarks !== prev.colorblindMarks || state.linePreview !== prev.linePreview) {
        requestDraw()
      }
    })

    // Một số trình duyệt mobile chỉ coi pointerup/keydown là user gesture để mở audio.
    window.addEventListener("pointerup", unlockAudio)
    window.addEventListener("keydown", unlockAudio)

    return () => {
      observer.disconnect()
      unsubscribe()
      unsubscribeSettings()
      inputs.detach()
      window.removeEventListener("pointerup", unlockAudio)
      window.removeEventListener("keydown", unlockAudio)
      window.clearTimeout(gameOverTimer)
      if (frameId) cancelAnimationFrame(frameId)
    }
  }, [])

  return (
    <div ref={containerRef} className="relative min-h-0 flex-1 touch-none overscroll-none select-none">
      {/* Canvas nhận focus để chơi bằng bàn phím; hướng dẫn phím đọc qua aria-describedby. */}
      <canvas
        ref={canvasRef}
        role="application"
        tabIndex={0}
        aria-label={i18n.t("game.canvasLabel", { name: siteConfig.name })}
        aria-describedby="game-keyboard-hint"
        className="absolute inset-0 block rounded-2xl outline-none focus-visible:ring-2 focus-visible:ring-amber-300"
      />
      <p id="game-keyboard-hint" className="sr-only">{i18n.t("gameSettings.keyboardHint")}</p>
      <p className="sr-only" aria-live="polite">{announcement}</p>
      {swapRect && <TraySwapButton rect={swapRect} />}
    </div>
  )
}
