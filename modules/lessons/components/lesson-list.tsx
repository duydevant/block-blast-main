"use client"

import Link from "next/link"
import { GraduationCapIcon } from "lucide-react"

import { type TranslationKey, useI18n } from "@/lib/i18n"
import { Routes } from "@/lib/routes"

import { LESSONS } from "../lesson-catalog"

/** Danh sách bài học kỹ thuật (trang cách chơi, cuối mỗi bài). `current` = bài đang mở (đánh dấu, không link). */
export function LessonList({ current }: { current?: string }) {
  const { t } = useI18n()
  return (
    <section aria-label={t("lessons.title")} className="flex flex-col gap-3">
      <h2 className="text-xl font-semibold">{t("lessons.title")}</h2>
      <p className="text-sm text-muted-foreground">{t("lessons.description")}</p>
      <ol className="grid gap-2 sm:grid-cols-2">
        {LESSONS.map((lesson, index) => {
          const title = t(`lesson.${lesson.slug}.title` as TranslationKey)
          const active = lesson.slug === current
          return (
            <li key={lesson.slug}>
              <Link
                href={`${Routes.HOW_TO_PLAY}/${lesson.slug}`}
                aria-current={active ? "page" : undefined}
                className={`flex items-center gap-2.5 rounded-2xl px-3 py-2.5 text-sm font-semibold transition hover:brightness-110 ${active ? "bg-[#ffb547] text-[#2a1600]" : "bg-card"}`}
              >
                <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-black/20 text-xs font-extrabold tabular-nums">{index + 1}</span>
                <span className="min-w-0 flex-1 truncate">{title}</span>
                <GraduationCapIcon className="size-4 shrink-0 opacity-70" aria-hidden="true" />
              </Link>
            </li>
          )
        })}
      </ol>
    </section>
  )
}
