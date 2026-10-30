"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { LightbulbIcon, RefreshCwIcon, RotateCcwIcon } from "lucide-react"
import { toast } from "sonner"

import { useFirebaseAuthStore } from "@/lib/auth/firebase-auth-store"
import { useI18n } from "@/lib/i18n"
import { gameReducer } from "@/modules/block-puzzle/engine/game-state-reducer"
import type { GameState } from "@/modules/block-puzzle/engine/game-types"
import { createRankedGameStartState, type RecordedGameAction } from "@/modules/block-puzzle/engine/replay-recorded-game-actions"

import { findLesson } from "../lesson-catalog"
import { flushLessonCompletions, submitLessonCompletion } from "../lesson-completion-queue"
import { lessonGoalProgress, lessonStart, lessonStatus, nextLessonHint } from "../lesson-rules"
import { LessonCanvas } from "./lesson-canvas"

const BUTTON = "flex items-center gap-1.5 rounded-2xl bg-card px-3.5 py-2 text-sm font-bold hover:brightness-125 disabled:opacity-50"

/** Chơi một bài học trên state cục bộ: mục tiêu, số nước còn lại, gợi ý theo lời giải mẫu, chơi lại; qua bài → nộp để nhận xu. */
export function LessonPlayer({ slug }: { slug: string }) {
  const { t, formatNumber } = useI18n()
  const found = useMemo(() => findLesson(slug), [slug])
  const lesson = found?.lesson
  const start = useMemo(() => (found ? createRankedGameStartState(lessonStart(found.lesson, found.index)) : null), [found])
  const [game, setGame] = useState<GameState | null>(start)
  const [showHint, setShowHint] = useState(false)
  const [result, setResult] = useState<string | null>(null)
  // Log nước đi: ref cho callback (đồng bộ), state cho render (gợi ý).
  const [actions, setActions] = useState<RecordedGameAction[]>([])
  const played = useRef<RecordedGameAction[]>([])
  const gameRef = useRef(game)
  const authStatus = useFirebaseAuthStore((state) => state.status)

  // Bài qua lúc offline → nộp khi đã đăng nhập.
  useEffect(() => {
    if (authStatus !== "ready") return
    void flushLessonCompletions().then((coins) => {
      if (coins > 0) toast.success(t("lessons.rewarded", { coins: formatNumber(coins) }))
    })
  }, [authStatus, t, formatNumber])

  const onAction = useCallback(
    (action: RecordedGameAction): GameState | null => {
      const current = gameRef.current
      if (!lesson || !current || lessonStatus(lesson, current) !== "playing") return null
      const next = gameReducer(current, action)
      if (next === current) return null
      played.current = [...played.current, action]
      setActions(played.current)
      gameRef.current = next
      setGame(next)
      if (lessonStatus(lesson, next) === "complete") {
        submitLessonCompletion(lesson.slug, played.current)
          .then((response) =>
            setResult(
              response === "queued"
                ? t("lessons.savedOffline")
                : response.alreadyDone
                  ? t("lessons.alreadyDone")
                  : t("lessons.rewarded", { coins: formatNumber(response.coins) })
            )
          )
          .catch(() => setResult(null))
      }
      return next
    },
    [lesson, t, formatNumber]
  )

  const retry = () => {
    played.current = []
    setActions([])
    gameRef.current = start
    setGame(start)
    setResult(null)
  }

  if (!lesson || !game) return null
  const status = lessonStatus(lesson, game)
  const hint = showHint && status === "playing" ? nextLessonHint(lesson, actions) : null
  const hintText = !showHint || status !== "playing"
    ? null
    : !hint
      ? t("lessons.hintLost")
      : hint.type === "STASH_PIECE"
        ? t("lessons.hintStash")
        : hint.type === "REPLACE_TRAY"
          ? t("lessons.hintSwap")
          : t("lessons.hintPlace")
  const canSwap = (lesson.replaceCharges ?? 0) > 0 && (game.replaceCharges ?? 0) > 0 && status === "playing"
  const progress = Math.min(lessonGoalProgress(lesson, game), lesson.goal.target)

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="flex w-full flex-wrap items-center justify-between gap-2 text-sm">
        <span className="font-bold">{t(`lessons.goal.${lesson.goal.kind}`, { target: formatNumber(lesson.goal.target) })}</span>
        <span className="text-muted-foreground tabular-nums" aria-live="polite">
          {formatNumber(progress)}/{formatNumber(lesson.goal.target)} · {t("lessons.movesLeft", { left: Math.max(0, lesson.moveLimit - game.moveCount) })}
        </span>
      </div>
      <LessonCanvas game={game} hint={hint} powerUps={Boolean(lesson.stashUnlocked) || (lesson.replaceCharges ?? 0) > 0} onAction={onAction} />
      {status !== "playing" && (
        <p role="status" className={`text-center font-bold ${status === "complete" ? "text-[#2ec4b6]" : "text-amber-200"}`}>
          {t(status === "complete" ? "lessons.complete" : "lessons.failed")}
          {status === "complete" && result && <span className="block text-xs font-semibold text-muted-foreground">{result}</span>}
        </p>
      )}
      {hintText && <p className="text-center text-xs text-amber-200">{hintText}</p>}
      <div className="flex flex-wrap justify-center gap-2">
        {canSwap && (
          <button className={BUTTON} onClick={() => onAction({ type: "REPLACE_TRAY" })}>
            <RefreshCwIcon className="size-4" aria-hidden="true" />
            {t("lessons.swap")}
          </button>
        )}
        <button className={BUTTON} aria-pressed={showHint} onClick={() => setShowHint((value) => !value)} disabled={status !== "playing"}>
          <LightbulbIcon className="size-4" aria-hidden="true" />
          {t(showHint ? "lessons.hideHint" : "lessons.showHint")}
        </button>
        <button className={BUTTON} onClick={retry}>
          <RotateCcwIcon className="size-4" aria-hidden="true" />
          {t("lessons.retry")}
        </button>
      </div>
    </div>
  )
}
