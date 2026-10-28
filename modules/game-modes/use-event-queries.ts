"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import { fetchJsonWithFirebaseIdToken } from "@/lib/firebase/fetch-json-with-firebase-id-token"
import { ApiRoutes } from "@/lib/routes"
import { PLAYER_PROFILE_QUERY_KEY, useSignedInUid } from "@/modules/player-profile/use-player-profile-query"

import type { ClaimEventRewardRequest, ClaimEventRewardResponse, EventStatusResponse } from "./event-rewards"

export const EVENT_STATUS_QUERY_KEY = ["event-status"] as const

export function useEventStatusQuery() {
  const uid = useSignedInUid()
  return useQuery({
    queryKey: [...EVENT_STATUS_QUERY_KEY, uid],
    queryFn: () => fetchJsonWithFirebaseIdToken<EventStatusResponse>(ApiRoutes.EVENTS, { method: "GET" }),
    enabled: uid !== null,
    staleTime: 30_000,
  })
}

export function useClaimEventRewardMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (request: ClaimEventRewardRequest) =>
      fetchJsonWithFirebaseIdToken<ClaimEventRewardResponse>(ApiRoutes.EVENTS_CLAIM, { method: "POST", body: request }),
    onSuccess: () => {
      for (const queryKey of [EVENT_STATUS_QUERY_KEY, PLAYER_PROFILE_QUERY_KEY]) void queryClient.invalidateQueries({ queryKey })
    },
  })
}

/** Còn bao nhiêu thưởng sự kiện chờ nhận (để báo trên trang chủ). */
export function useClaimableEventRewards(): number {
  const data = useEventStatusQuery().data
  if (!data) return 0
  const pendingMilestones = (week: { milestones: { reached: boolean; claimed: boolean }[] }) =>
    week.milestones.filter((milestone) => milestone.reached && !milestone.claimed).length
  const previous = data.previous
  return pendingMilestones(data.current) + (previous ? pendingMilestones(previous) + (previous.rankClaimed || previous.rankCoins === 0 ? 0 : 1) : 0)
}
