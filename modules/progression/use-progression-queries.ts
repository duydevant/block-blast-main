"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import { fetchJsonWithFirebaseIdToken } from "@/lib/firebase/fetch-json-with-firebase-id-token"
import { ApiRoutes } from "@/lib/routes"
import type { PlayerProfile } from "@/modules/player-profile/player-profile-types"
import { PLAYER_PROFILE_QUERY_KEY, usePlayerProfileQuery, useSignedInUid } from "@/modules/player-profile/use-player-profile-query"

import { levelForXp } from "./player-level-curve"
import type { ReferralInfoResponse } from "./referral-rules"
import type { ThemeOwnership } from "./theme-unlock-rules"

export const REFERRAL_QUERY_KEY = ["referral"] as const

/** Mã mời (server tạo ở lần gọi đầu). */
export function useReferralInfoQuery() {
  const uid = useSignedInUid()
  return useQuery({
    queryKey: [...REFERRAL_QUERY_KEY, uid],
    queryFn: () => fetchJsonWithFirebaseIdToken<ReferralInfoResponse>(ApiRoutes.REFERRAL, { method: "GET" }),
    enabled: uid !== null,
    staleTime: 60_000,
  })
}

/** Cấp + theme đã có của người chơi; null khi chưa tải được profile (offline, chưa đăng nhập). */
export function useThemeOwnership(): ThemeOwnership | null {
  const { data } = usePlayerProfileQuery()
  return data ? { level: levelForXp(data.xp), unlockedThemes: data.unlockedThemes } : null
}

export function useBuyThemeMutation() {
  const queryClient = useQueryClient()
  const uid = useSignedInUid()
  return useMutation({
    mutationFn: (themeId: string) =>
      fetchJsonWithFirebaseIdToken<PlayerProfile>(ApiRoutes.SHOP_THEMES, { method: "POST", body: { themeId } }),
    onSuccess: (profile) => queryClient.setQueryData([...PLAYER_PROFILE_QUERY_KEY, uid], profile),
  })
}
