"use client"

import { useEffect } from "react"

import { Button } from "@/components/ui/button"
import { useI18n } from "@/lib/i18n"
import { isStaleDeployError, reloadOnceForStaleDeploy } from "@/lib/stale-deploy-error"

/** Lỗi ở mọi trang (nằm trong root layout nên có theme + i18n). Tab chạy bản build cũ sau deploy → tự tải lại một lần. */
export default function AppError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  const { t } = useI18n()

  useEffect(() => {
    console.error(error)
    if (isStaleDeployError(error)) reloadOnceForStaleDeploy()
  }, [error])

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-4 text-center">
      <h1 className="text-2xl font-bold">{t("error.title")}</h1>
      <p className="max-w-sm text-muted-foreground">{t("error.body")}</p>
      <div className="flex gap-2">
        <Button onClick={() => retry()}>{t("error.retry")}</Button>
        <Button variant="outline" onClick={() => window.location.reload()}>
          {t("error.reload")}
        </Button>
      </div>
      {/* Mã lỗi để đối chiếu log khi người chơi báo lỗi. */}
      <p className="max-w-sm text-xs break-all text-muted-foreground/70">{error.digest ?? error.message}</p>
    </div>
  )
}
