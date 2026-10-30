"use client"

import { useQuery } from "@tanstack/react-query"

import { fetchJsonWithFirebaseIdToken } from "@/lib/firebase/fetch-json-with-firebase-id-token"
import { ApiRoutes } from "@/lib/routes"
import { useSignedInUid } from "@/modules/player-profile/use-player-profile-query"

import type { YearRecapResponse } from "./recap-types"

export function useYearRecapQuery(year: number) {
  const uid = useSignedInUid()
  return useQuery({
    queryKey: ["year-recap", uid, year],
    queryFn: () => fetchJsonWithFirebaseIdToken<YearRecapResponse>(`${ApiRoutes.RECAP}/${year}`, { method: "GET" }),
    enabled: uid !== null,
    staleTime: 5 * 60_000,
    retry: false,
  })
}
