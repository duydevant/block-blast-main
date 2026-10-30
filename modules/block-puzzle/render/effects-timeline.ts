import { BOARD_SIZE, type BoardCells, type MoveResult } from "../engine/game-types"

/** Toạ độ hiệu ứng tính theo đơn vị ô, gốc là góc trên-trái bàn — đổi kích thước canvas không lệch. */
export interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  size: number
  colorId: number
}

export type GameEffect =
  | { kind: "flash"; start: number; duration: number; cells: number[] }
  | { kind: "clear"; start: number; duration: number; cells: { index: number; colorId: number }[] }
  | { kind: "particles"; start: number; duration: number; particles: Particle[] }
  | { kind: "floatText"; start: number; duration: number; text: string; x: number; y: number; scale: number }

export interface MoveEffectTexts {
  points: string
  combo: string | null
  boardClear: string | null
}

const PARTICLES_PER_CLEARED_CELL = 2
const MAX_PARTICLES = 100
export const REDUCED_CLEAR_DURATION_MS = 150

export function effectProgress(effect: GameEffect, now: number): number {
  return Math.min(1, Math.max(0, (now - effect.start) / effect.duration))
}

export function pruneEffects(effects: readonly GameEffect[], now: number): GameEffect[] {
  return effects.filter((effect) => now < effect.start + effect.duration)
}

export const easeOutCubic = (t: number) => 1 - (1 - t) ** 3

function cellCenter(index: number) {
  return { x: (index % BOARD_SIZE) + 0.5, y: Math.floor(index / BOARD_SIZE) + 0.5 }
}

/**
 * Sinh hiệu ứng cho một nước đi. `boardBeforeClear` = bàn sau khi đặt nhưng trước khi xoá,
 * để biết màu các ô bị xoá.
 */
export function createMoveEffects(
  move: MoveResult,
  boardBeforeClear: BoardCells,
  now: number,
  texts: MoveEffectTexts,
  reducedMotion: boolean,
  random: () => number = Math.random
): GameEffect[] {
  const speed = reducedMotion ? 0.5 : 1
  const effects: GameEffect[] = [{ kind: "flash", start: now, duration: 220 * speed, cells: move.placedCells }]

  if (move.clearedCells.length > 0) {
    const cells = move.clearedCells.map((index) => ({ index, colorId: boardBeforeClear[index] || 1 }))
    // Giảm chuyển động: hiệu ứng xoá ngắn hẳn (≤ 150ms), không bắn hạt.
    effects.push({ kind: "clear", start: now, duration: reducedMotion ? REDUCED_CLEAR_DURATION_MS : 380, cells })

    if (!reducedMotion) {
      const particles: Particle[] = cells
        .flatMap((cell) =>
          Array.from({ length: PARTICLES_PER_CLEARED_CELL }, () => {
            const center = cellCenter(cell.index)
            const angle = random() * Math.PI * 2
            const velocity = 2 + random() * 4
            return {
              x: center.x,
              y: center.y,
              vx: Math.cos(angle) * velocity,
              vy: Math.sin(angle) * velocity - 2,
              size: 0.12 + random() * 0.14,
              colorId: cell.colorId,
            }
          })
        )
        .slice(0, MAX_PARTICLES)
      effects.push({ kind: "particles", start: now, duration: 650, particles })
    }
  }

  const centers = move.placedCells.map(cellCenter)
  const x = centers.reduce((sum, c) => sum + c.x, 0) / centers.length
  const y = centers.reduce((sum, c) => sum + c.y, 0) / centers.length
  effects.push({ kind: "floatText", start: now, duration: 800 * speed, text: texts.points, x, y, scale: 0.6 })
  if (texts.combo) {
    effects.push({ kind: "floatText", start: now + 80, duration: 1000 * speed, text: texts.combo, x: 4, y: 3.2, scale: 0.9 })
  }
  if (texts.boardClear) {
    effects.push({ kind: "floatText", start: now + 160, duration: 1300 * speed, text: texts.boardClear, x: 4, y: 4.4, scale: 1 })
  }
  return effects
}
