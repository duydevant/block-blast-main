"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import { fetchJsonWithFirebaseIdToken } from "@/lib/firebase/fetch-json-with-firebase-id-token"
import { ApiRoutes } from "@/lib/routes"
import { PLAYER_PROFILE_QUERY_KEY, useSignedInUid } from "@/modules/player-profile/use-player-profile-query"
import type { SeasonClaimRequest, SeasonClaimResponse, SeasonStatusResponse } from "@/modules/progression/season-rules"

export const SEASON_QUERY_KEY = ["season"] as const

export function useSeasonStatusQuery() {
  const uid = useSignedInUid()
  return useQuery({
    queryKey: [...SEASON_QUERY_KEY, uid],
    queryFn: () => fetchJsonWithFirebaseIdToken<SeasonStatusResponse>(ApiRoutes.SEASONS, { method: "GET" }),
    enabled: uid !== null,
    staleTime: 30_000,
  })
}

export function useClaimSeasonRewardMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (request: SeasonClaimRequest) =>
      fetchJsonWithFirebaseIdToken<SeasonClaimResponse>(ApiRoutes.SEASONS_CLAIM, { method: "POST", body: request }),
    onSuccess: () =>
      Promise.all([queryClient.invalidateQueries({ queryKey: SEASON_QUERY_KEY }), queryClient.invalidateQueries({ queryKey: PLAYER_PROFILE_QUERY_KEY })]),
  })
}

/** "2026-11" → "11/2026". */
export function formatSeasonKey(season: string): string {
  return `${season.slice(5, 7)}/${season.slice(0, 4)}`
}
