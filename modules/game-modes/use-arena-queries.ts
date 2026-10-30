"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import { fetchJsonWithFirebaseIdToken } from "@/lib/firebase/fetch-json-with-firebase-id-token"
import { ApiRoutes } from "@/lib/routes"
import { PLAYER_PROFILE_QUERY_KEY, useSignedInUid } from "@/modules/player-profile/use-player-profile-query"

import type { ArenaType } from "./arena-catalog"
import type { ArenaRunView, ArenaStatusResponse } from "./arena-types"

export const ARENA_QUERY_KEY = ["arena"] as const

export function useArenaStatusQuery() {
  const uid = useSignedInUid()
  return useQuery({
    queryKey: [...ARENA_QUERY_KEY, uid],
    queryFn: () => fetchJsonWithFirebaseIdToken<ArenaStatusResponse>(ApiRoutes.ARENA, { method: "GET" }),
    enabled: uid !== null,
    staleTime: 15_000,
  })
}

/** Mở / bỏ lượt → làm mới lượt đang mở + hồ sơ (xu). */
function useArenaInvalidation() {
  const queryClient = useQueryClient()
  return () => Promise.all([queryClient.invalidateQueries({ queryKey: ARENA_QUERY_KEY }), queryClient.invalidateQueries({ queryKey: PLAYER_PROFILE_QUERY_KEY })])
}

export function useStartArenaRunMutation() {
  const invalidate = useArenaInvalidation()
  return useMutation({
    mutationFn: (input: { type: ArenaType; level: number }) =>
      fetchJsonWithFirebaseIdToken<ArenaRunView>(ApiRoutes.ARENA_RUNS, { method: "POST", body: input }),
    onSuccess: invalidate,
  })
}

export function useAbandonArenaRunMutation() {
  const invalidate = useArenaInvalidation()
  return useMutation({
    mutationFn: () => fetchJsonWithFirebaseIdToken<ArenaStatusResponse>(ApiRoutes.ARENA_ABANDON, { method: "POST" }),
    onSuccess: invalidate,
  })
}
