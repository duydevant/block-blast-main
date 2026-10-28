"use client"

import { Layers2Icon, TimerIcon, TrophyIcon, type LucideIcon } from "lucide-react"

import { type TranslationKey, useI18n } from "@/lib/i18n"

const RULES: { icon: LucideIcon; label: TranslationKey }[] = [
  { icon: TimerIcon, label: "duel.ruleTime" },
  { icon: Layers2Icon, label: "duel.ruleSame" },
  { icon: TrophyIcon, label: "duel.ruleWin" },
]

/** Luật đấu 1v1 bằng 3 ô icon (3 phút · cùng khối · điểm cao thắng). */
export function DuelRulesTiles() {
  const { t } = useI18n()
  return (
    <ul className="grid grid-cols-3 gap-2.5">
      {RULES.map(({ icon: Icon, label }) => (
        <li key={label} className="flex flex-col items-center gap-1.5 rounded-2xl bg-[#2a1226] px-1.5 py-3 text-center">
          <Icon className="size-6.5 text-[#ff7eb6]" aria-hidden="true" />
          <span className="text-[15px] leading-tight font-extrabold">{t(label)}</span>
        </li>
      ))}
    </ul>
  )
}
