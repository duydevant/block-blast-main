"use client"

import { useI18n } from "@/lib/i18n"

import type { DuelPlayer, DuelState } from "../duel-types"

const AVATAR = "flex size-[64px] items-center justify-center rounded-full font-heading text-[28px] font-extrabold uppercase"

/**
 * Thẻ "A VS B" đầu phòng: avatar chữ cái, tên, chấm xanh khi đang online; giữa là tỉ số các ván (sau ván đầu).
 * Chưa có đối thủ → vòng nét đứt "?" + "Đang chờ…".
 */
export function DuelVersusCard({
  state,
  nameOf,
  online,
}: {
  state: DuelState
  nameOf: (player: DuelPlayer) => string
  online: readonly string[] | null
}) {
  const { t } = useI18n()
  const played = state.history.length > 0
  const side = (player: DuelPlayer, color: string) => (
    <div className="flex min-w-0 flex-col items-center gap-1.5">
      <span className={`relative ${AVATAR} ${color}`} aria-hidden="true">
        {nameOf(player).charAt(0)}
        {online?.includes(player.uid) && <span className="absolute right-0.5 bottom-0.5 size-3.5 rounded-full border-2 border-[#3d1530] bg-[#5ee6a8]" />}
      </span>
      <span className="max-w-full truncate font-extrabold">{nameOf(player)}</span>
    </div>
  )

  return (
    <section className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center rounded-3xl bg-[#3d1530] px-4 py-4">
      {side(state.host, "bg-[#ffb547] text-[#2a1600]")}
      {played && state.guest ? (
        <div className="flex flex-col items-center px-2">
          <span className="font-heading text-[34px] leading-none font-extrabold tabular-nums">
            {state.series[state.host.uid] ?? 0} – {state.series[state.guest.uid] ?? 0}
          </span>
          <span className="text-[11px] font-bold text-[#f5b3d1]">{t("duel.series")}</span>
        </div>
      ) : (
        <span className="font-heading text-3xl font-extrabold text-[#ff7eb6]">VS</span>
      )}
      {state.guest ? (
        side(state.guest, "bg-[#ff7eb6] text-[#3a0620]")
      ) : (
        <div className="flex flex-col items-center gap-1.5">
          <span className={`${AVATAR} border-[3px] border-dashed border-[#ff7eb6] text-[#ff7eb6]`} aria-hidden="true">
            ?
          </span>
          <span className="font-semibold text-[#f5b3d1]">{t("duel.waitingShort")}</span>
        </div>
      )}
    </section>
  )
}
