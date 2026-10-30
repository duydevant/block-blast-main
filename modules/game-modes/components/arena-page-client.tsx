"use client"

import { useState } from "react"
import Link from "next/link"
import { CheckIcon, LockIcon, PlayIcon } from "lucide-react"

import { PageHeader } from "@/components/game-ui/page-header"
import { CoinsChip } from "@/components/game-ui/stat-chips"
import { useI18n } from "@/lib/i18n"
import { usePlayerProfileQuery } from "@/modules/player-profile/use-player-profile-query"
import { PlayerTierBadge } from "@/modules/progression/components/player-tier-badge"
import { tierRank } from "@/modules/progression/player-form-rules"

import { ARENA_LEVEL_COUNT, ARENA_TYPES, type ArenaLevelDefinition, arenaPoints, findArenaLevel, MAX_ARENA_POINTS } from "../arena-catalog"
import { useAbandonArenaRunMutation, useArenaStatusQuery } from "../use-arena-queries"
import { ArenaLevelDialog } from "./arena-level-dialog"

const LEVELS = Array.from({ length: ARENA_LEVEL_COUNT }, (_, index) => index + 1)

/** Đấu trường: lượt đang mở (chơi tiếp / bỏ), lưới 5 loại × 5 cấp (khoá theo Bậc, ✓ cấp đã qua). */
export function ArenaPageClient() {
  const { t, formatNumber } = useI18n()
  const profile = usePlayerProfileQuery().data
  const openRun = useArenaStatusQuery().data?.openRun ?? null
  const abandon = useAbandonArenaRunMutation()
  const [chosen, setChosen] = useState<ArenaLevelDefinition | null>(null)
  const cleared = profile?.arena ?? {}

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title={t("arena.title")}>{profile && <CoinsChip coins={profile.coins} />}</PageHeader>
      <p className="text-[13px] text-muted-foreground">{t("arena.description")}</p>
      {profile && (
        <p className="flex items-center gap-2 text-sm font-bold">
          <PlayerTierBadge tier={profile.tier} />
          {t("arena.points", { points: arenaPoints(cleared), max: MAX_ARENA_POINTS })}
        </p>
      )}

      {openRun && (
        <section aria-label={t("arena.openRun")} className="flex flex-col gap-2 rounded-3xl border-2 border-[#ffb547] bg-card p-4">
          <span className="font-extrabold">{t("arena.levelTitle", { type: t(`arena.type.${openRun.type}`), level: openRun.level })}</span>
          <span className="text-xs text-muted-foreground">
            {t("arena.openRunInfo", { left: openRun.attemptsLeft, time: new Date(openRun.expiresAt).toLocaleTimeString() })}
          </span>
          <div className="flex gap-2">
            <Link href={`/play?arena=${openRun.runId}`} className="flex flex-1 items-center justify-center gap-1.5 rounded-2xl bg-[#ffb547] py-2.5 font-bold text-[#2a1600]">
              <PlayIcon className="size-4" aria-hidden="true" />
              {t("arena.play")}
            </Link>
            <button onClick={() => abandon.mutate()} disabled={abandon.isPending} className="rounded-2xl bg-[#2a2459] px-4 text-sm font-bold disabled:opacity-50">
              {t("arena.abandon")}
            </button>
          </div>
        </section>
      )}

      {ARENA_TYPES.map((type) => (
        <section key={type} aria-label={t(`arena.type.${type}`)} className="flex flex-col gap-2 rounded-3xl bg-card p-3.5">
          <span className="font-extrabold">{t(`arena.type.${type}`)}</span>
          <span className="text-xs text-muted-foreground">{t(`arena.typeHint.${type}`)}</span>
          <div className="grid grid-cols-5 gap-1.5">
            {LEVELS.map((level) => {
              const definition = findArenaLevel(type, level)!
              const locked = definition.requiredTier !== null && (!profile || tierRank(profile.tier) < tierRank(definition.requiredTier))
              const done = (cleared[type] ?? 0) >= level
              return (
                <button
                  key={level}
                  disabled={locked || openRun !== null || !profile}
                  onClick={() => setChosen(definition)}
                  title={locked ? t("arena.lockedTier", { tier: t(`tier.${definition.requiredTier!}`) }) : undefined}
                  className={`flex flex-col items-center gap-0.5 rounded-2xl py-2 text-xs font-bold transition hover:brightness-110 disabled:opacity-50 ${done ? "bg-[#14403b] text-[#7fe0d6]" : "bg-[#2a2459]"}`}
                >
                  <span className="flex items-center gap-0.5 text-sm">
                    {locked ? <LockIcon className="size-3.5" aria-hidden="true" /> : done ? <CheckIcon className="size-3.5" aria-hidden="true" /> : null}L{level}
                  </span>
                  <span className="text-[10px] text-[#ffcf7a]">{formatNumber(definition.entryCoins)}</span>
                </button>
              )
            })}
          </div>
        </section>
      ))}
      {chosen && <ArenaLevelDialog definition={chosen} onClose={() => setChosen(null)} />}
    </div>
  )
}
