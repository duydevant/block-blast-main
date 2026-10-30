"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { GiftIcon } from "lucide-react"

import { useI18n } from "@/lib/i18n"
import { Routes } from "@/lib/routes"

import { currentRecapYear } from "../recap-window"

/** Banner trang chủ trong mùa tổng kết (15/12 → 15/01). Năm tính sau khi mount để HTML server/client khớp. */
export function RecapHomeBanner() {
  const { t } = useI18n()
  const [year, setYear] = useState<number | null>(null)
  useEffect(() => {
    const timer = window.setTimeout(() => setYear(currentRecapYear(Date.now())), 0)
    return () => window.clearTimeout(timer)
  }, [])
  if (year === null) return null
  return (
    <Link href={`${Routes.RECAP}/${year}`} className="flex items-center gap-3 rounded-3xl bg-gradient-to-r from-[#7c3aed] to-[#ff7eb6] p-3.5 font-bold text-white hover:brightness-110">
      <GiftIcon className="size-7 shrink-0" aria-hidden="true" />
      <span className="flex flex-col">
        <span className="font-heading text-lg leading-none font-extrabold">{t("recap.bannerTitle", { year })}</span>
        <span className="text-[13px] font-semibold text-white/85">{t("recap.bannerSub")}</span>
      </span>
    </Link>
  )
}
