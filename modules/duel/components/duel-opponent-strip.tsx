"use client"

import { useI18n } from "@/lib/i18n"
import { guestTagFromUid } from "@/modules/player-profile/player-profile-types"

import { duelRoundKey } from "../duel-types"
import { useDuelBoard } from "../use-duel-board"
import { useDuelOnline } from "../use-duel-online"
import { DuelBoardPreview } from "./duel-board-card"
import type { DuelRun } from "./duel-hud"

/** Dưới bảng điểm khi đang đấu: bàn mini trực tiếp của đối thủ + trạng thái (đang chơi / hết nước / mất kết nối). */
export function DuelOpponentStrip({ run }: { run: DuelRun }) {
  const { t } = useI18n()
  const board = useDuelBoard(run.duelId, duelRoundKey(run.round), run.seed, run.opponent.uid)
  const online = useDuelOnline(run.duelId, false)
  const name = run.opponent.name ?? t("profile.guestName", { tag: guestTagFromUid(run.opponent.uid) })
  const status = board?.state.isGameOver
    ? board.state.endedEarly
      ? t("duel.stopped")
      : t("duel.over")
    : online && !online.includes(run.opponent.uid)
      ? t("duel.offline")
      : t("duel.playing")

  return (
    <div className="mx-auto flex max-w-xs items-center gap-2.5 rounded-2xl bg-white/6 py-1 pr-3 pl-1">
      <DuelBoardPreview board={board?.state} className="w-[68px] shrink-0" />
      <div className="flex min-w-0 flex-col text-left leading-tight">
        <span className="truncate text-xs font-bold text-[#ff7eb6]">{name}</span>
        <span className="text-[11px] font-semibold text-violet-200/80">{status}</span>
      </div>
    </div>
  )
}
