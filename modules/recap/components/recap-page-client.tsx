"use client"

import { useEffect, useState } from "react"
import { ChevronLeftIcon, ChevronRightIcon, Share2Icon } from "lucide-react"
import { toast } from "sonner"

import { PageHeader } from "@/components/game-ui/page-header"
import { type TranslationKey, useI18n } from "@/lib/i18n"
import { Routes } from "@/lib/routes"
import { siteConfig } from "@/lib/site"
import { gameModeLabel } from "@/modules/player-profile/components/game-mode-label"
import { usePlayerDisplayName } from "@/modules/player-profile/components/use-player-display-name"
import { renderRecapShareCard } from "@/modules/share/render-recap-share-card"
import { shareOrCopyLink } from "@/modules/share/share-or-copy-link"

import type { YearRecap } from "../recap-types"
import { useYearRecapQuery } from "../use-year-recap-query"

const SLIDE_COLORS = ["#2ec4b6", "#4ea8ff", "#ffb547", "#ff7eb6", "#c86bfa", "#9ad94a", "#ff8a3d", "#7fe0d6", "#ffcf47"]

/** Các thẻ của tổng kết: giá trị to + nhãn (theo thứ tự lật). */
function useRecapSlides(recap: YearRecap) {
  const { t, formatNumber } = useI18n()
  const slides: [label: TranslationKey, value: string][] = [
    ["recap.games", formatNumber(recap.games)],
    ["recap.bestScore", formatNumber(recap.bestScore)],
    ["recap.bestCombo", `x${formatNumber(recap.bestCombo)}`],
    ["recap.days", formatNumber(recap.days)],
    ["recap.favoriteMode", recap.favoriteMode ? gameModeLabel(t, recap.favoriteMode) : "–"],
    ["recap.longestStreak", formatNumber(recap.longestStreak)],
    ["recap.highestTier", t(`tier.${recap.highestTier}`)],
    ["recap.arenaPoints", formatNumber(recap.arenaPoints)],
    ["recap.levelStars", `${formatNumber(recap.levelStars)}★`],
  ]
  return slides.map(([label, value]) => ({ label: t(label), value }))
}

function RecapSlides({ recap }: { recap: YearRecap }) {
  const { t } = useI18n()
  const name = usePlayerDisplayName() ?? ""
  const slides = useRecapSlides(recap)
  const [index, setIndex] = useState(0)
  const [image, setImage] = useState<Blob | null>(null)
  const title = t("recap.shareTitle", { year: recap.year, name })

  // Vẽ ảnh sẵn: Web Share chỉ chạy trong "thao tác người dùng" (Safari rất ngắn) → không vẽ lúc bấm.
  useEffect(() => {
    let cancelled = false
    renderRecapShareCard({ siteName: siteConfig.name, title, stats: slides.slice(0, 6), footer: new URL(siteConfig.url).host })
      .then((blob) => !cancelled && setImage(blob))
      .catch((error: unknown) => console.warn("[recap] share image failed", error))
    return () => {
      cancelled = true
    }
    // slides đổi theo ngôn ngữ → vẽ lại theo title (cùng nguồn).
  }, [title]) // eslint-disable-line react-hooks/exhaustive-deps

  const share = () =>
    shareOrCopyLink({ title: siteConfig.name, text: title, url: new URL(Routes.HOME, siteConfig.url).toString(), image: image ?? undefined })
      .then((outcome) => outcome === "copied" && toast.success(t("share.copied")))
      .catch(() => toast.error(t("share.failed")))

  const slide = slides[index]
  return (
    <div className="flex flex-col gap-4">
      <div className="flex aspect-square flex-col items-center justify-center gap-3 rounded-[32px] bg-card p-6 text-center">
        <span className="text-sm font-bold text-muted-foreground">{t("recap.slideOf", { index: index + 1, total: slides.length })}</span>
        <span className="font-heading text-[64px] leading-none font-extrabold" style={{ color: SLIDE_COLORS[index % SLIDE_COLORS.length] }}>
          {slide.value}
        </span>
        <span className="text-lg font-bold">{slide.label}</span>
      </div>
      <div className="flex items-center justify-between gap-2">
        <button onClick={() => setIndex((value) => Math.max(0, value - 1))} disabled={index === 0} aria-label={t("recap.prev")} className="flex size-12 items-center justify-center rounded-2xl bg-card disabled:opacity-40">
          <ChevronLeftIcon aria-hidden="true" />
        </button>
        <button onClick={share} className="flex h-12 flex-1 items-center justify-center gap-2 rounded-2xl bg-[#ffb547] font-bold text-[#2a1600]">
          <Share2Icon className="size-4" aria-hidden="true" />
          {t("recap.share")}
        </button>
        <button onClick={() => setIndex((value) => Math.min(slides.length - 1, value + 1))} disabled={index === slides.length - 1} aria-label={t("recap.next")} className="flex size-12 items-center justify-center rounded-2xl bg-card disabled:opacity-40">
          <ChevronRightIcon aria-hidden="true" />
        </button>
      </div>
    </div>
  )
}

/** Trang tổng kết năm: thẻ số liệu lật lần lượt + chia sẻ ảnh 1080×1080. */
export function RecapPageClient({ year }: { year: number }) {
  const { t } = useI18n()
  const query = useYearRecapQuery(year)
  return (
    <div className="flex flex-col gap-4">
      <PageHeader title={t("recap.title", { year })} />
      {query.isError && <p className="text-sm text-muted-foreground">{t("recap.closed")}</p>}
      {query.isPending && !query.isError && <p className="text-sm text-muted-foreground">{t("profile.loading")}</p>}
      {query.data?.empty && <p className="text-sm text-muted-foreground">{t("recap.empty")}</p>}
      {query.data && !query.data.empty && <RecapSlides recap={query.data} />}
    </div>
  )
}
