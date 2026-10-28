"use client"

import Link from "next/link"
import { PlayIcon } from "lucide-react"

import { HowToPlayVisual } from "@/components/game-ui/how-to-play-visual"
import { Button } from "@/components/ui/button"
import { type TranslationKey, useI18n } from "@/lib/i18n"
import { Routes } from "@/lib/routes"

import { HOW_TO_PLAY_FAQ } from "../how-to-play-translations"

/** Mục: tiêu đề + danh sách gạch đầu dòng theo key `${prefix}1..n`. */
const SECTIONS: { title: TranslationKey; items: TranslationKey[] }[] = [
  { title: "guide.rulesTitle", items: ["guide.rule1", "guide.rule2", "guide.rule3", "guide.rule4"] },
  { title: "guide.scoringTitle", items: ["guide.scoring1", "guide.scoring2", "guide.scoring3"] },
  { title: "guide.powerTitle", items: ["guide.power1", "guide.power2", "guide.power3"] },
  { title: "guide.dailyTitle", items: ["guide.daily1", "guide.daily2"] },
  { title: "guide.tipsTitle", items: ["guide.tip1", "guide.tip2", "guide.tip3", "guide.tip4"] },
]

/** Nội dung trang hướng dẫn; render server bằng tiếng Anh rồi đổi theo ngôn ngữ người dùng như các trang khác. */
export function HowToPlayGuide() {
  const { t } = useI18n()
  return (
    <article className="mx-auto flex max-w-2xl flex-col gap-8 px-4 py-10">
      <header className="flex flex-col gap-3">
        <h1 className="text-3xl font-bold tracking-tight">{t("guide.title")}</h1>
        <p className="text-muted-foreground">{t("guide.intro")}</p>
        <Button className="self-start" nativeButton={false} render={<Link href={Routes.PLAY} />}>
          <PlayIcon data-icon="inline-start" />
          {t("guide.play")}
        </Button>
      </header>

      <div className="rounded-3xl bg-card p-3">
        <HowToPlayVisual />
      </div>

      {SECTIONS.map((section) => (
        <section key={section.title} className="flex flex-col gap-3">
          <h2 className="text-xl font-semibold">{t(section.title)}</h2>
          <ul className="list-disc space-y-2 pl-5 text-sm leading-relaxed">
            {section.items.map((item) => (
              <li key={item}>{t(item)}</li>
            ))}
          </ul>
        </section>
      ))}

      <section className="flex flex-col gap-3">
        <h2 className="text-xl font-semibold">{t("guide.faqTitle")}</h2>
        <dl className="flex flex-col gap-4 text-sm">
          {HOW_TO_PLAY_FAQ.map((index) => (
            <div key={index}>
              <dt className="font-semibold">{t(`guide.faq${index}q`)}</dt>
              <dd className="mt-1 text-muted-foreground">{t(`guide.faq${index}a`)}</dd>
            </div>
          ))}
        </dl>
      </section>
    </article>
  )
}
