import { STASH_SLOT } from "@/modules/block-puzzle/engine/game-types"
import type { RecordedGameAction } from "@/modules/block-puzzle/engine/replay-recorded-game-actions"

import type { LessonDefinition } from "./lesson-rules"

const place = (slot: number, row: number, col: number): RecordedGameAction => ({ type: "PLACE_PIECE", slot, row, col })

/** Hàng caro chặn khối to / khối ngang (không có 2 ô trống liền nhau) — dùng làm "phần bàn không đặt được". */
const CHECKER_A = "6.6.6.6."
const CHECKER_B = ".6.6.6.6"
const checkerRows = (count: number) => Array.from({ length: count }, (_, row) => (row % 2 ? CHECKER_B : CHECKER_A))
const EMPTY = "........"

/**
 * 12 bài kỹ thuật (thứ tự hiển thị). Mỗi bài có lời giải mẫu; test replay lời giải qua reducer thật để chắc bài
 * nào cũng qua được. Bàn không có hàng/cột đầy sẵn.
 */
export const LESSONS: readonly LessonDefinition[] = [
  {
    slug: "keep-3x3-space",
    board: ["...66666", "...66666", "...66666", "666.6666", "6666.666", "66666.66", "666666.6", "666666.."],
    fixedTrays: [["line2-r0"], ["square3"]],
    goal: { kind: "surviveTurns", target: 2 },
    moveLimit: 2,
    solution: [place(0, 7, 6), place(0, 0, 0)],
  },
  {
    slug: "avoid-holes",
    board: [EMPTY, EMPTY, EMPTY, EMPTY, EMPTY, EMPTY, "...66666", "...66666"],
    fixedTrays: [["corner3-r1"], ["corner3-r3"]],
    goal: { kind: "lines", target: 2 },
    moveLimit: 2,
    solution: [place(0, 6, 0), place(0, 6, 1)],
  },
  {
    slug: "use-edges-and-corners",
    board: [EMPTY, EMPTY, EMPTY, EMPTY, EMPTY, EMPTY, EMPTY, EMPTY],
    fixedTrays: [["square3"], ["square3", "square3", "square3"]],
    goal: { kind: "surviveTurns", target: 4 },
    moveLimit: 4,
    solution: [place(0, 0, 0), place(0, 0, 3), place(1, 3, 0), place(2, 3, 3)],
  },
  {
    slug: "clear-two-lines",
    board: [EMPTY, EMPTY, EMPTY, EMPTY, EMPTY, EMPTY, "66666..6", "66666..6"],
    fixedTrays: [["line2-r0", "square2"]],
    goal: { kind: "lines", target: 2 },
    moveLimit: 1,
    solution: [place(1, 6, 5)],
  },
  {
    slug: "row-and-column-cross",
    board: ["....6...", "....6...", "....6...", EMPTY, "666..666", "....6...", "....6...", "....6..."],
    fixedTrays: [["corner3-r3"]],
    goal: { kind: "lines", target: 2 },
    moveLimit: 1,
    solution: [place(0, 3, 3)],
  },
  {
    slug: "keep-the-combo",
    board: [EMPTY, EMPTY, EMPTY, EMPTY, EMPTY, "666666..", "666666..", "666666.."],
    fixedTrays: [["line2-r0", "dot", "line2-r0"], ["line2-r0"]],
    goal: { kind: "combo", target: 3 },
    moveLimit: 4,
    solution: [place(0, 5, 6), place(1, 0, 0), place(2, 6, 6), place(0, 7, 6)],
  },
  {
    slug: "clear-the-board",
    board: [EMPTY, EMPTY, EMPTY, EMPTY, EMPTY, EMPTY, "666666..", "666666.."],
    fixedTrays: [["square2"]],
    goal: { kind: "boardClear", target: 1 },
    moveLimit: 1,
    solution: [place(0, 6, 6)],
  },
  {
    slug: "use-the-hold-slot",
    board: [...checkerRows(5), "666666..", "666666..", "666666.."],
    fixedTrays: [["square3", "line2-r0", "line2-r0"], ["line2-r0"]],
    goal: { kind: "surviveTurns", target: 4 },
    moveLimit: 4,
    stashUnlocked: true,
    solution: [{ type: "STASH_PIECE", slot: 0 }, place(1, 6, 6), place(2, 7, 6), place(0, 5, 6), place(STASH_SLOT, 5, 0)],
  },
  {
    slug: "when-to-swap",
    board: [...checkerRows(7), "666666.."],
    fixedTrays: [["square3", "square3", "square3"], ["line2-r0"]],
    goal: { kind: "lines", target: 1 },
    moveLimit: 1,
    replaceCharges: 1,
    solution: [{ type: "REPLACE_TRAY" }, place(0, 7, 6)],
  },
  {
    slug: "piece-order",
    board: [...checkerRows(7), "66666..."],
    fixedTrays: [["line5-r0", "line3-r0"]],
    goal: { kind: "surviveTurns", target: 2 },
    moveLimit: 2,
    solution: [place(1, 7, 5), place(0, 7, 0)],
  },
  {
    slug: "save-room-for-long-lines",
    board: [...checkerRows(7), EMPTY],
    fixedTrays: [["line3-r0"], ["line5-r0"]],
    goal: { kind: "lines", target: 1 },
    moveLimit: 2,
    solution: [place(0, 7, 0), place(0, 7, 3)],
  },
  {
    slug: "rescue-a-full-board",
    board: ["66.66.66", ".66.66.6", "6.66.66.", "66.66.66", "666666..", "666666..", "666666..", "666666.."],
    fixedTrays: [["square2", "square2"]],
    goal: { kind: "lines", target: 4 },
    moveLimit: 2,
    solution: [place(0, 4, 6), place(1, 6, 6)],
  },
]

export const LESSON_SLUGS = LESSONS.map((lesson) => lesson.slug)

/** Bài + vị trí (seed màu theo vị trí); slug lạ → undefined. */
export function findLesson(slug: string): { lesson: LessonDefinition; index: number } | undefined {
  const index = LESSONS.findIndex((lesson) => lesson.slug === slug)
  return index === -1 ? undefined : { lesson: LESSONS[index], index }
}

/** Bài liên quan khi phân tích sau ván phát hiện lỗi điển hình. */
export const LESSON_FOR_HOLES = "avoid-holes"
export const LESSON_FOR_FULL_BOARD = "rescue-a-full-board"

/** Xu thưởng lần đầu qua một bài (server xác minh bằng replay). */
export const COINS_PER_LESSON = 20
