/** Classic bag geometry indices, retaining multiplicities and orientations.
 * Behavioral reference: local build ef6cb1bf, scripts/pools_catalog.luac.lua.
 */
export const CLASSIC_POOLS: readonly (readonly number[])[] = [
  [5,17,17,29,29,34,58,16,40,5,8,12,4,12,59,57],
  [12,41,16,16,16,4,4,29,21,23,5,29,4,56,12],
  [28,28,12,16,16,11,16,40,11,11,32,44,0,0,51,24,16,11],
  [12,29,12,41,59,53,29,41,10,27,41,17,53,17],
  [53,41,41,29], [52,40,40,28],
  [35,20,16,40,29,40,4,21,16,4,22,57,11,29,17,58,16],
  [45,44,20,16,16,5,12,48,32,33,4,12,10,5,16,16,5,16,56,12],
  [0,49,59,16,9,11,0,24,4,23,5,29,12,11,17,11,17,56,9,5,5],
  [4,59,22,24,24,9,11,40,8,59,44,10,29,56,20,12,4],
  [0],
]

/** The second threshold uses a fresh roll. Bags are shuffled with Fisher-Yates. */
export function selectPoolQueue(score: number, random: () => number): number[] {
  let queue: number[]
  if (score < 100) queue = [7,9,10,11,11]
  else if (score < 800) {
    queue = random() < 0.33 ? [1,8,7,6,10,11,11]
      : random() < 0.66 ? [2,8,9,3,5,10,11,11] : [4,8,9,3,6,10,11,11]
  } else {
    queue = random() < 0.33 ? [1,4,8,7,6,10,11,11]
      : random() < 0.66 ? [1,2,8,9,3,5,10,11,11] : [1,2,4,8,9,3,6,10,11,11]
  }
  for (let i = queue.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1))
    ;[queue[i], queue[j]] = [queue[j], queue[i]]
  }
  return queue
}

/** Analysis helper budget; production dealing uses the classic selector. */
export const TRAY_GENERATOR_CONFIG = { solvabilitySearchBudget: 6000 } as const
