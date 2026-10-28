"use client"

import Link from "next/link"
import { UserIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useFirebaseAuthStore } from "@/lib/auth/firebase-auth-store"
import { signOutToGuest } from "@/lib/auth/link-or-sign-in-with-google"
import { useI18n } from "@/lib/i18n"
import { Routes } from "@/lib/routes"
import { usePlayerDisplayName } from "@/modules/player-profile/components/use-player-display-name"

/** Menu tài khoản: luôn có người dùng (khách hoặc Google) khi Firebase sẵn sàng. */
export function UserNavMenu() {
  const { t } = useI18n()
  const player = useFirebaseAuthStore((state) => state.player)
  const displayName = usePlayerDisplayName()

  if (!player) return null

  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant="ghost" size="icon" aria-label={t("nav.account")} />}>
        <UserIcon />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuGroup>
          <DropdownMenuLabel>
            {displayName}
            {player.isAnonymous && <span className="block text-xs font-normal text-muted-foreground">{t("auth.guest")}</span>}
          </DropdownMenuLabel>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem render={<Link href={Routes.PROFILE} />}>{t("nav.profile")}</DropdownMenuItem>
        {player.isAnonymous ? (
          <DropdownMenuItem render={<Link href={Routes.PROFILE} />}>{t("auth.saveWithGoogle")}</DropdownMenuItem>
        ) : (
          <DropdownMenuItem onClick={() => void signOutToGuest()}>{t("nav.signOut")}</DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
