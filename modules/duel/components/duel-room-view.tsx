"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useEffect, useRef, useState } from "react"
import { EyeIcon } from "lucide-react"
import { toast } from "sonner"

import { MODE_THEME } from "@/components/game-ui/game-ui-classes"
import { PageHeader } from "@/components/game-ui/page-header"
import { ApiRequestError } from "@/lib/firebase/fetch-json-with-firebase-id-token"
import { useI18n } from "@/lib/i18n"
import { Routes } from "@/lib/routes"
import { useBlockPuzzleGameStore } from "@/modules/block-puzzle/store/block-puzzle-game-store"
import { startRankedGameCloudSync } from "@/modules/block-puzzle/store/ranked-game-cloud-sync"
import { guestTagFromUid } from "@/modules/player-profile/player-profile-types"
import { useSignedInUid } from "@/modules/player-profile/use-player-profile-query"

import { duelPlayHref, joinDuelRoom, settleDuelRoom } from "../duel-actions"
import { flushDuelMoves } from "../duel-move-stream"
import type { DuelPlayer } from "../duel-types"
import { useDuelMatch } from "../use-duel-match"
import { useDuelOnline } from "../use-duel-online"
import { formatDuelClock } from "./duel-hud"
import { DuelInviteButtons } from "./duel-invite-buttons"
import { DuelLiveBoards } from "./duel-live-boards"
import { DuelRoomCode } from "./duel-room-code"
import { DuelRoundFinished } from "./duel-round-finished"
import { DuelRoundHistory } from "./duel-round-history"
import { DuelRulesTiles } from "./duel-rules-tiles"
import { DuelVersusCard } from "./duel-versus-card"

const pink = MODE_THEME.duel

/**
 * Phòng đấu nhiều ván (cùng mã): chờ đối thủ → đếm ngược → hai người tự vào ván → kết quả → sẵn sàng ván tiếp.
 * Ai mở link/mã khi phòng đã đủ người là người xem: thấy hai bàn trực tiếp, tỉ số, số người đang xem.
 */
