"use client"

import { useEffect, useRef, useState } from "react"

import { useI18n } from "@/lib/i18n"
import { siteConfig } from "@/lib/site"

import { playSound, unlockAudio, type SoundName } from "../audio/sound-effects-player"
import { STASH_SLOT, type GameState } from "../engine/game-types"
import { POWER_UP_RULES } from "../engine/power-up-rules"
import { prefersReducedMotion, vibrate } from "../input/haptic-feedback"
import { attachPointerDragController, type DragState } from "../input/pointer-drag-controller"
import { renderFrame } from "../render/board-canvas-renderer"
import { setBlockTheme } from "../render/block-cell-painter"
import { computeLayout, type CanvasLayout, type Rect } from "../render/canvas-layout-metrics"
import { setCanvasFontFamily } from "../render/effects-painter"
import { createMoveEffects, pruneEffects, type GameEffect, type MoveEffectTexts } from "../render/effects-timeline"
import { useBlockPuzzleGameStore } from "../store/block-puzzle-game-store"
import { useBlockPuzzleSettingsStore } from "../store/block-puzzle-settings-store"
import { TraySwapButton } from "./tray-swap-button"

type I18n = ReturnType<typeof useI18n>

/** Nhãn vẽ trong canvas (ô "Cất"). */
export function holdLabels(i18n: I18n): { holdLabel: string; holdLockedLabel: string } {
  return { holdLabel: i18n.t("game.hold"), holdLockedLabel: i18n.t("game.holdLocked", { score: i18n.formatNumber(POWER_UP_RULES.stashUnlockScore) }) }
}

function moveEffectTexts(game: GameState, i18n: I18n): MoveEffectTexts {
  const move = game.lastMove!
  return {
    points: i18n.t("game.points", { points: i18n.formatNumber(move.points) }),
    combo: move.combo >= 2 ? i18n.t("game.combo", { count: move.combo }) : null,
    boardClear: move.boardCleared ? i18n.t("game.boardClear") : null,
  }
}

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
      setBlockTheme(useBlockPuzzleSettingsStore.getState().colorTheme)
      renderFrame(ctx, layout, { game, drag, effects, now, ...holdLabels(i18nRef.current) })
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

    const controller = attachPointerDragController({
      canvas,
      getLayout: () => layout,
      getGame: () => useBlockPuzzleGameStore.getState().game,
      onDragChange: (next) => {
        drag = next
        requestDraw()
      },
      onPickUp: () => {
        unlockAudio()
        sound("pick")
        haptic(8)
      },
      onDrop: (slot, row, col) => useBlockPuzzleGameStore.getState().placePiece(slot, row, col),
      onStash: (slot) => useBlockPuzzleGameStore.getState().stashPiece(slot),
      onInvalidDrop: () => sound("invalid"),
    })

    const resize = () => {
      const { width, height } = container.getBoundingClientRect()
      layout = computeLayout(width, height, window.devicePixelRatio)
      canvas.width = Math.round(width * layout.dpr)
      canvas.height = Math.round(height * layout.dpr)
      canvas.style.width = `${width}px`
      canvas.style.height = `${height}px`
      setSwapRect(layout.cellSize > 0 ? layout.swapButton : null)
      // Toạ độ snap cũ không còn đúng sau khi đổi kích thước.
      controller.cancelDrag()
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

      if (drag && (drag.slot === STASH_SLOT ? game.stash : game.tray[drag.slot])?.uid !== drag.uid) controller.cancelDrag()
      const move = game.lastMove
      if (before && move && game.moveCount === before.moveCount + 1) {
        const boardBeforeClear = [...before.board]
        for (const index of move.placedCells) boardBeforeClear[index] = move.colorId
        const texts = moveEffectTexts(game, i18nRef.current)
        effects.push(...createMoveEffects(move, boardBeforeClear, performance.now(), texts, prefersReducedMotion()))

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
        if (before && game.isGameOver && !before.isGameOver) sound("gameOver")
      }
      requestDraw()
    })
    const unsubscribeSettings = useBlockPuzzleSettingsStore.subscribe((state, prev) => {
      if (state.colorTheme !== prev.colorTheme) requestDraw()
    })

    // Một số trình duyệt mobile chỉ coi pointerup/keydown là user gesture để mở audio.
    window.addEventListener("pointerup", unlockAudio)
    window.addEventListener("keydown", unlockAudio)

    return () => {
      observer.disconnect()
      unsubscribe()
      unsubscribeSettings()
      controller.detach()
      window.removeEventListener("pointerup", unlockAudio)
      window.removeEventListener("keydown", unlockAudio)
      window.clearTimeout(gameOverTimer)
      if (frameId) cancelAnimationFrame(frameId)
    }
  }, [])

  return (
    <div ref={containerRef} className="relative min-h-0 flex-1 touch-none overscroll-none select-none">
      <canvas
        ref={canvasRef}
        role="img"
        aria-label={i18n.t("game.canvasLabel", { name: siteConfig.name })}
        className="absolute inset-0 block"
      />
      {swapRect && <TraySwapButton rect={swapRect} />}
    </div>
  )
}
