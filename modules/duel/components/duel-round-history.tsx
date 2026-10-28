"use client"

import { useI18n } from "@/lib/i18n"

import type { DuelPlayer, DuelState } from "../duel-types"

/** Lịch sử các ván trong phòng (mới nhất trên cùng): điểm hai bên, bên thắng tô vàng. */
export function DuelRoundHistory({ state, nameOf }: { state: DuelState; nameOf: (player: DuelPlayer) => string }) {
  const { t, formatNumber } = useI18n()
  const guest = state.guest
  if (!guest || state.history.length === 0) return null
  const cell = (uid: string, winnerUid: string | null, score: number | undefined) => (
    <span className={`tabular-nums ${winnerUid === uid ? "font-extrabold text-[#ffcf4a]" : "text-violet-100/80"}`}>{formatNumber(score ?? 0)}</span>
  )

  return (
    <section className="flex flex-col gap-2 rounded-3xl bg-[#2a1226] p-4">
      <div className="grid grid-cols-[auto_minmax(0,1fr)_minmax(0,1fr)] gap-x-3 text-xs font-bold text-[#f5b3d1]">
        <span>{t("duel.history")}</span>
        <span className="truncate text-right">{nameOf(state.host)}</span>
        <span className="truncate text-right">{nameOf(guest)}</span>
      </div>
      <ol className="flex flex-col gap-1 text-sm">
        {[...state.history].reverse().map((item) => (
          <li key={item.round} className="grid grid-cols-[auto_minmax(0,1fr)_minmax(0,1fr)] gap-x-3 text-right">
            <span className="text-left text-violet-200/70">{t("duel.roundLabel", { round: item.round })}</span>
            {cell(state.host.uid, item.winnerUid, item.scores[state.host.uid])}
            {cell(guest.uid, item.winnerUid, item.scores[guest.uid])}
          </li>
        ))}
      </ol>
    </section>
  )
}
