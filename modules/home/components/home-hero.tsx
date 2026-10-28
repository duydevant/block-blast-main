"use client"

import Link from "next/link"
import { HandIcon, PlayIcon } from "lucide-react"

import { BlockBoardPreview } from "@/components/game-ui/block-board-preview"
import { CHUNKY_BUTTON, PANEL } from "@/components/game-ui/game-ui-classes"
import { useI18n } from "@/lib/i18n"
import { Routes } from "@/lib/routes"

/** Bàn mẫu: người mới nhìn là biết đây là game xếp khối 8×8. */
const SAMPLE_BOARD = ["........", "..55....", "..5.....", "22222.22", "........", "...44...", "1..44..7", "11....77"]

/** Khối đầu trang chủ: bàn mẫu + 1 dòng cách chơi + nút Chơi thật to. */
export function HomeHero() {
  const { t } = useI18n()
  return (
    <section className={`${PANEL} flex flex-col items-center gap-4 p-5`}>
      <BlockBoardPreview rows={SAMPLE_BOARD} className="w-full max-w-64" />
      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        <HandIcon className="size-4.5" aria-hidden="true" />
        {t("home.hint")}
      </p>
      <Link href={Routes.PLAY_ENDLESS} className={`${CHUNKY_BUTTON.primary} h-16 w-full text-[28px] [&_svg]:size-6.5`}>
        <PlayIcon className="fill-current" aria-hidden="true" />
        {t("ui.play")}
      </Link>
    </section>
  )
}
