"use client"

import { useSyncExternalStore } from "react"

import type { OutcomeVerdict } from "@/modules/block-puzzle/engine/game-outcome-analysis"
import { safeLocalStorage } from "@/modules/block-puzzle/store/safe-local-storage"

/** Kết quả các lần phân tích gần nhất (chỉ trên máy này, không gửi server — chỉ để người chơi tự xem). */
const STORAGE_KEY = "block-puzzle.analysis-verdicts"
const MAX_VERDICTS = 20
const VERDICTS: readonly OutcomeVerdict[] = ["mistake", "unlucky", "unknown"]

const listeners = new Set<() => void>()
let cache: OutcomeVerdict[] | null = null

function read(): OutcomeVerdict[] {
  if (cache) return cache
  try {
    const raw = JSON.parse(String(safeLocalStorage.getItem(STORAGE_KEY) ?? "[]"))
    cache = Array.isArray(raw) ? raw.filter((item): item is OutcomeVerdict => VERDICTS.includes(item)).slice(-MAX_VERDICTS) : []
  } catch {
    cache = []
  }
  return cache
}

export function recordAnalysisVerdict(verdict: OutcomeVerdict) {
  cache = [...read(), verdict].slice(-MAX_VERDICTS)
  try {
    void safeLocalStorage.setItem(STORAGE_KEY, JSON.stringify(cache))
  } catch {}
  listeners.forEach((listener) => listener())
}

const EMPTY: OutcomeVerdict[] = []

export function useAnalysisVerdicts(): readonly OutcomeVerdict[] {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    read,
    () => EMPTY
  )
}

/** Tỉ lệ xui / sai lầm trên các lần phân tích có kết luận (bỏ "unknown"). */
export function verdictShares(verdicts: readonly OutcomeVerdict[]): { counted: number; unlucky: number; mistake: number } {
  const counted = verdicts.filter((item) => item !== "unknown")
  if (counted.length === 0) return { counted: 0, unlucky: 0, mistake: 0 }
  const unlucky = Math.round((counted.filter((item) => item === "unlucky").length / counted.length) * 100)
  return { counted: counted.length, unlucky, mistake: 100 - unlucky }
}
