"use client"

import { z } from "zod"

import { useFirebaseAuthStore } from "@/lib/auth/firebase-auth-store"
import { ApiRequestError, fetchJsonWithFirebaseIdToken } from "@/lib/firebase/fetch-json-with-firebase-id-token"
import { ApiRoutes } from "@/lib/routes"
import type { RecordedGameAction } from "@/modules/block-puzzle/engine/replay-recorded-game-actions"
import { safeLocalStorage } from "@/modules/block-puzzle/store/safe-local-storage"

import { completeLessonRequestSchema, type CompleteLessonResponse } from "./lesson-completion-types"

/** Bài qua lúc chưa đăng nhập / mất mạng: giữ log để nộp sau (mỗi bài 1 mục, tối đa 12 = số bài). */
const QUEUE_KEY = "block-puzzle.lesson-completions"
const MAX_QUEUED = 12

const queueSchema = z.array(completeLessonRequestSchema).max(MAX_QUEUED).catch([])

type QueuedCompletion = z.infer<typeof completeLessonRequestSchema>

function readQueue(): QueuedCompletion[] {
  try {
    return queueSchema.parse(JSON.parse(String(safeLocalStorage.getItem(QUEUE_KEY) ?? "[]")))
  } catch {
    return []
  }
}

function writeQueue(items: QueuedCompletion[]) {
  safeLocalStorage.setItem(QUEUE_KEY, JSON.stringify(items.slice(-MAX_QUEUED)))
}

function enqueue(item: QueuedCompletion) {
  writeQueue([...readQueue().filter((queued) => queued.slug !== item.slug), item])
}

const signedIn = () => useFirebaseAuthStore.getState().status === "ready" && Boolean(useFirebaseAuthStore.getState().player)

/** 4xx (trừ 401/429) = server từ chối hẳn → bỏ khỏi hàng chờ; lỗi khác giữ lại thử sau. */
const isPermanent = (error: unknown) => error instanceof ApiRequestError && error.status >= 400 && error.status < 500 && error.status !== 401 && error.status !== 429

async function post(item: QueuedCompletion): Promise<CompleteLessonResponse> {
  return fetchJsonWithFirebaseIdToken<CompleteLessonResponse>(ApiRoutes.LESSONS_COMPLETE, { method: "POST", body: item })
}

/** Nộp kết quả bài vừa qua; chưa đăng nhập / lỗi mạng → xếp hàng chờ, trả "queued". */
export async function submitLessonCompletion(slug: string, actions: readonly RecordedGameAction[]): Promise<CompleteLessonResponse | "queued"> {
  const item = { slug, actions: [...actions] }
  if (!signedIn()) {
    enqueue(item)
    return "queued"
  }
  try {
    return await post(item)
  } catch (error) {
    if (isPermanent(error)) throw error
    enqueue(item)
    return "queued"
  }
}

/** Gửi các bài đã qua lúc offline (gọi khi đã đăng nhập). Trả tổng xu nhận thêm. */
export async function flushLessonCompletions(): Promise<number> {
  if (!signedIn()) return 0
  let coins = 0
  for (const item of readQueue()) {
    try {
      coins += (await post(item)).coins
    } catch (error) {
      if (!isPermanent(error)) return coins
    }
    writeQueue(readQueue().filter((queued) => queued.slug !== item.slug))
  }
  return coins
}
