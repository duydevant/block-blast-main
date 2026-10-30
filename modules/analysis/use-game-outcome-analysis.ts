"use client"

import { useCallback, useEffect, useRef, useState } from "react"

import { analyzeGameOutcomeFromState, type GameOutcomeAnalysis } from "@/modules/block-puzzle/engine/game-outcome-analysis"
import type { GameState } from "@/modules/block-puzzle/engine/game-types"
import type { RecordedGameAction } from "@/modules/block-puzzle/engine/replay-recorded-game-actions"

import { recordAnalysisVerdict } from "./analysis-verdict-history"

/** Quá thời gian này coi như "chưa phân tích được" (máy quá yếu / bàn quá rối). */
const ANALYSIS_TIMEOUT_MS = 5000
const TIMED_OUT: GameOutcomeAnalysis = { verdict: "unknown", holesCreated: 0, turnsAnalyzed: 0 }

export type AnalysisState = { status: "idle" } | { status: "running" } | { status: "done"; result: GameOutcomeAnalysis }

/**
 * Phân tích sau ván chỉ khi người chơi bấm: chạy trong Web Worker (không chặn UI); không tạo được worker thì
 * chạy ở luồng chính sau 1 frame. Mỗi kết quả ghi vào thống kê cục bộ một lần.
 */
export function useGameOutcomeAnalysis() {
  const [state, setState] = useState<AnalysisState>({ status: "idle" })
  const cleanupRef = useRef<(() => void) | null>(null)

  useEffect(() => () => cleanupRef.current?.(), [])

  const run = useCallback((startState: GameState, actions: readonly RecordedGameAction[]) => {
    cleanupRef.current?.()
    setState({ status: "running" })
    let settled = false
    const finish = (result: GameOutcomeAnalysis) => {
      if (settled) return
      settled = true
      cleanupRef.current?.()
      recordAnalysisVerdict(result.verdict)
      setState({ status: "done", result })
    }

    let worker: Worker | null = null
    try {
      worker = new Worker(new URL("./game-analysis.worker.ts", import.meta.url), { type: "module" })
      worker.onmessage = (event: MessageEvent<GameOutcomeAnalysis>) => finish(event.data)
      worker.onerror = () => finish(TIMED_OUT)
      worker.postMessage({ startState, actions: [...actions] })
    } catch {
      worker = null
    }
    const fallback = worker ? null : window.setTimeout(() => finish(analyzeGameOutcomeFromState(startState, actions)), 16)
    const timeout = window.setTimeout(() => finish(TIMED_OUT), ANALYSIS_TIMEOUT_MS)
    cleanupRef.current = () => {
      worker?.terminate()
      if (fallback !== null) window.clearTimeout(fallback)
      window.clearTimeout(timeout)
      cleanupRef.current = null
    }
  }, [])

  const reset = useCallback(() => {
    cleanupRef.current?.()
    setState({ status: "idle" })
  }, [])

  return { state, run, reset }
}
