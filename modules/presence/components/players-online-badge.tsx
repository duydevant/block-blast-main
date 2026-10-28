"use client"

import { useQuery } from "@tanstack/react-query"

import { useI18n } from "@/lib/i18n"
import { ApiRoutes } from "@/lib/routes"

import { MIN_PLAYING_TO_SHOW, type PresenceCountResponse } from "../presence-paths"

async function fetchPresenceCount(): Promise<PresenceCountResponse> {
  const response = await fetch(ApiRoutes.PRESENCE)
  if (!response.ok) throw new Error(`presence ${response.status}`)
  return (await response.json()) as PresenceCountResponse
}

/** "● 12 người đang chơi" — bằng chứng xã hội cho người mới; ẩn khi quá ít hoặc lỗi. */
export function PlayersOnlineBadge() {
  const { t, formatNumber } = useI18n()
  const { data } = useQuery({ queryKey: ["presence-count"], queryFn: fetchPresenceCount, refetchInterval: 60_000, staleTime: 30_000, retry: false })
  if (!data || data.playing < MIN_PLAYING_TO_SHOW) return null

  return (
    <p className="flex items-center gap-2 text-sm font-medium text-muted-foreground" role="status">
      <span className="relative flex size-2.5">
        <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-75" />
        <span className="relative inline-flex size-2.5 rounded-full bg-emerald-500" />
      </span>
      {t("presence.playing", { count: formatNumber(data.playing) })}
    </p>
  )
}
