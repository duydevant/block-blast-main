"use client"

import { useRouter } from "next/navigation"
import { CoinsIcon } from "lucide-react"
import { toast } from "sonner"

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { ApiRequestError } from "@/lib/firebase/fetch-json-with-firebase-id-token"
import { type TranslationKey, useI18n } from "@/lib/i18n"

import type { ArenaLevelDefinition } from "../arena-catalog"
import { useStartArenaRunMutation } from "../use-arena-queries"

/** Mô tả điều kiện một cấp: mục tiêu, số lần thử / ván, giờ, hạn lượt. */
export function arenaRulesText(t: (key: TranslationKey, values?: Record<string, string | number>) => string, formatNumber: (value: number) => string, definition: ArenaLevelDefinition) {
  const goal = t(`arena.goalShort.${definition.goal.kind}`, { target: formatNumber(definition.goal.target) })
  const parts = [goal]
  if (definition.attemptTimeMs !== null) parts.push(t("arena.rule.time", { minutes: definition.attemptTimeMs / 60_000 }))
  if (definition.variant.noPowerUps) parts.push(t("arena.rule.pure"))
  if (definition.variant.moveLimit) parts.push(t("arena.rule.moves", { moves: definition.variant.moveLimit }))
  parts.push(definition.type === "endurance" ? t("arena.rule.games", { games: definition.attempts }) : t("arena.rule.attempts", { attempts: definition.attempts }))
  parts.push(t("arena.rule.window", { hours: Math.round((definition.windowMs / 3_600_000) * 10) / 10 }))
  return parts.join(" · ")
}

/** Xác nhận mở lượt: điều kiện + phí + thưởng → trừ xu → vào chơi lần thử đầu. */
export function ArenaLevelDialog({ definition, onClose }: { definition: ArenaLevelDefinition; onClose: () => void }) {
  const { t, formatNumber } = useI18n()
  const router = useRouter()
  const start = useStartArenaRunMutation()

  const confirm = () =>
    start.mutate(
      { type: definition.type, level: definition.level },
      {
        onSuccess: (run) => router.push(`/play?arena=${run.runId}`),
        onError: (error) => {
          const code = error instanceof ApiRequestError ? error.code : ""
          const known = ["not-enough-coins", "tier-locked", "run-open"].includes(code ?? "")
          toast.error(t(known ? (`arena.error.${code}` as TranslationKey) : "arena.startFailed"))
          onClose()
        },
      }
    )

  return (
    <AlertDialog open onOpenChange={(open) => !open && onClose()}>
      <AlertDialogContent size="sm">
        <AlertDialogHeader>
          <AlertDialogTitle>{t("arena.levelTitle", { type: t(`arena.type.${definition.type}`), level: definition.level })}</AlertDialogTitle>
          <AlertDialogDescription>{arenaRulesText(t, formatNumber, definition)}</AlertDialogDescription>
        </AlertDialogHeader>
        <p className="flex items-center justify-center gap-3 text-sm font-bold">
          <span className="flex items-center gap-1">
            {t("arena.fee")} <CoinsIcon className="size-4 text-[#ffb547]" aria-hidden="true" /> {formatNumber(definition.entryCoins)}
          </span>
          <span className="flex items-center gap-1 text-[#2ec4b6]">
            {t("arena.reward")} <CoinsIcon className="size-4 text-[#ffb547]" aria-hidden="true" /> {formatNumber(definition.rewardCoins)} · +{definition.rewardXp} XP
          </span>
        </p>
        <AlertDialogFooter>
          <AlertDialogCancel>{t("arena.cancel")}</AlertDialogCancel>
          <AlertDialogAction onClick={confirm} disabled={start.isPending}>
            {t("arena.start")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
