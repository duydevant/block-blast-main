"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useCallback, useEffect, useRef, useState } from "react"
import { RotateCcwIcon, SendIcon } from "lucide-react"
import { toast } from "sonner"

import { MODE_THEME } from "@/components/game-ui/game-ui-classes"
import { PageHeader } from "@/components/game-ui/page-header"
import { ApiRequestError } from "@/lib/firebase/fetch-json-with-firebase-id-token"
import { useI18n } from "@/lib/i18n"
import { Routes } from "@/lib/routes"
import { siteConfig } from "@/lib/site"
import { useBlockPuzzleGameStore } from "@/modules/block-puzzle/store/block-puzzle-game-store"
import { startRankedGameCloudSync } from "@/modules/block-puzzle/store/ranked-game-cloud-sync"
import { guestTagFromUid } from "@/modules/player-profile/player-profile-types"
import { useSignedInUid } from "@/modules/player-profile/use-player-profile-query"
import { shareOrCopyLink } from "@/modules/share/share-or-copy-link"

import { createDuelRoom, duelUrl, fetchDuelState, joinDuelRoom } from "../duel-actions"
import { DUEL_SUBMIT_GRACE_MS, type DuelPlayer, type DuelState, freshestDuelState } from "../duel-types"
import { useDuelRoom, useServerNow } from "../use-duel-room"
import { formatDuelClock } from "./duel-hud"
import { DuelRoomCode } from "./duel-room-code"
import { DuelRulesTiles } from "./duel-rules-tiles"
import { DuelVersusCard } from "./duel-versus-card"

/** Lần hỏi lại server khi trận quá hạn mà chưa chốt (mirror RTDB có thể đã lỡ). */
const FINALIZE_RETRY_MS = 5_000

