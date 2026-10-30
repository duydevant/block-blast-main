"use client"

import { useI18n } from "@/lib/i18n"

import type { DuelPlayer, DuelState } from "../duel-types"
import { useDuelBoard } from "../use-duel-board"
import type { VisibleEmote } from "../use-duel-emotes"
import { DuelBoardCard } from "./duel-board-card"
import { FloatingEmote } from "./duel-emote-bar"

/** Một bên: bàn trực tiếp (replay nước đi) + điểm (điểm chốt khi ván đã xong) + nhãn trạng thái. */
function PlayerBoard({ state, player, name, online, emote }: { state: DuelState; player: DuelPlayer; name: string; online: readonly string[] | null; emote: VisibleEmote | null }) {
  const { t, formatNumber } = useI18n()
  const board = useDuelBoard(state.id, state.roundKey, state.seed, player.uid)
  const finished = state.status === "finished"
  const score = state.results[player.uid] ?? board?.state.score ?? 0
  const tag = finished
    ? state.winnerUid === player.uid
      ? t("duel.winnerTag")
      : null
    : board?.state.isGameOver
      ? board.state.endedEarly
        ? t("duel.stopped")
        : t("duel.over")
      : online && !online.includes(player.uid)
        ? t("duel.offline")
        : null
  return (
    <div className="relative">
      <DuelBoardCard name={name} board={board?.state} score={formatNumber(score)} tag={tag} highlight={finished && state.winnerUid === player.uid} />
      <FloatingEmote emote={emote} className="top-1 right-1" />
    </div>
  )
}

/** Hai bàn cạnh nhau của ván hiện tại — người xem và người chơi (ở phòng) đều thấy trực tiếp, kèm emote đang hiện. */
export function DuelLiveBoards({
  state,
  nameOf,
  online,
  emoteOf = () => null,
}: {
  state: DuelState
  nameOf: (player: DuelPlayer) => string
  online: readonly string[] | null
  emoteOf?: (uid: string) => VisibleEmote | null
}) {
  if (!state.guest || state.seed === null) return null
  return (
    <div className="grid grid-cols-2 gap-2.5">
      <PlayerBoard state={state} player={state.host} name={nameOf(state.host)} online={online} emote={emoteOf(state.host.uid)} />
      <PlayerBoard state={state} player={state.guest} name={nameOf(state.guest)} online={online} emote={emoteOf(state.guest.uid)} />
    </div>
  )
}
