"use client"

import { useState } from "react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { useFirebaseAuthStore } from "@/lib/auth/firebase-auth-store"
import { signOutToGuest } from "@/lib/auth/link-or-sign-in-with-google"
import { useI18n } from "@/lib/i18n"

import { DISPLAY_NAME_MAX_LENGTH, DISPLAY_NAME_MIN_LENGTH, normalizeDisplayName } from "../player-profile-types"
import { useUpdateDisplayNameMutation } from "../use-player-profile-query"
import { usePlayerDisplayName } from "./use-player-display-name"

/** Thông tin tài khoản: tên hiển thị (sửa được), khách hay Google, nút liên kết/đăng xuất. */
export function ProfileAccountCard() {
  const { t } = useI18n()
  const player = useFirebaseAuthStore((state) => state.player)
  const displayName = usePlayerDisplayName()
  const updateName = useUpdateDisplayNameMutation()
  const [draft, setDraft] = useState<string | null>(null)

  if (!player) return null
  const value = draft ?? displayName ?? ""
  const nameIsValid = normalizeDisplayName(value) !== null
  const rules = t("profile.nameInvalid", { min: DISPLAY_NAME_MIN_LENGTH, max: DISPLAY_NAME_MAX_LENGTH })

  const saveName = (event: React.FormEvent) => {
    event.preventDefault()
    if (!nameIsValid) return
    updateName.mutate(value, {
      onSuccess: () => {
        setDraft(null)
        toast.success(t("profile.nameSaved"))
      },
      onError: () => toast.error(t("profile.saveFailed")),
    })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("profile.cardTitle")}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        <form onSubmit={saveName}>
          <Field>
            <FieldLabel htmlFor="display-name">{t("profile.displayName")}</FieldLabel>
            {/* Ô nhập và nút Lưu cùng một hàng, cùng chiều cao → mép trên/dưới thẳng nhau. */}
            <div className="flex items-stretch gap-2">
              <Input
                id="display-name"
                className="h-11 flex-1 rounded-xl text-base"
                value={value}
                maxLength={DISPLAY_NAME_MAX_LENGTH}
                aria-invalid={!nameIsValid}
                aria-describedby="display-name-rules"
                onChange={(event) => setDraft(event.target.value)}
              />
              <Button type="submit" className="h-11 shrink-0 rounded-xl px-5 text-base font-bold" disabled={draft === null || !nameIsValid || updateName.isPending}>
                {t("profile.save")}
              </Button>
            </div>
            <FieldDescription id="display-name-rules">{rules}</FieldDescription>
          </Field>
        </form>

        {player.isAnonymous ? (
          <p className="text-sm text-muted-foreground">{t("profile.guestNote")}</p>
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground">{t("profile.googleNote", { email: player.email ?? "" })}</p>
            <Button variant="outline" onClick={() => void signOutToGuest()}>
              {t("nav.signOut")}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
