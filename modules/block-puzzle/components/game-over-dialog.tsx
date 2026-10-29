"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import { CheckIcon, CrownIcon, HeartIcon, RotateCcwIcon } from "lucide-react"

import { CHUNKY_BUTTON } from "@/components/game-ui/game-ui-classes"
import { AlertDialog, AlertDialogContent, AlertDialogDescription, AlertDialogTitle } from "@/components/ui/alert-dialog"
import { useFirebaseAuthStore } from "@/lib/auth/firebase-auth-store"
import { useI18n } from "@/lib/i18n"
import { Routes } from "@/lib/routes"
import { LevelResultPanel, useLevelOutcome } from "@/modules/game-modes/components/game-over-variant-section"
import { usePlayerProfileQuery } from "@/modules/player-profile/use-player-profile-query"
import { DailyRunGameOverNote, useDailyNewGameLabel } from "@/modules/progression/components/daily-run-game-over-note"
import { useLastGameRewardsStore } from "@/modules/progression/last-game-rewards-store"
import { InstallAppButton } from "@/modules/pwa/components/install-app-button"

import { useBlockPuzzleGameStore } from "../store/block-puzzle-game-store"
import { useRestartCurrentMode } from "./use-special-mode-launcher"
import { GameOverShareActions } from "./game-over-share-actions"
import { GAME_PANEL, SECONDARY_BUTTON } from "./game-ui-styles"

/** Chờ hiệu ứng xoá dòng cuối chạy xong rồi mới hiện bảng game over. */
const GAME_OVER_REVEAL_DELAY_MS = 900
const NOTE = "flex items-center justify-center gap-1.5 text-xs text-violet-200/80"
const NOTE_LINK = "underline underline-offset-2 hover:text-white"
const REWARD_CHIP = "flex flex-col items-center gap-0.5 rounded-2xl bg-[#2a2459] p-2.5"

/** Dòng nhỏ dưới cùng: so với người thách đấu, ván đã lưu lên bảng chưa, hoặc ghi chú của chế độ đặc biệt. */
function GameOverCloudNote({ score }: { score: number }) {
  const { t, formatNumber } = useI18n()
  const isRanked = useBlockPuzzleGameStore((state) => state.rankedSession !== null)
  const isDaily = useBlockPuzzleGameStore((state) => state.dailyDay !== null)
  const challenge = useBlockPuzzleGameStore((state) => state.challenge)
  const hasVariantRun = useBlockPuzzleGameStore((state) => state.variantRun !== null)
  const cloudEnabled = useFirebaseAuthStore((state) => state.status !== "disabled")
  // Màn chơi có bảng kết quả riêng, đấu 1v1 có bảng trận riêng.
  if (hasVariantRun) return null
  if (!cloudEnabled) return null

  if (challenge) {
    const name = challenge.creatorName ?? t("profile.guestName", { tag: challenge.creatorTag })
    const values = { name, score: formatNumber(score), target: formatNumber(challenge.creatorScore) }
    return (
      <p className={NOTE}>
        <strong className="text-amber-200">{t(score > challenge.creatorScore ? "challenge.won" : "challenge.lost", values)}</strong>
        <Link href={`${Routes.CHALLENGE}/${challenge.id}`} className={NOTE_LINK}>
          {t("challenge.viewResults")}
        </Link>
      </p>
    )
  }
  if (isRanked && !isDaily) {
    return (
      <p className={NOTE}>
        <CheckIcon className="size-3.5 text-[#2ec4b6]" aria-hidden="true" />
        <Link href={Routes.LEADERBOARD} className={NOTE_LINK}>
          {t("game.savedToBoard")}
        </Link>
      </p>
    )
  }
  // Lượt daily tính điểm: sao / kỷ lục vừa đạt + mời sang /daily (mục tiêu, rương tuần, thưởng chuỗi).
  if (isDaily && isRanked) return <DailyRunGameOverNote />

  const status = isDaily ? "daily.gameOverPractice" : "game.offlineNotCounted"
  return <p className={NOTE}>{t(status)}</p>
}

/** XP / xu server vừa cộng cho đúng ván này (hiện khi ván nộp xong, thường ngay sau khi hộp mở). */
function GameOverRewardChips() {
  const { t, formatNumber } = useI18n()
  const gameId = useBlockPuzzleGameStore((state) => state.rankedSession?.gameId ?? null)
  const rewards = useLastGameRewardsStore((state) => (state.gameId !== null && state.gameId === gameId ? state.rewards : null))
  if (!rewards) return null
  return (
    <div className="grid w-full grid-cols-2 gap-2">
      <div className={REWARD_CHIP}>
        <span className="text-lg font-extrabold">+{formatNumber(rewards.xp)}</span>
        <span className="text-xs text-violet-200/80">XP</span>
      </div>
      <div className={REWARD_CHIP}>
        <span className="text-lg font-extrabold text-[#ffcf7a]">+{formatNumber(rewards.coins)}</span>
        <span className="text-xs text-violet-200/80">{t("ui.coins")}</span>
      </div>
    </div>
  )
}

