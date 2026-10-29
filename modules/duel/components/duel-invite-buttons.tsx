"use client"

import { LinkIcon, SendIcon } from "lucide-react"
import { toast } from "sonner"

import { CHUNKY_BUTTON, MODE_THEME } from "@/components/game-ui/game-ui-classes"
import { useI18n } from "@/lib/i18n"
import { siteConfig } from "@/lib/site"
import { shareOrCopyLink } from "@/modules/share/share-or-copy-link"

import { duelUrl } from "../duel-actions"

const STYLES = {
  /** Mời vào đấu (chủ phòng đang chờ): nút to màu chế độ. */
  join: { share: `${MODE_THEME.duel.button} h-16 flex-1 text-[22px] [&_svg]:size-6`, copy: `${CHUNKY_BUTTON.secondary} h-16 px-4 text-base` },
  /** Mời xem: nút phụ nhỏ. */
  watch: { share: `${CHUNKY_BUTTON.secondary} h-11 px-4 text-sm`, copy: `${CHUNKY_BUTTON.secondary} h-11 px-3 text-sm` },
} as const

/**
 * "Gửi link mời" (bảng chia sẻ của máy → Zalo/Messenger…) + "Copy link" ngay cạnh: nhiều người chỉ muốn
 * copy link rồi tự dán cho bạn bè. Mời đấu và mời xem dùng chung link phòng (đủ người thì vào là xem).
 */
export function DuelInviteButtons({ duelId, kind }: { duelId: string; kind: "join" | "watch" }) {
  const { t } = useI18n()
  const url = duelUrl(duelId)
  const style = STYLES[kind]
  const text = t(kind === "join" ? "duel.shareText" : "duel.watchShareText", { name: siteConfig.name, code: duelId })

  const share = () =>
    shareOrCopyLink({ title: siteConfig.name, text, url })
      .then((outcome) => outcome === "copied" && toast.success(t("share.copied")))
      .catch(() => toast.error(t("share.failed")))
  const copy = () =>
    navigator.clipboard
      .writeText(url)
      .then(() => toast.success(t("duel.linkCopied")))
      .catch(() => toast.error(t("share.failed")))

  return (
    <div className="flex items-center gap-2">
      <button className={style.share} onClick={() => void share()}>
        <SendIcon aria-hidden="true" />
        {t(kind === "join" ? "duel.share" : "duel.inviteWatch")}
      </button>
      <button className={style.copy} onClick={() => void copy()}>
        <LinkIcon aria-hidden="true" />
        {t("duel.copyLink")}
      </button>
    </div>
  )
}
