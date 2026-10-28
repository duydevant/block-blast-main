"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { toast } from "sonner"

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { useFirebaseAuthStore } from "@/lib/auth/firebase-auth-store"
import { type TranslationKey, useI18n } from "@/lib/i18n"
import { Routes } from "@/lib/routes"
import { CHALLENGE_ID_PATTERN } from "@/modules/challenge/challenge-types"
import { startChallengeGame } from "@/modules/challenge/challenge-game-actions"
import { DUEL_ID_PATTERN } from "@/modules/duel/duel-types"
import { variantForRun } from "@/modules/game-modes/variant-run"
import { findLevel } from "@/modules/game-modes/level-catalog"
import { startDuelGame, startLevelGame, startWeeklyEventGame } from "@/modules/game-modes/start-variant-game"

import { useBlockPuzzleGameStore } from "../store/block-puzzle-game-store"
import { isUntouchedGame } from "../store/ranked-game-cloud-state"
import { startDailyChallenge } from "../store/start-daily-challenge"
import { GAME_PANEL, PRIMARY_BUTTON, SECONDARY_BUTTON } from "./game-ui-styles"

type SpecialMode =
  | { kind: "daily" }
  | { kind: "challenge"; id: string }
  | { kind: "event" }
  | { kind: "level"; id: number }
  | { kind: "duel"; id: string; round: number | null }

const COPY: Record<SpecialMode["kind"], { title: TranslationKey; confirm: TranslationKey; offline: TranslationKey; failed: TranslationKey }> = {
  daily: { title: "daily.confirmTitle", confirm: "daily.play", offline: "daily.needsOnline", failed: "daily.startFailed" },
  challenge: { title: "challenge.confirmTitle", confirm: "challenge.accept", offline: "challenge.needsOnline", failed: "challenge.startFailed" },
  event: { title: "event.confirmTitle", confirm: "event.play", offline: "event.needsOnline", failed: "event.startFailed" },
  level: { title: "levels.confirmTitle", confirm: "levels.play", offline: "levels.startFailed", failed: "levels.startFailed" },
  duel: { title: "duel.confirmTitle", confirm: "duel.goPlay", offline: "duel.needsOnline", failed: "duel.startFailed" },
}

/** `/play?daily=1`, `?challenge=<id>`, `?event=1`, `?level=<n>`, `?duel=<id>` → chế độ cần mở (null nếu không có). */
function modeFromQuery(): SpecialMode | null {
  const params = new URLSearchParams(window.location.search)
  const challengeId = params.get("challenge")
  if (challengeId && CHALLENGE_ID_PATTERN.test(challengeId)) return { kind: "challenge", id: challengeId }
  const duelId = params.get("duel")
  const round = Number(params.get("round"))
  if (duelId && DUEL_ID_PATTERN.test(duelId)) return { kind: "duel", id: duelId, round: Number.isInteger(round) && round > 0 ? round : null }
  const levelId = Number(params.get("level"))
  if (findLevel(levelId)) return { kind: "level", id: levelId }
  if (params.has("event")) return { kind: "event" }
  return params.has("daily") ? { kind: "daily" } : null
}

/** Đang chơi đúng ván đấu này rồi (mở lại link sau khi tải lại trang) → không xin ván mới; ván mới cùng phòng thì có. */
function isCurrentDuel(mode: SpecialMode): boolean {
  const run = useBlockPuzzleGameStore.getState().variantRun
  return mode.kind === "duel" && run?.kind === "duel" && run.duelId === mode.id && (mode.round === null || run.round === mode.round)
}

async function startMode(mode: SpecialMode): Promise<"practice" | void> {
  if (mode.kind === "challenge") return startChallengeGame(mode.id)
  if (mode.kind === "event") return startWeeklyEventGame()
  if (mode.kind === "duel") return startDuelGame(mode.id)
  if (mode.kind === "level") return void (await startLevelGame(mode.id))
  return (await startDailyChallenge()) === "practice" ? "practice" : undefined
}

