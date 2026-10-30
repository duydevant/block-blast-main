"use client"

import { GemIcon, ShieldIcon, SproutIcon } from "lucide-react"

import { useI18n } from "@/lib/i18n"

import type { PlayerTier } from "../player-form-rules"

/** Màu theo Bậc (vẽ bằng CSS, không ảnh). */
const TIER_STYLE: Record<PlayerTier, string> = {
  unranked: "bg-[#2f2863] text-violet-200",
  bronze: "bg-[#b26b3a] text-[#2a1406]",
  silver: "bg-[#c9d1e3] text-[#1c2236]",
  gold: "bg-[#ffcf47] text-[#2a1d00]",
  platinum: "bg-[#7fe0d6] text-[#06231f]",
  diamond: "bg-[#7ab8ff] text-[#071a33]",
  master: "bg-[#d38bff] text-[#22062f]",
}

const TIER_ICON = { unranked: SproutIcon, diamond: GemIcon, master: GemIcon } as const

/** Huy hiệu Bậc kỹ năng (theo phong độ). `compact` = chỉ icon, tên nằm trong title/aria. */
export function PlayerTierBadge({ tier, compact = false }: { tier: PlayerTier; compact?: boolean }) {
  const { t } = useI18n()
  const Icon = tier in TIER_ICON ? TIER_ICON[tier as keyof typeof TIER_ICON] : ShieldIcon
  const name = t(`tier.${tier}`)
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1 rounded-full font-bold ${TIER_STYLE[tier]} ${compact ? "p-1" : "px-2 py-0.5 text-xs"}`}
      title={`${t("form.tier")}: ${name}`}
    >
      <Icon className={compact ? "size-3" : "size-3.5"} aria-hidden="true" />
      {compact ? <span className="sr-only">{name}</span> : name}
    </span>
  )
}
