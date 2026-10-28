import type { CellOffset, ShapeDef } from "./game-types"

interface ShapeFamily {
  id: string
  /** Hình vẽ bằng "#" (ô có khối) và "." (trống). */
  pattern: string[]
  weight: number
  tier: ShapeDef["tier"]
}

/** Bộ khối polyomino chung của thể loại; tự sinh đủ các hướng xoay. */
const SHAPE_FAMILIES: ShapeFamily[] = [
  { id: "dot", pattern: ["#"], weight: 1, tier: 1 },
  { id: "diagonal2", pattern: ["#.", ".#"], weight: 1, tier: 1 },
  { id: "line2", pattern: ["##"], weight: 3, tier: 1 },
  { id: "line3", pattern: ["###"], weight: 3, tier: 1 },
  { id: "line4", pattern: ["####"], weight: 2, tier: 2 },
  { id: "line5", pattern: ["#####"], weight: 1.5, tier: 3 },
  { id: "square2", pattern: ["##", "##"], weight: 3, tier: 1 },
  { id: "square3", pattern: ["###", "###", "###"], weight: 1, tier: 3 },
  { id: "rect2x3", pattern: ["###", "###"], weight: 1.5, tier: 2 },
  { id: "corner3", pattern: ["#.", "##"], weight: 3, tier: 1 },
  { id: "ell4", pattern: ["#.", "#.", "##"], weight: 1.5, tier: 2 },
  { id: "jay4", pattern: [".#", ".#", "##"], weight: 1.5, tier: 2 },
  { id: "tee4", pattern: ["###", ".#."], weight: 2, tier: 2 },
  { id: "ess4", pattern: [".##", "##."], weight: 1.5, tier: 2 },
  { id: "zed4", pattern: ["##.", ".##"], weight: 1.5, tier: 2 },
  { id: "corner5", pattern: ["#..", "#..", "###"], weight: 1.5, tier: 3 },
]

function rotateClockwise(pattern: string[]): string[] {
  const height = pattern.length
  const width = pattern[0].length
  return Array.from({ length: width }, (_, col) =>
    Array.from({ length: height }, (_, row) => pattern[height - 1 - row][col]).join("")
  )
}

function patternToCells(pattern: string[]): CellOffset[] {
  return pattern.flatMap((line, row) =>
    [...line].flatMap((char, col) => (char === "#" ? [[row, col] as const] : []))
  )
}

function uniqueRotations(pattern: string[]): string[][] {
  const seen = new Set<string>()
  const result: string[][] = []
  let current = pattern
  for (let i = 0; i < 4; i++) {
    const key = current.join("/")
    if (!seen.has(key)) {
      seen.add(key)
      result.push(current)
    }
    current = rotateClockwise(current)
  }
  return result
}

function buildCatalog(): ShapeDef[] {
  return SHAPE_FAMILIES.flatMap((family) => {
    const rotations = uniqueRotations(family.pattern)
    // Freeze vì catalog dùng chung cho mọi ván, không cho caller sửa.
    return rotations.map((pattern, index) =>
      Object.freeze({
        id: rotations.length > 1 ? `${family.id}-r${index}` : family.id,
        family: family.id,
        cells: Object.freeze(patternToCells(pattern).map((cell) => Object.freeze(cell))),
        width: pattern[0].length,
        height: pattern.length,
        weight: family.weight / rotations.length,
        tier: family.tier,
      })
    )
  })
}

export const SHAPE_CATALOG: readonly ShapeDef[] = buildCatalog()

const SHAPES_BY_ID = new Map(SHAPE_CATALOG.map((shape) => [shape.id, shape]))

export function findShape(shapeId: string): ShapeDef | undefined {
  return SHAPES_BY_ID.get(shapeId)
}
