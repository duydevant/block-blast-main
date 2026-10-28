"use client"

import { useState } from "react"
import { CheckIcon, RotateCcwIcon } from "lucide-react"
import { toast } from "sonner"

import { MODE_THEME } from "@/components/game-ui/game-ui-classes"
import { ApiRequestError } from "@/lib/firebase/fetch-json-with-firebase-id-token"
import { useI18n } from "@/lib/i18n"

import { setDuelReady } from "../duel-actions"
import type { DuelPlayer, DuelState, DuelStateResponse } from "../duel-types"

const theme = MODE_THEME.duel

/**
 * Ván vừa xong trong phòng: ai thắng + vì sao; người chơi bấm "Sẵn sàng" (đủ hai người → ván mới cùng phòng),
 * người xem thấy ai đã sẵn sàng.
 */
export function DuelRoundFinished({
  state,
  uid,
  nameOf,
  onState,
}: {
  state: DuelState
  uid: string | null
  nameOf: (player: DuelPlayer) => string
  onState: (response: DuelStateResponse) => void
}) {
  const { t } = useI18n()
  const [busy, setBusy] = useState(false)
  const guest = state.guest
  if (!guest) return null
  const isMember = uid === state.host.uid || uid === guest.uid
  const opponent = uid === state.host.uid ? guest : state.host
  const winner = state.winnerUid === state.host.uid ? state.host : state.winnerUid === guest.uid ? guest : null
  const headline = winner === null ? t("duel.draw") : isMember ? (winner.uid === uid ? t("duel.won") : t("duel.lost")) : t("duel.playerWon", { name: nameOf(winner) })
  const meReady = uid !== null && state.ready.includes(uid)
  const opponentReady = state.ready.includes(opponent.uid)

  const toggleReady = async () => {
    setBusy(true)
    try {
      onState(await setDuelReady(state.id, !meReady))
    } catch (error) {
      console.warn("[duel] ready failed", error)
      toast.error(t(error instanceof ApiRequestError && error.code === "duel-expired" ? "duel.expired" : "duel.joinFailed"))
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="flex flex-col items-center gap-3 rounded-3xl bg-[#2a1226] p-5 text-center">
      <span className="font-heading text-[32px] leading-none font-extrabold">{headline}</span>
      {state.endReason && <span className={`text-sm font-semibold ${theme.soft}`}>{t(`duel.reason.${state.endReason}`)}</span>}
      {isMember ? (
        <>
          <button
            className={`${meReady ? "bg-[#2a2459] text-white" : ""} ${theme.button} h-14 w-full text-xl`}
            disabled={busy}
            onClick={() => void toggleReady()}
          >
            {meReady ? <CheckIcon aria-hidden="true" /> : <RotateCcwIcon aria-hidden="true" />}
            {meReady ? t("duel.unready") : t("duel.ready")}
          </button>
          <span className={`text-sm font-semibold ${opponentReady ? "text-[#5ee6a8]" : theme.soft}`} aria-live="polite">
            {opponentReady ? t("duel.opponentReady", { name: nameOf(opponent) }) : t("duel.waitReady", { name: nameOf(opponent) })}
          </span>
        </>
      ) : (
        <span className={`text-sm font-semibold ${theme.soft}`}>
          {t("duel.readyCount", { count: state.ready.length })}
        </span>
      )}
    </section>
  )
}
