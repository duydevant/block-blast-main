"use client"

import { useEffect } from "react"

import { type BeforeInstallPromptEvent, useInstallPromptStore } from "../install-prompt-store"
import { PWA_ENABLED, registerAppServiceWorker } from "../pwa-environment"

/** Đăng ký service worker (production) và giữ lại sự kiện cài app để hiện nút "Cài game" đúng lúc. */
export function PwaRuntime() {
  useEffect(() => {
    if (PWA_ENABLED && "serviceWorker" in navigator) {
      registerAppServiceWorker().catch((error: unknown) => console.warn("[pwa] service worker registration failed", error))
    }

    const { setDeferredPrompt } = useInstallPromptStore.getState()
    const onBeforeInstall = (event: Event) => {
      // Chặn banner mặc định; app tự hiện nút sau khi người chơi đã chơi vài ván.
      event.preventDefault()
      setDeferredPrompt(event as BeforeInstallPromptEvent)
    }
    const onInstalled = () => setDeferredPrompt(null)
    window.addEventListener("beforeinstallprompt", onBeforeInstall)
    window.addEventListener("appinstalled", onInstalled)
    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstall)
      window.removeEventListener("appinstalled", onInstalled)
    }
  }, [])

  return null
}
