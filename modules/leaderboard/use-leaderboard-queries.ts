"use client"

import { useQuery } from "@tanstack/react-query"

import { fetchJsonWithFirebaseIdToken } from "@/lib/firebase/fetch-json-with-firebase-id-token"
import { ApiRoutes } from "@/lib/routes"
import type { DailyStatusResponse } from "@/modules/player-profile/player-profile-types"
import { useSignedInUid } from "@/modules/player-profile/use-player-profile-query"

import type { LeaderboardPeriod, LeaderboardResponse } from "./leaderboard-types"

/** Prefix chung để làm mới mọi bảng sau khi nộp ván. */
export const LEADERBOARD_QUERY_KEY = ["leaderboard"] as const
export const DAILY_STATUS_QUERY_KEY = ["daily-status"] as const

export function useLeaderboardQuery(period: LeaderboardPeriod) {
  const uid = useSignedInUid()
  return useQuery({
    queryKey: [...LEADERBOARD_QUERY_KEY, period, uid],
    queryFn: () => fetchJsonWithFirebaseIdToken<LeaderboardResponse>(`${ApiRoutes.LEADERBOARDS}/${period}`, { method: "GET" }),
    enabled: uid !== null,
    staleTime: 30_000,
  })
}

export function useDailyStatusQuery() {
  const uid = useSignedInUid()
  return useQuery({
    queryKey: [...DAILY_STATUS_QUERY_KEY, uid],
    queryFn: () => fetchJsonWithFirebaseIdToken<DailyStatusResponse>(ApiRoutes.DAILY, { method: "GET" }),
    enabled: uid !== null,
    staleTime: 30_000,
  })
}

/** "20261027" → "27/10" (vi) / "10/27" (en). */
export function formatDayKey(day: string, localeTag: string): string {
  const date = new Date(Date.UTC(Number(day.slice(0, 4)), Number(day.slice(4, 6)) - 1, Number(day.slice(6, 8))))
  return date.toLocaleDateString(localeTag, { day: "numeric", month: "numeric", timeZone: "UTC" })
}
