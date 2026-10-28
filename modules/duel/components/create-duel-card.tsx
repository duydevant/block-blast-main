"use client"

import { useRouter } from "next/navigation"
import { useState } from "react"
import { SwordsIcon } from "lucide-react"
import { toast } from "sonner"

import { MODE_THEME } from "@/components/game-ui/game-ui-classes"
import { PageHeader } from "@/components/game-ui/page-header"
import { useFirebaseAuthStore } from "@/lib/auth/firebase-auth-store"
import { useI18n } from "@/lib/i18n"
import { Routes } from "@/lib/routes"

import { createDuelRoom } from "../duel-actions"
import { DuelJoinByCode } from "./duel-join-by-code"
import { DuelRulesTiles } from "./duel-rules-tiles"

/** Trang /duel: luật bằng 3 ô icon + nút tạo phòng (rồi chuyển sang phòng để gửi link mời). */
export function CreateDuelCard() {
  const { t } = useI18n()
  const router = useRouter()
  const ready = useFirebaseAuthStore((state) => state.status === "ready")
  const [busy, setBusy] = useState(false)

  const create = async () => {
    setBusy(true)
    try {
      router.push(`${Routes.DUEL}/${(await createDuelRoom()).duelId}`)
    } catch (error) {
      console.warn("[duel] create failed", error)
      toast.error(t("duel.needsOnline"))
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title={t("duel.title")} />
      <section className={`flex flex-col items-center gap-3 rounded-3xl px-4 py-7 ${MODE_THEME.duel.card}`}>
        <SwordsIcon className="size-14 text-[#ff7eb6]" aria-hidden="true" />
        <p className={`text-center text-sm ${MODE_THEME.duel.soft}`}>{t("duel.subtitle")}</p>
      </section>
      <DuelRulesTiles />
      <button className={`${MODE_THEME.duel.button} h-16 text-[22px] [&_svg]:size-6`} disabled={!ready || busy} onClick={() => void create()}>
        <SwordsIcon aria-hidden="true" />
        {t(busy ? "duel.creating" : "duel.create")}
      </button>
      {!ready && <p className="text-center text-xs text-muted-foreground">{t("duel.needsOnline")}</p>}
      <DuelJoinByCode />
    </div>
  )
}
