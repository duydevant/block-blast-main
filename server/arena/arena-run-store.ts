import "server-only"

import { FieldValue } from "firebase-admin/firestore"
import { z } from "zod"

import { ARENA_TYPES, findArenaLevel } from "@/modules/game-modes/arena-catalog"
import type { ArenaRunView, ArenaStatusResponse } from "@/modules/game-modes/arena-types"
import { formFromRecent, tierForForm, tierRank } from "@/modules/progression/player-form-rules"
import { getAdminFirestore } from "@/server/firebase/firebase-admin-app"
import { HttpError } from "@/server/http/authenticated-json-route"
import { parseStoredPlayer, USERS_COLLECTION } from "@/server/profile/stored-player-document"

import { ARENA_RUNS_COLLECTION, arenaRunRef, effectiveStatus, parseArenaRun, toArenaRunView } from "./arena-run-documents"

export const startArenaRunSchema = z.object({ type: z.enum(ARENA_TYPES), level: z.number().int().min(1).max(5) })

export async function getArenaStatus(uid: string): Promise<ArenaStatusResponse> {
  const db = getAdminFirestore()
  const runId = parseStoredPlayer((await db.collection(USERS_COLLECTION).doc(uid).get()).data()).arenaRunOpen
  if (!runId) return { openRun: null }
  const run = parseArenaRun((await arenaRunRef(db, runId).get()).data())
  if (!run || run.uid !== uid) return { openRun: null }
  const view = toArenaRunView(runId, run, Date.now())
  return { openRun: view.status === "open" ? view : null }
}

/**
 * Mở một lượt: kiểm Bậc, đủ xu, không có lượt khác đang mở (lượt cũ quá hạn thì đóng luôn) → trừ xu, tạo lượt.
 * Xu trả trước: bỏ lượt / thua / hết hạn đều không hoàn.
 */
export async function startArenaRun(uid: string, request: z.infer<typeof startArenaRunSchema>): Promise<ArenaRunView> {
  const definition = findArenaLevel(request.type, request.level)
  if (!definition) throw new HttpError(400, "unknown-arena-level")
  const db = getAdminFirestore()
  const userRef = db.collection(USERS_COLLECTION).doc(uid)
  const runRef = db.collection(ARENA_RUNS_COLLECTION).doc()
  const nowMs = Date.now()

  return db.runTransaction(async (tx) => {
    const stored = parseStoredPlayer((await tx.get(userRef)).data())
    const openRef = stored.arenaRunOpen ? arenaRunRef(db, stored.arenaRunOpen) : null
    const openRun = openRef ? parseArenaRun((await tx.get(openRef)).data()) : null
    if (stored.banned) throw new HttpError(403, "account-restricted")
    const tier = tierForForm(formFromRecent(stored.recentFormScores))
    if (definition.requiredTier && tierRank(tier) < tierRank(definition.requiredTier)) throw new HttpError(403, "tier-locked")
    if (openRun && effectiveStatus(openRun, nowMs) === "open") throw new HttpError(409, "run-open")
    if (stored.coins < definition.entryCoins) throw new HttpError(409, "not-enough-coins")

    if (openRef && openRun?.status === "open") tx.update(openRef, { status: "expired", openGameId: null })
    const run = {
      uid,
      type: definition.type,
      level: definition.level,
      status: "open" as const,
      attemptsUsed: 0,
      gamesDone: 0,
      createdAtMs: nowMs,
      expiresAtMs: nowMs + definition.windowMs,
      entryCoins: definition.entryCoins,
      openGameId: null,
    }
    tx.set(runRef, { ...run, createdAt: FieldValue.serverTimestamp() })
    tx.set(
      userRef,
      {
        coins: stored.coins - definition.entryCoins,
        coinsSpentTotal: stored.coinsSpentTotal + definition.entryCoins,
        arenaRunOpen: runRef.id,
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    )
    return toArenaRunView(runRef.id, { ...run, definition }, nowMs)
  })
}

/** Bỏ lượt đang mở (thoát kẹt) — mất xu đã trả. */
export async function abandonArenaRun(uid: string): Promise<ArenaStatusResponse> {
  const db = getAdminFirestore()
  const userRef = db.collection(USERS_COLLECTION).doc(uid)
  await db.runTransaction(async (tx) => {
    const runId = parseStoredPlayer((await tx.get(userRef)).data()).arenaRunOpen
    if (!runId) return
    const runRef = arenaRunRef(db, runId)
    const run = parseArenaRun((await tx.get(runRef)).data())
    if (run?.uid === uid && run.status === "open") tx.update(runRef, { status: "lost", openGameId: null })
    tx.set(userRef, { arenaRunOpen: null, updatedAt: FieldValue.serverTimestamp() }, { merge: true })
  })
  return { openRun: null }
}
