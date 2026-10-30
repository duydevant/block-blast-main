"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { DoorOpenIcon, RotateCcwIcon, SwordsIcon } from "lucide-react"
import { toast } from "sonner"

import { CHUNKY_BUTTON, MODE_THEME } from "@/components/game-ui/game-ui-classes"
import { AlertDialog, AlertDialogContent, AlertDialogDescription, AlertDialogTitle } from "@/components/ui/alert-dialog"
import { useI18n } from "@/lib/i18n"
import { Routes } from "@/lib/routes"
import { GAME_PANEL } from "@/modules/block-puzzle/components/game-ui-styles"
import { enterMode } from "@/modules/block-puzzle/special-game-modes"
import { useBlockPuzzleGameStore } from "@/modules/block-puzzle/store/block-puzzle-game-store"
import { guestTagFromUid } from "@/modules/player-profile/player-profile-types"
import { useSignedInUid } from "@/modules/player-profile/use-player-profile-query"

import { setDuelReady } from "../duel-actions"
import { duelRoundKey } from "../duel-types"
import { useDuelBoard } from "../use-duel-board"
import { useDuelMatch } from "../use-duel-match"
import { DuelBoardCard } from "./duel-board-card"
import { type DuelRun, formatDuelClock } from "./duel-hud"

/** Chờ hiệu ứng xoá dòng cuối chạy xong rồi mới hiện (như hộp hết ván thường). */
const REVEAL_DELAY_MS = 900
const theme = MODE_THEME.duel
const BUTTON = "h-14 w-full text-xl"

/**
 * Hết ván trong trận đấu 1v1 (chết / hết giờ / bỏ trận): thay hộp hết ván thường — không hồi sinh, không ván mới
 * khi ván đấu chưa xong. Đối thủ còn chơi thì xem bàn trực tiếp của họ tới khi họ hết nước, vượt điểm mình hoặc
 * hết 3 phút; có kết quả thì thắng/thua + sẵn sàng đấu lại cùng phòng.
 */
export function DuelGameOverPanel({ run }: { run: DuelRun }) {
  const { t, formatNumber } = useI18n()
  const router = useRouter()
  const uid = useSignedInUid()
  const over = useBlockPuzzleGameStore((state) => state.game?.isGameOver ?? false)
  const myLocalScore = useBlockPuzzleGameStore((state) => state.game?.score ?? 0)
  const endedEarly = useBlockPuzzleGameStore((state) => state.game?.endedEarly ?? false)
  const { state, now } = useDuelMatch(run.duelId, run.clockOffset)
  const opponentBoard = useDuelBoard(run.duelId, duelRoundKey(run.round), run.seed, run.opponent.uid, run.rulesVersion)
  // Key theo ván: ván đấu mới không thừa hưởng trạng thái "đã hiện" của ván trước.
  const overKey = over ? `${run.duelId}:${run.round}` : null
  const [revealedKey, setRevealedKey] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!overKey) return
    const timer = window.setTimeout(() => setRevealedKey(overKey), REVEAL_DELAY_MS)
    return () => window.clearTimeout(timer)
  }, [overKey])

  const opponentUid = run.opponent.uid
  const opponentName = run.opponent.name ?? t("profile.guestName", { tag: guestTagFromUid(opponentUid) })
  // Ván hiện tại của phòng đã sang ván sau (người kia vào trước) → ván này coi như đã xong.
  const roundState = state && state.round === run.round ? state : null
  const finished = roundState?.status === "finished" || (state ? state.round > run.round : false)
  const myScore = (uid ? roundState?.results[uid] : undefined) ?? myLocalScore
  const opponentScore = roundState?.results[opponentUid] ?? opponentBoard?.state.score ?? 0
  const opponentDone = Boolean(opponentBoard?.state.isGameOver) || now >= run.endsAt
  const winnerUid = roundState?.status === "finished" ? roundState.winnerUid : null
  const gap = myScore - opponentScore

  const rematch = async () => {
    setBusy(true)
    try {
      if (state?.round === run.round) await setDuelReady(run.duelId, true)
      router.push(`${Routes.DUEL}/${run.duelId}`)
    } catch (error) {
      console.warn("[duel] ready failed", error)
      toast.error(t("duel.joinFailed"))
      setBusy(false)
    }
  }

  const title = finished
    ? winnerUid === null
      ? t("duel.draw")
      : winnerUid === uid
        ? t("duel.won")
        : t("duel.lost")
    : now >= run.endsAt
      ? t("duel.timeUp")
      : endedEarly
        ? t("duel.youLeft")
        : t("duel.youAreOut")
  const status = finished
    ? roundState?.endReason
      ? t(`duel.reason.${roundState.endReason}`)
      : null
    : opponentDone
      ? t("duel.settling")
      : t("duel.waitOpponent", { name: opponentName, time: formatDuelClock(run.endsAt - now) })

  return (
    <AlertDialog open={overKey !== null && revealedKey === overKey}>
      <AlertDialogContent className={GAME_PANEL + " flex max-h-[92dvh] flex-col items-center gap-3 overflow-y-auto p-5 text-center"}>
        <span className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-extrabold ${theme.icon}`}>
          <SwordsIcon className="size-4" aria-hidden="true" />
          {t("duel.title")}
        </span>
        <AlertDialogTitle className="font-heading text-[32px] leading-none font-extrabold">{title}</AlertDialogTitle>

        <div className="grid w-full grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] items-center gap-2.5">
          <div className={`flex flex-col items-center gap-1 rounded-3xl p-3 ${finished && winnerUid === uid ? "bg-[#3d1530] ring-2 ring-[#ffcf4a]" : "bg-[#2a2459]"}`}>
            <span className="text-sm font-bold text-violet-200/80">{t("duel.you")}</span>
            <span className="font-heading text-[34px] leading-none font-extrabold tabular-nums">{formatNumber(myScore)}</span>
          </div>
          <DuelBoardCard
            name={opponentName}
            board={opponentBoard?.state}
            score={formatNumber(opponentScore)}
            tag={finished ? null : opponentBoard?.state.endedEarly ? t("duel.stopped") : opponentDone ? t("duel.over") : t("duel.playing")}
            highlight={finished && winnerUid === opponentUid}
          />
        </div>

        <AlertDialogDescription className="text-sm font-semibold">
          {finished
            ? t("duel.finalScore", { mine: formatNumber(myScore), theirs: formatNumber(opponentScore) })
            : gap > 0
              ? t("duel.leading", { points: formatNumber(gap) })
              : gap < 0
                ? t("duel.trailing", { points: formatNumber(-gap) })
                : t("duel.tied")}
        </AlertDialogDescription>
        {status && (
          <p className={`text-sm font-bold tabular-nums ${theme.soft}`} aria-live="polite">
            {status}
          </p>
        )}

        {finished && (
          <button className={`${theme.button} ${BUTTON}`} disabled={busy} onClick={() => void rematch()}>
            <RotateCcwIcon aria-hidden="true" />
            {t("duel.rematch")}
          </button>
        )}
        <Link href={`${Routes.DUEL}/${run.duelId}`} className={`${CHUNKY_BUTTON.secondary} ${BUTTON}`}>
          <DoorOpenIcon aria-hidden="true" />
          {t("duel.backToRoom")}
        </Link>
        {finished && (
          <button className="text-sm font-semibold text-violet-200/80 underline underline-offset-2 hover:text-white" onClick={() => void enterMode({ kind: "endless" })}>
            {t("duel.playClassic")}
          </button>
        )}
      </AlertDialogContent>
    </AlertDialog>
  )
}
