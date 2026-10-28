"use client"

import { DownloadIcon } from "lucide-react"
import { useSyncExternalStore } from "react"

import { Button } from "@/components/ui/button"
import { useI18n } from "@/lib/i18n"

import { useInstallPromptStore } from "../install-prompt-store"
import { isIosDevice, isStandaloneDisplay } from "../pwa-environment"

const noopSubscribe = () => () => {}

/** iOS chưa cài thì chỉ hướng dẫn được (Safari không có API cài). Tính ở client, server trả false. */
function useNeedsIosInstallHint(): boolean {
  return useSyncExternalStore(noopSubscribe, () => isIosDevice() && !isStandaloneDisplay(), () => false)
}

/** Nút "Cài game" (Chromium) hoặc hướng dẫn thêm vào MH chính (iOS); không hiện gì khi đã cài/không hỗ trợ. */
export function InstallAppButton({ className, showIosHint = true }: { className?: string; showIosHint?: boolean }) {
  const { t } = useI18n()
  const deferredPrompt = useInstallPromptStore((state) => state.deferredPrompt)
  const setDeferredPrompt = useInstallPromptStore((state) => state.setDeferredPrompt)
  const iosHint = useNeedsIosInstallHint()

  if (deferredPrompt) {
    const install = async () => {
      await deferredPrompt.prompt()
      // Mỗi sự kiện chỉ prompt được một lần.
      setDeferredPrompt(null)
    }
    return (
      <Button className={className} onClick={() => void install()}>
        <DownloadIcon data-icon="inline-start" />
        {t("pwa.install")}
      </Button>
    )
  }
  return showIosHint && iosHint ? <p className="text-xs text-muted-foreground">{t("pwa.iosHint")}</p> : null
}
