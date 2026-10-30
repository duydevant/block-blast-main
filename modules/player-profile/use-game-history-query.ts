"use client"

import { useInfiniteQuery } from "@tanstack/react-query"

import { fetchJsonWithFirebaseIdToken } from "@/lib/firebase/fetch-json-with-firebase-id-token"
import { ApiRoutes } from "@/lib/routes"

import type { GameHistoryResponse } from "./game-history-types"
import type { RankedGameMode } from "./player-profile-types"
import { useSignedInUid } from "./use-player-profile-query"

export const GAME_HISTORY_QUERY_KEY = ["game-history"] as const

/** Lịch sử ván của chính mình, phân trang bằng cursor; `mode` null = mọi chế độ. */
export function useGameHistoryQuery(mode: RankedGameMode | null) {
  const uid = useSignedInUid()
  return useInfiniteQuery({
    queryKey: [...GAME_HISTORY_QUERY_KEY, uid, mode],
    queryFn: ({ pageParam }) => {
      const params = new URLSearchParams()
      if (mode) params.set("mode", mode)
      if (pageParam) params.set("cursor", pageParam)
      const query = params.toString()
      return fetchJsonWithFirebaseIdToken<GameHistoryResponse>(`${ApiRoutes.GAMES_HISTORY}${query ? `?${query}` : ""}`, { method: "GET" })
    },
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.nextCursor,
    enabled: uid !== null,
    staleTime: 30_000,
  })
}