/** Phòng đấu: chờ đối thủ → đếm ngược → vào ván → kết quả + đấu lại. Nghe RTDB, dự phòng bằng API. */
export function DuelRoomView({ duelId }: { duelId: string }) {
  const { t } = useI18n()
  const router = useRouter()
  const uid = useSignedInUid()
  const room = useDuelRoom(duelId)
  const [fetched, setFetched] = useState<DuelState | null | undefined>(undefined)
  const [fetchedOffset, setFetchedOffset] = useState(0)
  const now = useServerNow(room.offsetKnown ? room.serverOffset : fetchedOffset)
  const [busy, setBusy] = useState(false)
  const navigated = useRef(false)
  const lastFinalizeAt = useRef(0)
  // Save ván nằm ở store màn chơi (đọc lười) → đọc để biết đã đấu xong trận này trên máy chưa.
  const saveReady = useBlockPuzzleGameStore((store) => store.hasHydrated)
  const localRun = useBlockPuzzleGameStore((store) =>
    store.variantRun?.kind === "duel" && store.variantRun.duelId === duelId ? (store.game?.isGameOver ? "finished" : "active") : null
  )
  const endVariantRun = useBlockPuzzleGameStore((store) => store.endVariantRun)
  useEffect(() => {
    void useBlockPuzzleGameStore.persist.rehydrate()
    // Rời màn chơi giữa trận vẫn phải nộp ván khi hết giờ → chạy sync nền ở đây nữa.
    return startRankedGameCloudSync(() => undefined)
  }, [])

  // API: lần đầu (phòng chưa mirror lên RTDB / không có RTDB) và khi quá hạn để server chốt trận.
  const loadFromApi = useCallback(() => {
    const sentAt = Date.now()
    fetchDuelState(duelId)
      .then((response) => {
        setFetched(response)
        if (response) setFetchedOffset(response.serverNow - (sentAt + Date.now()) / 2)
      })
      .catch((error: unknown) => {
        console.warn("[duel] fetch failed", error)
        setFetched((previous) => previous ?? null)
      })
  }, [duelId])
  useEffect(() => loadFromApi(), [loadFromApi])

  const state = freshestDuelState(room.state, fetched ?? null)
  const isMember = Boolean(uid && state && (state.host.uid === uid || state.guest?.uid === uid))
  // Vào ván khi: ván của trận này đang dở trên máy, hoặc chưa từng vào (mỗi người chỉ một ván).
  const canEnterGame = isMember && saveReady && localRun !== "finished" && (localRun === "active" || !state?.started.includes(uid ?? ""))
  const startAt = state?.startAt ?? null
  const endsAt = state?.endsAt ?? null

  // Hết giờ khi đang ở phòng (ván dở trên máy) → chốt để sync nộp ngay.
  useEffect(() => {
    if (localRun === "active" && endsAt !== null && now >= endsAt) endVariantRun()
  }, [localRun, endsAt, now, endVariantRun])

  useEffect(() => {
    if (!state || state.status !== "playing" || endsAt === null || now <= endsAt + DUEL_SUBMIT_GRACE_MS) return
    if (now - lastFinalizeAt.current < FINALIZE_RETRY_MS) return
    lastFinalizeAt.current = now
    loadFromApi()
  }, [state, endsAt, now, loadFromApi])

  // Hết đếm ngược → hai người tự vào ván (một lần).
  useEffect(() => {
    if (!canEnterGame || state?.status !== "playing" || startAt === null || endsAt === null || navigated.current) return
    if (now >= startAt && now < endsAt) {
      navigated.current = true
      router.push(`${Routes.PLAY}?duel=${duelId}`)
    }
  }, [canEnterGame, state?.status, startAt, endsAt, now, router, duelId])

  const nameOf = (player: DuelPlayer) => (player.uid === uid ? t("duel.you") : (player.name ?? t("profile.guestName", { tag: guestTagFromUid(player.uid) })))

  const run = async (action: () => Promise<void>) => {
    setBusy(true)
    try {
      await action()
    } catch (error) {
      console.warn("[duel] action failed", error)
      const code = error instanceof ApiRequestError ? error.code : ""
      toast.error(t(code === "duel-full" ? "duel.full" : code === "duel-expired" ? "duel.expired" : "duel.joinFailed"))
    } finally {
      setBusy(false)
    }
  }
  const share = () =>
    shareOrCopyLink({ title: siteConfig.name, text: t("duel.shareText", { name: siteConfig.name, code: duelId }), url: duelUrl(duelId) })
      .then((outcome) => outcome === "copied" && toast.success(t("share.copied")))
      .catch(() => toast.error(t("share.failed")))
  const rematch = () => run(async () => router.push(`${Routes.DUEL}/${(await createDuelRoom(duelId)).duelId}`))

  if (fetched === undefined && !room.state) return <p className="text-sm text-muted-foreground">{t("profile.loading")}</p>
  if (!state) return <p className="text-sm text-muted-foreground">{t("duel.notFound")}</p>

  const winnerText = state.winnerUid === null ? t("duel.draw") : state.winnerUid === uid ? t("duel.won") : t("duel.lost")
  const pink = MODE_THEME.duel

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title={t("duel.title")} backHref={Routes.DUEL} />
      <DuelVersusCard state={state} live={room.live} nameOf={nameOf} />

      {state.status === "waiting" && (
        <>
          <DuelRulesTiles />
          {state.host.uid === uid ? (
            <>
              <DuelRoomCode code={duelId} />
              <button className={`${pink.button} h-16 text-[22px] [&_svg]:size-6`} onClick={() => void share()}>
                <SendIcon aria-hidden="true" />
                {t("duel.share")}
              </button>
              <label className={`flex flex-col gap-1.5 text-xs ${pink.soft}`}>
                {t("duel.roomLink")}
                <input
                  readOnly
                  value={duelUrl(duelId)}
                  onFocus={(event) => event.currentTarget.select()}
                  className="h-11 rounded-2xl border border-[#5a2448] bg-[#2a1226] px-3 text-sm text-white"
                />
              </label>
            </>
          ) : (
            <button className={`${pink.button} h-16 text-[22px]`} disabled={busy || !uid} onClick={() => void run(async () => setFetched(await joinDuelRoom(duelId)))}>
              {t("duel.join")}
            </button>
          )}
        </>
      )}

      {state.status === "playing" && startAt !== null && endsAt !== null && (
        <section className="flex flex-col items-center gap-3 rounded-3xl bg-[#2a1226] p-5 text-center">
          <span className="font-heading text-5xl leading-none font-extrabold text-[#ffcf7a] tabular-nums" aria-live="polite">
            {now < startAt ? Math.ceil((startAt - now) / 1000) : now < endsAt ? formatDuelClock(endsAt - now) : "0:00"}
          </span>
          <span className={`text-sm font-semibold ${pink.soft}`}>
            {now < startAt ? t("duel.startsIn", { seconds: Math.ceil((startAt - now) / 1000) }) : now < endsAt ? t("duel.inProgress") : t("duel.pending")}
          </span>
          {canEnterGame && now >= startAt && now < endsAt && (
            <Link href={`${Routes.PLAY}?duel=${duelId}`} className={`${pink.button} h-14 w-full text-xl`}>
              {t("duel.goPlay")}
            </Link>
          )}
        </section>
      )}

      {state.status === "finished" && (
        <section className="flex flex-col items-center gap-3 rounded-3xl bg-[#2a1226] p-5 text-center">
          <span className="font-heading text-[32px] leading-none font-extrabold">{isMember ? winnerText : t("duel.finished")}</span>
          {isMember && state.rematchId && (
            <Link href={`${Routes.DUEL}/${state.rematchId}`} className={`${pink.button} h-14 w-full text-xl`}>
              {t("duel.joinRematch")}
            </Link>
          )}
          {isMember && !state.rematchId && (
            <button className={`${pink.button} h-14 w-full text-xl`} disabled={busy} onClick={() => void rematch()}>
              <RotateCcwIcon aria-hidden="true" />
              {t("duel.rematch")}
            </button>
          )}
        </section>
      )}

      {state.status === "expired" && <p className="text-center text-sm text-muted-foreground">{t("duel.expired")}</p>}
    </div>
  )
}
