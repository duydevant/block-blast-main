"use client"

import { CopyIcon } from "lucide-react"
import { toast } from "sonner"

import { useI18n } from "@/lib/i18n"

/** Mã phòng in to (đọc cho bạn bè gõ) + nút copy. */
export function DuelRoomCode({ code }: { code: string }) {
  const { t } = useI18n()
  const copy = () =>
    navigator.clipboard
      .writeText(code)
      .then(() => toast.success(t("duel.codeCopied")))
      .catch(() => toast.error(t("share.failed")))

  return (
    <section className="flex flex-col items-center gap-2 rounded-3xl bg-[#2a1226] p-4 text-center">
      <span className="text-xs font-bold tracking-wider text-[#f5b3d1] uppercase">{t("duel.code")}</span>
      <div className="flex items-center gap-3">
        <span className="font-heading text-[44px] leading-none font-extrabold tracking-[0.2em] select-all">{code}</span>
        <button
          onClick={() => void copy()}
          aria-label={t("duel.copyCode")}
          className="flex size-11 items-center justify-center rounded-2xl bg-[#3d1530] text-[#ff7eb6] hover:bg-[#4d1c3d]"
        >
          <CopyIcon className="size-5" aria-hidden="true" />
        </button>
      </div>
      <span className="text-xs text-[#f5b3d1]">{t("duel.codeHint")}</span>
    </section>
  )
}
