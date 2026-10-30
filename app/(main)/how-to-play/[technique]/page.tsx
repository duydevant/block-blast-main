import type { Metadata } from "next"
import { notFound } from "next/navigation"

import { JsonLd } from "@/components/seo/json-ld"
import { Routes } from "@/lib/routes"
import { siteConfig } from "@/lib/site"
import { LessonPage } from "@/modules/lessons/components/lesson-page"
import { findLesson, LESSON_SLUGS } from "@/modules/lessons/lesson-catalog"
import { lessonsEn } from "@/modules/lessons/lessons-translations"

interface TechniquePageProps {
  params: Promise<{ technique: string }>
}

type LessonTextKey = keyof typeof lessonsEn
const text = (slug: string, part: "title" | "intro" | "tip") => lessonsEn[`lesson.${slug}.${part}` as LessonTextKey] ?? ""

/** 12 bài dựng tĩnh lúc build; slug lạ → 404 (không render theo yêu cầu). */
export const dynamicParams = false

export function generateStaticParams() {
  return LESSON_SLUGS.map((technique) => ({ technique }))
}

export async function generateMetadata({ params }: TechniquePageProps): Promise<Metadata> {
  const { technique } = await params
  if (!findLesson(technique)) return {}
  return {
    title: `${text(technique, "title")} — ${lessonsEn["lessons.title"]}`,
    description: `${text(technique, "intro")} ${text(technique, "tip")}`,
    alternates: { canonical: `${Routes.HOW_TO_PLAY}/${technique}` },
  }
}

/** Structured data HowTo khớp nội dung render server (tiếng Anh). */
function howToJsonLd(slug: string) {
  return {
    "@context": "https://schema.org",
    "@type": "HowTo",
    name: text(slug, "title"),
    description: text(slug, "intro"),
    url: new URL(`${Routes.HOW_TO_PLAY}/${slug}`, siteConfig.url).toString(),
    step: [
      { "@type": "HowToStep", position: 1, text: text(slug, "intro") },
      { "@type": "HowToStep", position: 2, text: text(slug, "tip") },
    ],
  }
}

export default async function TechniquePage({ params }: TechniquePageProps) {
  const { technique } = await params
  if (!findLesson(technique)) notFound()
  return (
    <>
      <JsonLd data={howToJsonLd(technique)} />
      <LessonPage slug={technique} />
    </>
  )
}
