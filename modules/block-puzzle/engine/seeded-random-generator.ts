/**
 * PRNG mulberry32 dạng thuần: nhận state, trả [giá trị, state mới].
 * State là số nguyên không dấu 32-bit nên serialize thẳng vào save game.
 */
export function nextRandom(state: number): [value: number, nextState: number] {
  const nextState = (state + 0x6d2b79f5) >>> 0
  let t = nextState
  t = Math.imul(t ^ (t >>> 15), t | 1)
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
  const value = ((t ^ (t >>> 14)) >>> 0) / 4294967296
  return [value, nextState]
}

/** Số nguyên trong [0, maxExclusive). */
export function nextRandomInt(state: number, maxExclusive: number): [value: number, nextState: number] {
  const [value, nextState] = nextRandom(state)
  return [Math.floor(value * maxExclusive), nextState]
}

export function normalizeSeed(seed: number): number {
  return Math.trunc(seed) >>> 0
}
