"use client"

import { useMutation, useQueryClient } from "@tanstack/react-query"

import { fetchJsonWithFirebaseIdToken } from "@/lib/firebase/fetch-json-with-firebase-id-token"
import { ApiRoutes } from "@/lib/routes"
import { DAILY_STATUS_QUERY_KEY } from "@/modules/leaderboard/use-leaderboard-queries"
import type { DailyStatusResponse } from "@/modules/player-profile/player-profile-types"
import { useSignedInUid } from "@/modules/player-profile/use-player-profile-query"

import type { ReplaceDailyMissionResponse } from "./daily-mission-catalog"

/** Đổi 1 nhiệm vụ hôm nay (1 lần/ngày) → cập nhật thẳng trạng thái daily đang cache. */
export function useReplaceMissionMutation() {
  const queryClient = useQueryClient()
  const uid = useSignedInUid()
  return useMutation({
    mutationFn: (slot: number) =>
      fetchJsonWithFirebaseIdToken<ReplaceDailyMissionResponse>(ApiRoutes.MISSIONS_REPLACE, { method: "POST", body: { slot } }),
    onSuccess: ({ missions }) =>
      queryClient.setQueryData<DailyStatusResponse>([...DAILY_STATUS_QUERY_KEY, uid], (status) =>
        status ? { ...status, missions, missionReplaceAvailable: false } : status
      ),
  })
}