export function DuelRoomView({ duelId }: { duelId: string }) {
  const { t } = useI18n()
  const router = useRouter()
  const uid = useSignedInUid()
  const { state, now, accept } = useDuelMatch(duelId)
  const online = useDuelOnline(state ? duelId : null)
  const [busy, setBusy] = useState(false)
  const navigatedRound = useRef(0)
  // Save ván nằm ở store màn chơi (đọc lười) → biết đã chơi xong ván hiện tại trên máy này chưa.
  const saveReady = useBlockPuzzleGameStore((store) => store.hasHydrated)
  const localRound = useBlockPuzzleGameStore((store) => (store.variantRun?.kind === "duel" && store.variantRun.duelId === duelId ? store.variantRun.round : null))
  const localOver = useBlockPuzzleGameStore((store) => store.game?.isGameOver ?? false)
  useEffect(() => {
    void useBlockPuzzleGameStore.persist.rehydrate()
    // Rời màn chơi giữa ván vẫn phải nộp ván (thống kê) khi hết giờ → chạy sync nền ở đây nữa.
    return startRankedGameCloudSync(() => undefined)
  }, [])

  const isMember = Boolean(uid && state && (state.host.uid === uid || state.guest?.uid === uid))
  const round = state?.round ?? 0
  const localThisRound = localRound !== null && localRound === round
  // Vào ván khi: ván này đang dở trên máy, hoặc chưa từng vào (mỗi người một ván mỗi lượt).
  const canEnterGame = isMember && saveReady && !(localThisRound && localOver) && (localThisRound || !state?.started.includes(uid ?? ""))
  // Mình đã dừng ván này (bỏ trận / hết giờ) rồi về phòng → nhờ server chấm khi nước "dừng" đã lên RTDB.
  const stoppedHere = isMember && state?.status === "playing" && localThisRound && localOver
  useEffect(() => {
    if (!stoppedHere) return
    void flushDuelMoves()
      .then(() => settleDuelRoom(duelId))
      .then(accept)
      .catch((error: unknown) => console.warn("[duel] settle failed", error))
  }, [stoppedHere, duelId, accept])
  const startAt = state?.startAt ?? null
  const endsAt = state?.endsAt ?? null
  const inWindow = state?.status === "playing" && startAt !== null && endsAt !== null && now >= startAt && now < endsAt

  // Hết đếm ngược → hai người tự vào ván (một lần mỗi ván).
  useEffect(() => {
    if (!canEnterGame || !inWindow || navigatedRound.current === round) return
    navigatedRound.current = round
    router.push(duelPlayHref(duelId, round))
  }, [canEnterGame, inWindow, round, router, duelId])

  const nameOf = (player: DuelPlayer) => (player.uid === uid ? t("duel.you") : (player.name ?? t("profile.guestName", { tag: guestTagFromUid(player.uid) })))
  const join = async () => {
    setBusy(true)
    try {
      accept(await joinDuelRoom(duelId))
    } catch (error) {
      console.warn("[duel] join failed", error)
      const code = error instanceof ApiRequestError ? error.code : ""
      toast.error(t(code === "duel-full" ? "duel.full" : code === "duel-expired" ? "duel.expired" : "duel.joinFailed"))
    } finally {
      setBusy(false)
    }
  }

  if (state === undefined) return <p className="text-sm text-muted-foreground">{t("profile.loading")}</p>
  if (!state) return <p className="text-sm text-muted-foreground">{t("duel.notFound")}</p>

  const players = [state.host.uid, state.guest?.uid]
  const watchers = online ? online.filter((item) => !players.includes(item)).length : 0

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title={t("duel.title")} backHref={Routes.DUEL} />
      <DuelVersusCard state={state} nameOf={nameOf} online={online} />

      {state.status === "waiting" && (
        <>
          <DuelRulesTiles />
          {state.host.uid === uid ? (
            <>
              <DuelRoomCode code={duelId} />
              <DuelInviteButtons duelId={duelId} kind="join" />
            </>
          ) : (
            <button className={`${pink.button} h-16 text-[22px]`} disabled={busy || !uid} onClick={() => void join()}>
              {t("duel.join")}
            </button>
          )}
        </>
      )}

      {state.status === "playing" && startAt !== null && endsAt !== null && (
        <section className="flex flex-col items-center gap-3 rounded-3xl bg-[#2a1226] p-5 text-center">
          <span className="text-xs font-bold text-[#f5b3d1]">{t("duel.roundLabel", { round })}</span>
          <span className="font-heading text-5xl leading-none font-extrabold text-[#ffcf7a] tabular-nums" aria-live="polite">
            {now < startAt ? Math.ceil((startAt - now) / 1000) : now < endsAt ? formatDuelClock(endsAt - now) : "0:00"}
          </span>
          <span className={`text-sm font-semibold ${pink.soft}`}>
            {now < startAt ? t("duel.startsIn", { seconds: Math.ceil((startAt - now) / 1000) }) : now < endsAt ? t("duel.inProgress") : t("duel.settling")}
          </span>
          {canEnterGame && inWindow && (
            <Link href={duelPlayHref(duelId, round)} className={`${pink.button} h-14 w-full text-xl`}>
              {t("duel.goPlay")}
            </Link>
          )}
        </section>
      )}

      {state.status === "finished" && <DuelRoundFinished state={state} uid={uid} nameOf={nameOf} onState={accept} />}
      {(state.status === "playing" || state.status === "finished") && <DuelLiveBoards state={state} nameOf={nameOf} online={online} />}
      <DuelRoundHistory state={state} nameOf={nameOf} />

      {state.guest && state.status !== "expired" && (
        <div className="flex items-center justify-between gap-3">
          <span className={`flex items-center gap-1.5 text-sm font-semibold ${pink.soft}`}>
            <EyeIcon className="size-4" aria-hidden="true" />
            {isMember ? t("duel.watchers", { count: watchers }) : t("duel.spectating", { count: watchers })}
          </span>
          <DuelInviteButtons duelId={duelId} kind="watch" />
        </div>
      )}

      {state.status === "expired" && <p className="text-center text-sm text-muted-foreground">{t("duel.expired")}</p>}
    </div>
  )
}