/**
 * Vào thử thách hằng ngày / thách đấu bạn bè từ menu hoặc từ link (trang chủ, trang /c/{id}).
 * Ván hiện tại có tiến độ và chưa hết → hỏi trước khi kết thúc ván.
 */
export function useSpecialModeLauncher() {
  const { t } = useI18n()
  const [pending, setPending] = useState<SpecialMode | null>(null)
  const busy = useRef(false)
  const authStatus = useFirebaseAuthStore((state) => state.status)
  const gameReady = useBlockPuzzleGameStore((state) => state.hasHydrated && state.game !== null)
  // Đang giữa trận đấu: chuyển chế độ khác = bỏ trận (ván đấu được nộp với điểm hiện tại) → nói rõ khi hỏi.
  const duelActive = useBlockPuzzleGameStore((state) => state.variantRun?.kind === "duel" && state.game?.isGameOver === false)

  const begin = useCallback(async (mode: SpecialMode) => {
    if (busy.current) return
    busy.current = true
    try {
      if ((await startMode(mode)) === "practice") toast.info(t("daily.practiceStarted"))
    } catch (error) {
      console.warn("[special-mode] start failed", error)
      toast.error(t(navigator.onLine ? COPY[mode.kind].failed : COPY[mode.kind].offline))
    } finally {
      busy.current = false
    }
  }, [t])

  const launch = useCallback((mode: SpecialMode) => {
    if (isCurrentDuel(mode)) return
    // Màn chơi chơi được offline; các chế độ khác cần tài khoản cloud.
    if (mode.kind !== "level" && useFirebaseAuthStore.getState().status !== "ready") return void toast.error(t(COPY[mode.kind].offline))
    const { game, variantRun } = useBlockPuzzleGameStore.getState()
    const initialCharges = variantRun ? variantForRun(variantRun)?.replaceCharges : undefined
    // Đấu 1v1 có giờ bắt đầu cố định → không hỏi lại, vào ngay.
    // Đang đấu thì luôn hỏi (kể cả chưa đi nước nào): rời ván = bỏ trận.
    const touched = variantRun?.kind === "duel" || !isUntouchedGame(game, initialCharges)
    if (mode.kind !== "duel" && game && !game.isGameOver && touched) return setPending(mode)
    void begin(mode)
  }, [begin, t])

  // Link vào thẳng chế độ: chờ save + đăng nhập xong rồi mở một lần, bỏ query khỏi URL.
  const handledQuery = useRef(false)
  useEffect(() => {
    // Chờ đăng nhập xong (kể cả màn chơi: có tài khoản thì ván được server xác nhận sao/thưởng).
    if (handledQuery.current || !gameReady || authStatus === "loading") return
    const mode = modeFromQuery()
    if (!mode) return
    const timer = window.setTimeout(() => {
      handledQuery.current = true
      window.history.replaceState(null, "", Routes.PLAY)
      launch(mode)
    }, 0)
    return () => window.clearTimeout(timer)
  }, [authStatus, gameReady, launch])

  const confirmDialog = (
    <AlertDialog open={pending !== null} onOpenChange={(open) => !open && setPending(null)}>
      <AlertDialogContent className={GAME_PANEL}>
        <AlertDialogHeader>
          <AlertDialogTitle>{pending && t(COPY[pending.kind].title)}</AlertDialogTitle>
          <AlertDialogDescription>{t(duelActive ? "duel.switchDescription" : "daily.confirmDescription")}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel className={SECONDARY_BUTTON}>{t("game.cancel")}</AlertDialogCancel>
          <AlertDialogAction
            className={PRIMARY_BUTTON}
            onClick={() => {
              if (!pending) return
              if (duelActive) useBlockPuzzleGameStore.getState().endVariantRun()
              void begin(pending)
            }}
          >
            {pending && t(COPY[pending.kind].confirm)}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )

  return {
    launchDaily: () => launch({ kind: "daily" }),
    launchEvent: () => launch({ kind: "event" }),
    confirmDialog,
  }
}
