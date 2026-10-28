"use client"

import { useQueryClient } from "@tanstack/react-query"
import { useEffect, useRef } from "react"
import { toast } from "sonner"

import { ApiRequestError, fetchJsonWithFirebaseIdToken } from "@/lib/firebase/fetch-json-with-firebase-id-token"
import { useI18n } from "@/lib/i18n"
import { ApiRoutes } from "@/lib/routes"
import { safeLocalStorage } from "@/modules/block-puzzle/store/safe-local-storage"
import type { PlayerProfile } from "@/modules/player-profile/player-profile-types"
import { PLAYER_PROFILE_QUERY_KEY, useSignedInUid } from "@/modules/player-profile/use-player-profile-query"

import { normalizeReferralCode, REFERRAL_GAMES_REQUIRED, REFERRAL_QUERY_PARAM } from "../referral-rules"

const PENDING_REFERRAL_KEY = "block-puzzle.pendingReferral"

/**
 * Bắt mã từ link mời (`?ref=`), giữ lại tới khi có tài khoản (kể cả khách) rồi gửi lên server.
 * Bị từ chối hẳn (mã sai, đã được mời, đã chơi nhiều…) thì bỏ; lỗi mạng thì giữ để thử lần sau.
 */
export function ReferralLinkCapture() {
  const { t } = useI18n()
  // `t` đổi khi đổi ngôn ngữ; giữ qua ref để effect gửi mã không chạy lại (gửi trùng) vì lý do đó.
  const tRef = useRef(t)
  useEffect(() => {
    tRef.current = t
  }, [t])
  const uid = useSignedInUid()
  const queryClient = useQueryClient()

  useEffect(() => {
    const code = normalizeReferralCode(new URLSearchParams(window.location.search).get(REFERRAL_QUERY_PARAM) ?? "")
    if (code) void safeLocalStorage.setItem(PENDING_REFERRAL_KEY, code)
  }, [])

  useEffect(() => {
    if (!uid) return
    const pending = safeLocalStorage.getItem(PENDING_REFERRAL_KEY)
    const code = typeof pending === "string" ? normalizeReferralCode(pending) : null
    if (!code) return
    let cancelled = false
    fetchJsonWithFirebaseIdToken<PlayerProfile>(ApiRoutes.REFERRAL_CLAIM, { method: "POST", body: { code }, expectedUid: uid })
      .then((profile) => {
        void safeLocalStorage.removeItem(PENDING_REFERRAL_KEY)
        queryClient.setQueryData([...PLAYER_PROFILE_QUERY_KEY, uid], profile)
        if (!cancelled) toast.success(tRef.current("referral.claimed", { games: REFERRAL_GAMES_REQUIRED }))
      })
      .catch((error: unknown) => {
        const rejected = error instanceof ApiRequestError && error.status >= 400 && error.status < 500 && error.status !== 401
        if (rejected) void safeLocalStorage.removeItem(PENDING_REFERRAL_KEY)
        else console.warn("[referral] claim failed, will retry", error)
      })
    return () => {
      cancelled = true
    }
  }, [uid, queryClient])

  return null
}
