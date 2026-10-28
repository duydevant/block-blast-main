"use client"

import { useI18n } from "@/lib/i18n"

import type { DuelLiveScore, DuelPlayer, DuelState } from "../duel-types"

const AVATAR = "flex size-[72px] items-center justify-center rounded-full font-heading text-[32px] font-extrabold uppercase"

/**
 * Thẻ "Bạn VS đối thủ": avatar chữ cái, tên, điểm (điểm server đã kiểm tra nếu có, không thì điểm trực tiếp).
 * Chưa có đối thủ → vòng nét đứt "?" + "Đang chờ…".
 */
export function DuelVersusCard({
  state,
  live,
  nameOf,
}: {
  state: DuelState
  live: Record<string, DuelLiveScore>
  nameOf: (player: DuelPlayer) => string
}) {
  const { t, formatNumber } = useI18n()
  const scoreOf = (player: DuelPlayer) => {
    const verified = state.results[player.uid]
    if (verified !== undefined) return formatNumber(verified)
    if (state.status === "finished") return t("duel.noScore")
    return state.status === "playing" ? formatNumber(live[player.uid]?.score ?? 0) : null
  }
  const side = (player: DuelPlayer, color: string) => {
    const score = scoreOf(player)
    const won = state.status === "finished" && state.winnerUid === player.uid
    return (
      <div className="flex min-w-0 flex-col items-center gap-1.5">
        <span className={`${AVATAR} ${color} ${won ? "ring-4 ring-[#ffcf4a]" : ""}`} aria-hidden="true">
          {nameOf(player).charAt(0)}
        </span>
        <span className="max-w-full truncate font-extrabold">{nameOf(player)}</span>
        {score !== null && <span className="font-heading text-2xl leading-none font-extrabold tabular-nums">{score}</span>}
      </div>
    )
  }

  return (
    <section className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center rounded-3xl bg-[#3d1530] px-4 py-5">
      {side(state.host, "bg-[#ffb547] text-[#2a1600]")}
      <span className="font-heading text-3xl font-extrabold text-[#ff7eb6]">VS</span>
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
