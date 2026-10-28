"use client"

import { CoinsIcon, FlameIcon } from "lucide-react"

import { useI18n } from "@/lib/i18n"

import { PILL } from "./game-ui-classes"

/** Chip chuỗi ngày (lửa cam). */
export function StreakChip({ count }: { count: number }) {
  const { t, formatNumber } = useI18n()
  return (
    <span className={PILL} title={t("ui.streak")}>
      <FlameIcon className="size-4 text-[#ff8a3d]" aria-hidden="true" />
      <span className="sr-only">{t("ui.streak")}:</span>
      {formatNumber(count)}
    </span>
  )
}

/** Chip số xu. */
export function CoinsChip({ coins }: { coins: number }) {
  const { t, formatNumber } = useI18n()
  return (
    <span className={PILL} title={t("ui.coins")}>
      <CoinsIcon className="size-4 text-[#ffb547]" aria-hidden="true" />
      <span className="sr-only">{t("ui.coins")}:</span>
      {formatNumber(coins)}
    </span>
  )
}
