"use client"

import Link from "next/link"
import { ChevronLeftIcon } from "lucide-react"

import { useI18n } from "@/lib/i18n"
import { Routes } from "@/lib/routes"

import { ICON_TILE } from "./game-ui-classes"

/** Đầu trang con: nút quay lại + tiêu đề + chỗ cho chip bên phải. */
export function PageHeader({ title, backHref = Routes.HOME, children }: { title: string; backHref?: string; children?: React.ReactNode }) {
  const { t } = useI18n()
  return (
    <header className="flex items-center gap-3">
      <Link href={backHref} className={ICON_TILE} aria-label={t("ui.back")}>
        <ChevronLeftIcon aria-hidden="true" />
      </Link>
      <h1 className="font-heading text-[26px] leading-none font-extrabold">{title}</h1>
      {children && <div className="ml-auto flex items-center gap-2">{children}</div>}
    </header>
  )
}
