"use client"

import Link from "next/link"
import { GraduationCapIcon } from "lucide-react"

import { type TranslationKey, useI18n } from "@/lib/i18n"
import { Routes } from "@/lib/routes"
import type { BoardCells } from "@/modules/block-puzzle/engine/game-types"

import { LESSON_FOR_FULL_BOARD, LESSON_FOR_HOLES } from "../lesson-catalog"

/** Bàn chiếm hơn tỉ lệ này lúc thua → gợi ý bài "Cứu bàn gần đầy". */
const FULL_BOARD_SHARE = 0.7

/** Bài học nên xem sau một ván thua, theo lỗi phân tích được (pure, test được). */
export function relatedLessonSlugs(input: { holesCreated: number; finalBoard: BoardCells | null }): string[] {
  const slugs: string[] = []
  if (input.holesCreated > 0) slugs.push(LESSON_FOR_HOLES)
  const board = input.finalBoard
  if (board && board.filter(Boolean).length / board.length > FULL_BOARD_SHARE) slugs.push(LESSON_FOR_FULL_BOARD)
  return slugs
}

/** Link sang bài học liên quan (hộp phân tích sau ván). */
export function RelatedLessonLinks({ holesCreated, finalBoard }: { holesCreated: number; finalBoard: BoardCells | null }) {
  const { t } = useI18n()
  const slugs = relatedLessonSlugs({ holesCreated, finalBoard })
  if (slugs.length === 0) return null
  return (
    <ul className="flex flex-col gap-1.5">
      {slugs.map((slug) => (
        <li key={slug}>
          <Link
            href={`${Routes.HOW_TO_PLAY}/${slug}`}
            className="flex items-center gap-1.5 text-sm font-bold text-amber-200 underline-offset-2 hover:underline"
          >
            <GraduationCapIcon className="size-4" aria-hidden="true" />
            {t("lessons.related", { title: t(`lesson.${slug}.title` as TranslationKey) })}
          </Link>
        </li>
      ))}
    </ul>
  )
}
