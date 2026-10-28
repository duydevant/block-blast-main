"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import { useFirebaseAuthStore } from "@/lib/auth/firebase-auth-store"
import { fetchJsonWithFirebaseIdToken } from "@/lib/firebase/fetch-json-with-firebase-id-token"
import { ApiRoutes } from "@/lib/routes"

import type { PlayerProfile } from "./player-profile-types"

export const PLAYER_PROFILE_QUERY_KEY = ["player-profile"] as const

/** uid khi đã đăng nhập xong (kể cả khách); null khi đang tải/lỗi/không cấu hình Firebase. */
export function useSignedInUid(): string | null {
  return useFirebaseAuthStore((state) => (state.status === "ready" ? (state.player?.uid ?? null) : null))
}

export function usePlayerProfileQuery() {
  const uid = useSignedInUid()
  return useQuery({
    queryKey: [...PLAYER_PROFILE_QUERY_KEY, uid],
    queryFn: () => fetchJsonWithFirebaseIdToken<PlayerProfile>(ApiRoutes.PROFILE, { method: "GET" }),
    enabled: uid !== null,
    staleTime: 60_000,
  })
}

export function useUpdateDisplayNameMutation() {
  const queryClient = useQueryClient()
  const uid = useSignedInUid()
  return useMutation({
    mutationFn: (displayName: string) =>
      fetchJsonWithFirebaseIdToken<PlayerProfile>(ApiRoutes.PROFILE, { method: "PATCH", body: { displayName } }),
    onSuccess: (profile) => queryClient.setQueryData([...PLAYER_PROFILE_QUERY_KEY, uid], profile),
  })
}
