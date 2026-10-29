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

import { canResumeMode, enterMode, isAlreadyInMode, modeFromQuery, restartCurrentMode, type SpecialMode } from "../special-game-modes"
import { useBlockPuzzleGameStore } from "../store/block-puzzle-game-store"
import { GAME_PANEL, PRIMARY_BUTTON, SECONDARY_BUTTON } from "./game-ui-styles"

/** Thông báo khi không mở được ván mới của chế độ (mất mạng / lỗi server). */
const ERRORS: Record<SpecialMode["kind"], { offline: TranslationKey; failed: TranslationKey }> = {
  endless: { offline: "game.endlessFailed", failed: "game.endlessFailed" },
  daily: { offline: "daily.needsOnline", failed: "daily.startFailed" },
  challenge: { offline: "challenge.needsOnline", failed: "challenge.startFailed" },
  level: { offline: "levels.startFailed", failed: "levels.startFailed" },
  duel: { offline: "duel.needsOnline", failed: "duel.startFailed" },
}

/** Vô tận / màn chơi mở được offline; chế độ khác cần tài khoản cloud để xin ván mới (chơi tiếp ván cất thì không cần). */
const needsCloud = (mode: SpecialMode) => mode.kind !== "endless" && mode.kind !== "level"

/**
 * Vào chế độ từ nút Play / link / menu. Các chế độ độc lập: sang chế độ khác thì ván đang chơi được cất lại
 * (vào lại chế độ đó là chơi tiếp đúng ván ấy), không hỏi gì. Chỉ hỏi khi đang giữa trận 1v1 (rời = bỏ trận).
 * `launching`: đang mở chế độ từ link → màn chơi hiện "đang tải" thay vì vẽ ván cũ của chế độ khác.
 */
export function useSpecialModeLauncher() {
  const { t } = useI18n()
  const [pending, setPending] = useState<SpecialMode | null>(null)
  const [launching, setLaunching] = useState(() => typeof window !== "undefined" && modeFromQuery(window.location.search) !== null)
  const busy = useRef(false)
  const authStatus = useFirebaseAuthStore((state) => state.status)
  const gameReady = useBlockPuzzleGameStore((state) => state.hasHydrated && state.game !== null)
  const duelActive = useBlockPuzzleGameStore((state) => state.variantRun?.kind === "duel" && state.game?.isGameOver === false)

  const begin = useCallback(
    async (mode: SpecialMode) => {
      if (busy.current) return
      busy.current = true
      setLaunching(true)
      try {
        if ((await enterMode(mode)) === "practice") toast.info(t("daily.practiceStarted"))
      } catch (error) {
        console.warn("[special-mode] start failed", error)
        toast.error(t(navigator.onLine ? ERRORS[mode.kind].failed : ERRORS[mode.kind].offline))
      } finally {
        busy.current = false
        setLaunching(false)
      }
    },
    [t]
  )

  const launch = useCallback(
    (mode: SpecialMode) => {
      if (isAlreadyInMode(mode)) return setLaunching(false)
      if (needsCloud(mode) && !canResumeMode(mode) && useFirebaseAuthStore.getState().status !== "ready") {
        setLaunching(false)
        return void toast.error(t(ERRORS[mode.kind].offline))
      }
      const { variantRun, game } = useBlockPuzzleGameStore.getState()
      // Đang giữa trận 1v1 mà mở chế độ khác (hoặc phòng khác) → hỏi: rời là bỏ trận.
      if (variantRun?.kind === "duel" && game && !game.isGameOver) {
        setLaunching(false)
        return setPending(mode)
      }
      void begin(mode)
    },
    [begin, t]
  )

  // Link vào thẳng chế độ: chờ save + đăng nhập xong rồi mở một lần, bỏ query khỏi URL.
  const handledQuery = useRef(false)
  useEffect(() => {
    // Chờ đăng nhập xong (kể cả màn chơi: có tài khoản thì ván được server xác nhận sao/thưởng).
    if (handledQuery.current || !gameReady || authStatus === "loading") return
    const mode = modeFromQuery(window.location.search)
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
          <AlertDialogTitle>{t("duel.leaveTitle")}</AlertDialogTitle>
          <AlertDialogDescription>{t("duel.switchDescription")}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel className={SECONDARY_BUTTON}>{t("duel.keepPlaying")}</AlertDialogCancel>
          <AlertDialogAction
            className={PRIMARY_BUTTON}
            onClick={() => {
              if (!pending) return
              // Chốt ván đấu trước (ghi nước "dừng", nộp điểm hiện tại) rồi mới mở chế độ mới.
              if (duelActive) useBlockPuzzleGameStore.getState().endVariantRun()
              setPending(null)
              void begin(pending)
            }}
          >
            {t("duel.leave")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )

  return {
    launchDaily: () => launch({ kind: "daily" }),
    confirmDialog,
    launching,
  }
}

/** "Ván mới" (menu / hết ván): ván mới cùng chế độ đang chơi; lỗi mạng thì báo và giữ nguyên ván. */
export function useRestartCurrentMode() {
  const { t } = useI18n()
  return useCallback(() => {
    restartCurrentMode()
      .then((result) => result === "practice" && toast.info(t("daily.practiceStarted")))
      .catch((error: unknown) => {
        console.warn("[special-mode] restart failed", error)
        toast.error(t(navigator.onLine ? "game.restartFailed" : "game.restartOffline"))
      })
  }, [t])
}
