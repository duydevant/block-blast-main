"use client"

import { BellIcon, BellOffIcon } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { useI18n } from "@/lib/i18n"

import { usePushReminders } from "../use-push-reminders"

/**
 * Nút bật/tắt nhắc nhở + giải thích khi không bật được (iOS chưa cài, đã chặn, không hỗ trợ).
 * `onlyOffer`: chỉ hiện nút bật khi đang tắt (dùng làm lời mời ngắn ở trang chủ).
 */
export function PushReminderToggle({ enableLabel, onlyOffer = false }: { enableLabel?: string; onlyOffer?: boolean }) {
  const { t } = useI18n()
  const { status, enable, disable } = usePushReminders()
  const [busy, setBusy] = useState(false)

  const run = async (action: () => Promise<unknown>, success: () => void) => {
    setBusy(true)
    try {
      await action()
      success()
    } catch (error) {
      console.warn("[push] toggle failed", error)
      toast.error(t("push.failed"))
    } finally {
      setBusy(false)
    }
  }

  if (status === "loading" || (onlyOffer && status !== "off")) return null
  if (status === "unsupported") return <p className="text-xs text-muted-foreground">{t("push.unsupported")}</p>
  if (status === "needs-install") return <p className="text-xs text-muted-foreground">{t("push.needsInstall")}</p>
  if (status === "denied") return <p className="text-xs text-muted-foreground">{t("push.denied")}</p>
  if (status === "on") {
    return (
      <Button variant="outline" disabled={busy} onClick={() => void run(disable, () => toast.success(t("push.disabled")))}>
        <BellOffIcon data-icon="inline-start" />
        {t("push.disable")}
      </Button>
    )
  }
  return (
    <Button disabled={busy} onClick={() => void run(enable, () => toast.success(t("push.enabled")))}>
      <BellIcon data-icon="inline-start" />
      {enableLabel ?? t("push.enable")}
    </Button>
  )
}
