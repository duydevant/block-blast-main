"use client"

import { useEffect, useMemo } from "react"
import Link from "next/link"
import { PauseIcon, PlayIcon, SkipBackIcon, SkipForwardIcon, StepBackIcon, StepForwardIcon } from "lucide-react"

import { PageHeader } from "@/components/game-ui/page-header"
import { useI18n } from "@/lib/i18n"
import { Routes } from "@/lib/routes"
import { gameModeLabel } from "@/modules/player-profile/components/game-mode-label"
import { PlayerTierBadge } from "@/modules/progression/components/player-tier-badge"

import { buildReplayTimeline } from "../replay-timeline"
import { type GameReplayResponse, replayStartFor } from "../replay-types"
import { REPLAY_SPEEDS, useReplayPlayer } from "../use-replay-player"
import { ReplayBoardCanvas } from "./replay-board-canvas"
import { ReplayReportButton } from "./replay-report-button"

const ICON_BUTTON = "flex size-11 items-center justify-center rounded-2xl bg-card hover:brightness-125 disabled:opacity-40"

/** Trang xem lại ván: bàn + điều khiển phát lại + thông tin nước hiện tại. Phím ← → bước, Space phát/dừng. */
export function ReplayViewer({ replay }: { replay: GameReplayResponse }) {
  const { t, formatNumber } = useI18n()
  const timeline = useMemo(() => buildReplayTimeline(replayStartFor(replay), replay.actions), [replay])
  const lastIndex = timeline.states.length - 1
  const player = useReplayPlayer(lastIndex)
  const game = timeline.states[player.index]
  const name = replay.displayName ?? t("profile.guestName", { tag: replay.guestTag })
  const { step, toggle } = player

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLInputElement) return
      if (event.key === "ArrowLeft") step(-1)
      else if (event.key === "ArrowRight") step(1)
      else if (event.key === " ") toggle()
      else return
      event.preventDefault()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [step, toggle])

  return (
    <div className="flex flex-col gap-3">
      <PageHeader title={t("replay.title")} backHref={Routes.LEADERBOARD} />
      <div className="flex items-center gap-2 text-sm">
        {replay.playerTag ? (
          <Link href={`${Routes.PLAYER}/${replay.playerTag}`} className="font-bold underline-offset-2 hover:underline">
            {name}
          </Link>
        ) : (
          <span className="font-bold">{name}</span>
        )}
        {replay.tier && <PlayerTierBadge tier={replay.tier} compact />}
        <span className="text-muted-foreground">· {gameModeLabel(t, replay.mode, replay.levelId)}</span>
        <span className="ml-auto font-heading text-xl font-extrabold tabular-nums">{formatNumber(replay.score)}</span>
      </div>
      <div className="flex justify-center">
        <ReplayBoardCanvas game={game} label={t("replay.boardLabel", { move: player.index, total: lastIndex, score: formatNumber(game.score) })} />
      </div>
      <dl className="grid grid-cols-3 gap-2 text-center text-xs">
        {[
          [t("replay.move"), `${formatNumber(player.index)}/${formatNumber(lastIndex)}`],
          [t("replay.score"), formatNumber(game.score)],
          [t("replay.combo"), game.combo > 1 ? `x${game.combo}` : "–"],
        ].map(([label, value]) => (
          <div key={label} className="flex flex-col-reverse rounded-2xl bg-card py-2">
            <dt className="text-muted-foreground">{label}</dt>
            <dd className="text-base font-extrabold tabular-nums">{value}</dd>
          </div>
        ))}
      </dl>
      <input
        type="range"
        min={0}
        max={lastIndex}
        value={player.index}
        onChange={(event) => player.seek(Number(event.target.value))}
        aria-label={t("replay.seek")}
        className="w-full accent-[#ffb547]"
      />
      <div className="flex items-center justify-center gap-2">
        <button className={ICON_BUTTON} onClick={() => player.seek(0)} disabled={player.index === 0} aria-label={t("replay.start")}>
          <SkipBackIcon className="size-5" aria-hidden="true" />
        </button>
        <button className={ICON_BUTTON} onClick={() => player.step(-1)} disabled={player.index === 0} aria-label={t("replay.prev")}>
          <StepBackIcon className="size-5" aria-hidden="true" />
        </button>
        <button className={`${ICON_BUTTON} size-14 bg-[#ffb547] text-[#2a1600]`} onClick={player.toggle} aria-label={t(player.playing ? "replay.pause" : "replay.play")}>
          {player.playing ? <PauseIcon className="size-6" aria-hidden="true" /> : <PlayIcon className="size-6" aria-hidden="true" />}
        </button>
        <button className={ICON_BUTTON} onClick={() => player.step(1)} disabled={player.index === lastIndex} aria-label={t("replay.next")}>
          <StepForwardIcon className="size-5" aria-hidden="true" />
        </button>
        <button className={ICON_BUTTON} onClick={() => player.seek(lastIndex)} disabled={player.index === lastIndex} aria-label={t("replay.end")}>
          <SkipForwardIcon className="size-5" aria-hidden="true" />
        </button>
      </div>
      <div role="group" aria-label={t("replay.speed")} className="flex justify-center gap-2">
        {REPLAY_SPEEDS.map((speed) => (
          <button
            key={speed}
            aria-pressed={player.speed === speed}
            onClick={() => player.setSpeed(speed)}
            className={`rounded-full px-3 py-1 text-xs font-bold ${player.speed === speed ? "bg-[#ffb547] text-[#2a1600]" : "bg-card"}`}
          >
            ×{speed}
          </button>
        ))}
      </div>
      {timeline.brokenAt !== null && <p className="text-center text-xs text-destructive">{t("replay.broken")}</p>}
      <ReplayReportButton replayId={replay.id} />
    </div>
  )
}
