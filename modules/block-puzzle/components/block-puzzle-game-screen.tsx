"use client"

import { useQueryClient } from "@tanstack/react-query"
import { useEffect, useState } from "react"

import { useI18n } from "@/lib/i18n"
import { DAILY_STATUS_QUERY_KEY, LEADERBOARD_QUERY_KEY } from "@/modules/leaderboard/use-leaderboard-queries"
import { PLAYER_PROFILE_QUERY_KEY } from "@/modules/player-profile/use-player-profile-query"
import { VariantModeBadge } from "@/modules/game-modes/components/variant-mode-badge"
import { useLevelProgressStore } from "@/modules/game-modes/level-progress-store"
import { useLevelRunEffects } from "@/modules/game-modes/use-level-run-effects"
import { DuelGameOverPanel } from "@/modules/duel/components/duel-game-over-panel"
import { DuelRunController } from "@/modules/duel/components/duel-run-controller"
import { usePlayerPresence } from "@/modules/presence/use-player-presence"
import { useLastGameRewardsStore } from "@/modules/progression/last-game-rewards-store"

import { useBlockPuzzleGameStore } from "../store/block-puzzle-game-store"
import { startRankedGameCloudSync } from "../store/ranked-game-cloud-sync"
import { useBlockPuzzleSettingsStore } from "../store/block-puzzle-settings-store"
import { BlockPuzzleGameCanvas } from "./block-puzzle-game-canvas"
import { SpecialModeBadge } from "./special-mode-badge"
import { HowToPlayDialog, RestartConfirmDialog } from "./game-dialogs"
import { GameOverDialog } from "./game-over-dialog"
import { GameHudScoreBar } from "./game-hud-score-bar"
import { GameDragHint } from "./game-drag-hint"
import { GameTutorial } from "./game-tutorial"
import { useEnforceOwnedColorTheme, useGameRewardToasts } from "./use-progression-side-effects"
import { useSpecialModeLauncher } from "./use-special-mode-launcher"

/** Màn chơi hoàn chỉnh: HUD + canvas + các dialog. Trang /play chỉ cần render component này. */
export function BlockPuzzleGameScreen() {
  const { t } = useI18n()
  const gameReady = useBlockPuzzleGameStore((state) => state.hasHydrated && state.game !== null)
  const settingsReady = useBlockPuzzleSettingsStore((state) => state.hasHydrated)
  const seenTutorial = useBlockPuzzleSettingsStore((state) => state.seenTutorial)
  const markTutorialSeen = useBlockPuzzleSettingsStore((state) => state.markTutorialSeen)
  const finishTutorial = useBlockPuzzleGameStore((state) => state.finishTutorial)
  const [restartOpen, setRestartOpen] = useState(false)
  const [helpOpen, setHelpOpen] = useState(false)
  const duelRun = useBlockPuzzleGameStore((state) => (state.variantRun?.kind === "duel" ? state.variantRun : null))
  // Vào bằng link đấu (?duel=…): ván chưa kịp cấp nhưng đã biết là trận đấu → không hiện hướng dẫn chen vào.
  const [openedForDuel] = useState(() => typeof window !== "undefined" && new URLSearchParams(window.location.search).has("duel"))
  const skipTutorial = openedForDuel || duelRun !== null

  // Đọc localStorage sau khi mount (store dùng skipHydration) để HTML server/client khớp nhau.
  useEffect(() => {
    void useBlockPuzzleGameStore.persist.rehydrate()
    void useBlockPuzzleSettingsStore.persist.rehydrate()
    void useLevelProgressStore.persist.rehydrate()
  }, [])

  // Xin seed/nộp ván tính điểm chạy nền; nộp xong thì báo phần thưởng và làm mới hồ sơ, thử thách ngày, bảng xếp hạng.
  const queryClient = useQueryClient()
  const showRewards = useGameRewardToasts()
  useEffect(
    () =>
      startRankedGameCloudSync((result, gameId) => {
        useLastGameRewardsStore.getState().setRewards(gameId, result.rewards)
        showRewards(result.rewards)
        for (const queryKey of [PLAYER_PROFILE_QUERY_KEY, DAILY_STATUS_QUERY_KEY, LEADERBOARD_QUERY_KEY]) {
          void queryClient.invalidateQueries({ queryKey })
        }
      }),
    [queryClient, showRewards]
  )
  // Vào đấu 1v1 coi như đã biết chơi: bỏ hướng dẫn (đồng hồ trận vẫn chạy) và không hiện lại sau này.
  useEffect(() => {
    if (settingsReady && skipTutorial && !seenTutorial) markTutorialSeen()
  }, [settingsReady, skipTutorial, seenTutorial, markTutorialSeen])
  useEnforceOwnedColorTheme()
  usePlayerPresence()
  useLevelRunEffects()
  const modeLauncher = useSpecialModeLauncher()

  // Đang mở chế độ từ link (cất ván cũ, lấy / xin ván của chế độ mới) → không vẽ ván của chế độ khác.
  if (!gameReady || !settingsReady || modeLauncher.launching) {
    return (
      <div className="flex flex-1 items-center justify-center text-sm text-violet-200/70" role="status">
        {t("game.loading")}
      </div>
    )
  }

  return (
    <div className="relative mx-auto flex min-h-0 w-full max-w-xl flex-1 flex-col">
      {!seenTutorial && !skipTutorial ? <GameTutorial onComplete={() => { finishTutorial(); markTutorialSeen() }} /> : <>
        <GameHudScoreBar
          onRestart={() => setRestartOpen(true)}
          onShowHowToPlay={() => setHelpOpen(true)}
          onStartDaily={modeLauncher.launchDaily}
        />
        <SpecialModeBadge />
        <VariantModeBadge />
        <GameDragHint />
        <BlockPuzzleGameCanvas />
        {duelRun ? <DuelGameOverPanel run={duelRun} /> : <GameOverDialog />}
        {duelRun && <DuelRunController key={`${duelRun.duelId}:${duelRun.round}`} run={duelRun} />}
      </>}
      <RestartConfirmDialog open={restartOpen} onOpenChange={setRestartOpen} />
      {modeLauncher.confirmDialog}
      <HowToPlayDialog
        open={helpOpen}
        onClose={() => {
          markTutorialSeen()
          setHelpOpen(false)
        }}
      />
    </div>
  )
}
