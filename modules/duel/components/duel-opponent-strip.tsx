"use client"

import { useI18n } from "@/lib/i18n"
import { guestTagFromUid } from "@/modules/player-profile/player-profile-types"
import { useSignedInUid } from "@/modules/player-profile/use-player-profile-query"

import { duelRoundKey } from "../duel-types"
import { useDuelBoard } from "../use-duel-board"
import { useDuelEmotes } from "../use-duel-emotes"
import { useDuelOnline } from "../use-duel-online"
import { DuelBoardPreview } from "./duel-board-card"
import { DuelEmoteBar, FloatingEmote, useEmoteLookup } from "./duel-emote-bar"
import type { DuelRun } from "./duel-hud"

/** Dưới bảng điểm khi đang đấu: bàn mini trực tiếp của đối thủ + trạng thái (đang chơi / hết nước / mất kết nối) + emote. */
export function DuelOpponentStrip({ run }: { run: DuelRun }) {
  const { t } = useI18n()
  const board = useDuelBoard(run.duelId, duelRoundKey(run.round), run.seed, run.opponent.uid, run.rulesVersion)
  const online = useDuelOnline(run.duelId, false)
  const myUid = useSignedInUid()
  const emotes = useDuelEmotes(run.duelId)
  const emoteOf = useEmoteLookup(emotes, myUid)
  const name = run.opponent.name ?? t("profile.guestName", { tag: guestTagFromUid(run.opponent.uid) })
  const status = board?.state.isGameOver
    ? board.state.endedEarly
      ? t("duel.stopped")
      : t("duel.over")
    : online && !online.includes(run.opponent.uid)
      ? t("duel.offline")
      : t("duel.playing")

  return (
    <div className="mx-auto flex max-w-xs flex-col items-center gap-1">
      <div className="relative flex w-full items-center gap-2.5 rounded-2xl bg-white/6 py-1 pr-3 pl-1">
        <DuelBoardPreview board={board?.state} className="w-[68px] shrink-0" />
        <div className="flex min-w-0 flex-col text-left leading-tight">
          <span className="truncate text-xs font-bold text-[#ff7eb6]">{name}</span>
          <span className="text-[11px] font-semibold text-violet-200/80">{status}</span>
        </div>
        <FloatingEmote emote={emoteOf(run.opponent.uid)} className="-top-3 left-12" />
        <FloatingEmote emote={emoteOf(myUid ?? undefined)} className="-top-3 right-1" />
      </div>
      <DuelEmoteBar emotes={emotes} />
    </div>
  )
}