export function GameOverDialog() {
  const { t, formatNumber } = useI18n()
  const game = useBlockPuzzleGameStore((state) => state.game)
  const best = useBlockPuzzleGameStore((state) => state.best)
  // "Ván mới" = ván mới của chính chế độ đang chơi (thử thách → lượt tiếp, màn → chơi lại…), không nhảy sang Vô tận.
  const startNewGame = useRestartCurrentMode()
  const revive = useBlockPuzzleGameStore((state) => state.revive)
  // Ván đã nộp (VD vừa tạo thách đấu) thì hồi sinh không còn được tính → ẩn.
  const submitted = useBlockPuzzleGameStore((state) => state.rankedSession?.queued ?? false)
  const [revealedKey, setRevealedKey] = useState<string | null>(null)
  const level = useLevelOutcome()
  const newGameLabel = useDailyNewGameLabel()

  // Key riêng cho từng lần game over để ván mới không thừa hưởng trạng thái đã hiện.
  const gameOverKey = game?.isGameOver ? `${game.nextPieceUid}:${game.moveCount}:${game.score}` : null

  useEffect(() => {
    if (!gameOverKey) return
    const timer = window.setTimeout(() => setRevealedKey(gameOverKey), GAME_OVER_REVEAL_DELAY_MS)
    return () => window.clearTimeout(timer)
  }, [gameOverKey])

  const score = game?.score ?? 0
  const isNewBest = score > 0 && score >= best
  // Màn chơi không có hồi sinh (engine cũng từ chối) — thua thì chỉ có "Chơi lại".
  const canRevive = !game?.reviveUsed && !submitted && game?.moveLimit === undefined

  return (
    <AlertDialog open={gameOverKey !== null && revealedKey === gameOverKey}>
      <AlertDialogContent className={GAME_PANEL + " flex flex-col items-center gap-4 p-6 text-center"}>
        {level ? (
          <LevelResultPanel definition={level.definition} stars={level.stars} />
        ) : (
          <>
            {isNewBest ? (
              <span className="flex items-center gap-1.5 rounded-full bg-[#ffb547] px-3.5 py-1 text-sm font-extrabold text-[#2a1600]">
                <CrownIcon className="size-4 fill-current" aria-hidden="true" />
                {t("game.newBest")}
              </span>
            ) : (
              <span className="flex items-center gap-1 text-sm font-bold text-[#ffcf7a]">
                <CrownIcon className="size-3.5 fill-current" aria-hidden="true" />
                {formatNumber(best)}
              </span>
            )}
            <AlertDialogTitle className="sr-only">{t("game.gameOverTitle")}</AlertDialogTitle>
            <span className="font-heading text-[80px] leading-[0.9] font-extrabold tracking-tight tabular-nums">{formatNumber(score)}</span>
            <AlertDialogDescription className="sr-only">{t("game.gameOverScore", { score: formatNumber(score) })}</AlertDialogDescription>
            <GameOverRewardChips />
            {canRevive && (
              <button className={`${CHUNKY_BUTTON.success} h-[60px] w-full text-[22px]`} onClick={() => revive()}>
                <HeartIcon className="fill-current" aria-hidden="true" />
                {t("game.revive")}
                <span className="rounded-full bg-[#04211e] px-2 py-0.5 font-sans text-xs font-bold text-[#9fe3db]">{t("game.continueOnce")}</span>
              </button>
            )}
            <button className={`${CHUNKY_BUTTON.primary} h-[60px] w-full text-[22px]`} onClick={startNewGame}>
              <RotateCcwIcon aria-hidden="true" />
              {newGameLabel ?? t("game.newGame")}
            </button>
            <GameOverShareActions />
            <GameOverInstallOffer />
          </>
        )}
        <GameOverCloudNote score={score} />
      </AlertDialogContent>
    </AlertDialog>
  )
}

/** Mời cài game khi đã chơi đủ vài ván online (xin cài ngay lần đầu thường bị bỏ qua). */
const INSTALL_OFFER_MIN_GAMES = 3

function GameOverInstallOffer() {
  const gamesPlayed = usePlayerProfileQuery().data?.stats.gamesPlayed ?? 0
  if (gamesPlayed < INSTALL_OFFER_MIN_GAMES) return null
  return <InstallAppButton className={SECONDARY_BUTTON + " w-full"} showIosHint={false} />
}
