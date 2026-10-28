"use client"

import { useFirebaseAuthStore } from "@/lib/auth/firebase-auth-store"
import { useI18n } from "@/lib/i18n"

import { guestTagFromUid } from "../player-profile-types"
import { usePlayerProfileQuery } from "../use-player-profile-query"

/** Tên để hiện: tên đã đặt trên cloud → tên Google → "Khách #ABCD". */
export function usePlayerDisplayName(): string | null {
  const { t } = useI18n()
  const player = useFirebaseAuthStore((state) => state.player)
  const profile = usePlayerProfileQuery().data
  if (!player) return null
  return profile?.displayName ?? player.providerName ?? t("profile.guestName", { tag: guestTagFromUid(player.uid) })
}
