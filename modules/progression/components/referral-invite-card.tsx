"use client"

import { GiftIcon } from "lucide-react"
import { toast } from "sonner"

import { MODE_THEME } from "@/components/game-ui/game-ui-classes"
import { useI18n } from "@/lib/i18n"
import { siteConfig } from "@/lib/site"
import { shareOrCopyLink } from "@/modules/share/share-or-copy-link"

import { REFERRAL_COINS, REFERRAL_QUERY_PARAM } from "../referral-rules"
import { useReferralInfoQuery } from "../use-progression-queries"

/** Thẻ mời bạn: 1 dòng lợi ích + nút "Mời" chia sẻ link `/?ref=CODE`. */
export function ReferralInviteCard() {
  const { t, formatNumber } = useI18n()
  const referral = useReferralInfoQuery()
  const code = referral.data?.code

  const share = () => {
    if (!code) return
    const url = new URL(siteConfig.url)
    url.searchParams.set(REFERRAL_QUERY_PARAM, code)
    shareOrCopyLink({ title: siteConfig.name, text: t("referral.shareText", { name: siteConfig.name }), url: url.toString() })
      .then((outcome) => outcome === "copied" && toast.success(t("share.copied")))
      .catch((error: unknown) => {
        console.warn("[referral] share failed", error)
        toast.error(t("share.failed"))
      })
  }

  return (
    <section className={`flex items-center gap-3 rounded-3xl p-3.5 ${MODE_THEME.event.card}`}>
      <GiftIcon className="size-8 shrink-0 text-[#c86bfa]" aria-hidden="true" />
      <span className="flex min-w-0 flex-col leading-tight">
        <span className="font-extrabold">{t("profile.inviteShort", { coins: formatNumber(REFERRAL_COINS) })}</span>
        <span className={`text-xs ${MODE_THEME.event.soft}`}>
          {code ? `${t("referral.code", { code })} · ${t("referral.count", { count: referral.data?.referralCount ?? 0 })}` : t("profile.inviteSub")}
        </span>
      </span>
      <button className="ml-auto h-10 shrink-0 rounded-xl bg-[#c86bfa] px-4 font-extrabold text-[#22062f] disabled:opacity-50" disabled={!code} onClick={share}>
        {t("profile.invite")}
      </button>
    </section>
  )
}
