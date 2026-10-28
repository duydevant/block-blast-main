"use client"

import { useRef, useState } from "react"
import { toast } from "sonner"

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { linkOrSignInWithGoogle } from "@/lib/auth/link-or-sign-in-with-google"
import { useI18n } from "@/lib/i18n"

/**
 * Nút "Lưu tiến trình bằng Google" cho tài khoản khách.
 * Google đã gắn với tài khoản khác → mở hộp xác nhận trước khi chuyển tài khoản.
 */
export function GoogleAccountButton({ className }: { className?: string }) {
  const { t } = useI18n()
  const [busy, setBusy] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const resolveConfirm = useRef<((accepted: boolean) => void) | null>(null)

  const askSwitchAccount = () =>
    new Promise<boolean>((resolve) => {
      resolveConfirm.current = resolve
      setConfirmOpen(true)
    })

  const answer = (accepted: boolean) => {
    setConfirmOpen(false)
    resolveConfirm.current?.(accepted)
    resolveConfirm.current = null
  }

  const connect = async () => {
    setBusy(true)
    try {
      const outcome = await linkOrSignInWithGoogle(askSwitchAccount)
      if (outcome === "linked") toast.success(t("auth.linked"))
      if (outcome === "switched") toast.success(t("auth.switched"))
    } catch (error) {
      console.warn("[auth] google link failed", error)
      toast.error(t("auth.linkFailed"))
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <Button className={className} disabled={busy} onClick={() => void connect()}>
        {t("auth.saveWithGoogle")}
      </Button>
      <AlertDialog open={confirmOpen} onOpenChange={(open) => !open && answer(false)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("auth.switchTitle")}</AlertDialogTitle>
            <AlertDialogDescription>{t("auth.switchDescription")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => answer(false)}>{t("auth.cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={() => answer(true)}>{t("auth.switchConfirm")}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
