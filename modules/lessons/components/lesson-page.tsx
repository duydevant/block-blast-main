"use client"

import { BlockBoardPreview } from "@/components/game-ui/block-board-preview"
import { PageHeader } from "@/components/game-ui/page-header"
import { type TranslationKey, useI18n } from "@/lib/i18n"
import { Routes } from "@/lib/routes"

import { findLesson } from "../lesson-catalog"
import { LessonList } from "./lesson-list"
import { LessonPlayer } from "./lesson-player"

/** Trang một bài học: tiêu đề + giải thích + mẹo (render server tiếng Anh, đổi theo ngôn ngữ), bàn minh hoạ, bàn chơi thử. */
export function LessonPage({ slug }: { slug: string }) {
  const { t } = useI18n()
  const found = findLesson(slug)
  if (!found) return null
  const key = (part: "title" | "intro" | "tip") => `lesson.${slug}.${part}` as TranslationKey

  return (
    <article className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 pt-2 pb-10">
      <PageHeader title={t(key("title"))} backHref={Routes.HOW_TO_PLAY} />
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
        <BlockBoardPreview rows={found.lesson.board} className="w-full max-w-[220px] shrink-0 self-center" cellGap={3} />
        <div className="flex flex-col gap-2 text-sm leading-relaxed">
          <p>{t(key("intro"))}</p>
          <p className="rounded-2xl bg-card p-3 font-semibold">{t(key("tip"))}</p>
        </div>
      </div>
      <LessonPlayer slug={slug} />
      <LessonList current={slug} />
    </article>
  )
}
