"use client"

import { HeartIcon, InboxIcon, ShuffleIcon, type LucideIcon } from "lucide-react"

import { type TranslationKey, useI18n } from "@/lib/i18n"

import { BlockBoardPreview } from "./block-board-preview"

/** 3 bước minh hoạ bằng bàn mini 5×5 ("+" = chỗ thả khối, "*" = hàng đang xoá). */
const STEPS: { title: TranslationKey; hint: TranslationKey; rows: string[] }[] = [
  { title: "howto.step1", hint: "howto.step1Sub", rows: [".....", ".....", ".++..", ".+...", "33..7"] },
  { title: "howto.step2", hint: "howto.step2Sub", rows: [".....", "..5..", "*****", "..5..", "....."] },
  { title: "howto.step3", hint: "howto.step3Sub", rows: ["*****", "..2..", "*****", ".....", "7...3"] },
]

const POWERS: { icon: LucideIcon; title: TranslationKey; hint: TranslationKey }[] = [
  { icon: InboxIcon, title: "howto.hold", hint: "howto.holdSub" },
  { icon: ShuffleIcon, title: "howto.swap", hint: "howto.swapSub" },
  { icon: HeartIcon, title: "howto.continue", hint: "howto.continueSub" },
]

/** Cách chơi bằng hình: dùng chung cho hộp "Cách chơi" trong game và trang /how-to-play. */
export function HowToPlayVisual() {
  const { t } = useI18n()
  return (
    <div className="flex flex-col gap-3 text-left">
      <ol className="flex flex-col gap-2.5">
        {STEPS.map((step, index) => (
          <li key={step.title} className="flex items-center gap-4 rounded-3xl bg-[#2a2459]/70 p-3">
            <BlockBoardPreview rows={step.rows} cellGap={3} className="w-[104px] shrink-0 p-1.5" />
            <div className="flex flex-col gap-1">
              <span className="flex size-7 items-center justify-center rounded-full bg-[#ffb547] text-sm font-extrabold text-[#2a1600]">{index + 1}</span>
              <span className="font-heading text-[19px] leading-tight font-extrabold text-white">{t(step.title)}</span>
              <span className="text-[13px] text-violet-200/80">{t(step.hint)}</span>
            </div>
          </li>
        ))}
      </ol>
      <ul className="grid grid-cols-3 gap-2">
        {POWERS.map(({ icon: Icon, title, hint }) => (
          <li key={title} className="flex flex-col items-center gap-1 rounded-2xl bg-[#2a2459]/70 px-1.5 py-3 text-center">
            <Icon className="size-6 text-violet-200" aria-hidden="true" />
            <span className="text-sm font-extrabold text-white">{t(title)}</span>
            <span className="text-[11px] text-violet-200/80">{t(hint)}</span>
          </li>
        ))}
      </ul>
      <p className="text-center text-[13px] text-violet-200/80">{t("howto.gameOver")}</p>
    </div>
  )
}
