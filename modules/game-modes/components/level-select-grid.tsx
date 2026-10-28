"use client"

import Link from "next/link"
import { StarIcon } from "lucide-react"

import { BlockBoardPreview } from "@/components/game-ui/block-board-preview"
import { MODE_THEME } from "@/components/game-ui/game-ui-classes"
import { PageHeader } from "@/components/game-ui/page-header"
import { useI18n } from "@/lib/i18n"
import { Routes } from "@/lib/routes"

import { BOARD_PATTERNS } from "../board-patterns"
import { isLevelUnlocked, type LevelDefinition, LEVEL_COUNT, LEVELS } from "../level-catalog"
import { useLevelStars } from "../level-progress-store"
import { levelGoalLabel } from "./variant-mode-badge"

const TILE = "flex aspect-square flex-col items-center justify-center gap-1 rounded-[18px] transition"

/** Bàn dựng sẵn của màn → chuỗi dòng cho bàn mini ("#" đá → màu 8). */
function patternRows(definition: LevelDefinition): string[] {
  const cells = BOARD_PATTERNS[definition.pattern]
  return Array.from({ length: 8 }, (_, row) =>
    cells
      .slice(row * 8, row * 8 + 8)
      .map((cell) => (cell ? "8" : "."))
      .join("")
  )
}

/** Trang /levels: lưới 20 màn (sao / màn đang tới / khoá) + thẻ màn tiếp theo với nút Chơi. */
export function LevelSelectGrid() {
  const { t, formatNumber } = useI18n()
  const stars = useLevelStars()
  const starTotal = Object.values(stars).reduce((sum, value) => sum + value, 0)
  const current = LEVELS.find((definition) => !stars[String(definition.id)] && isLevelUnlocked(definition.id, stars)) ?? LEVELS[LEVEL_COUNT - 1]

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title={t("levels.title")}>
        <span className="flex items-center gap-1.5 rounded-full bg-[#1b2c52] px-3 py-1.5 font-extrabold">
          <StarIcon className="size-4 fill-[#ffcf4a] text-[#ffcf4a]" aria-hidden="true" />
          {starTotal}/{LEVEL_COUNT * 3}
        </span>
      </PageHeader>

      <ol className="grid grid-cols-4 gap-2.5">
        {LEVELS.map((definition) => {
          const earned = stars[String(definition.id)] ?? 0
          const unlocked = isLevelUnlocked(definition.id, stars)
          const isCurrent = definition.id === current.id && earned === 0
          const label = `${t("levels.level", { id: definition.id })} · ${levelGoalLabel(t, formatNumber, definition)}`
          return (
            <li key={definition.id}>
              {unlocked ? (
                <Link
                  href={`${Routes.PLAY}?level=${definition.id}`}
                  aria-label={label}
                  className={`${TILE} ${isCurrent ? "bg-[#4ea8ff] text-[#061a33] ring-4 ring-[#4ea8ff] ring-offset-4 ring-offset-background" : "bg-[#1b3a66] hover:bg-[#244a80]"}`}
                >
                  <span className="font-heading text-[22px] leading-none font-extrabold">{definition.id}</span>
                  <span className="text-[11px] font-bold tracking-wider text-[#ffcf4a]">
                    {isCurrent ? <span className="text-[#061a33]">{t("levels.playShort")}</span> : "★".repeat(earned) + "☆".repeat(3 - earned)}
                  </span>
                </Link>
              ) : (
                <div className={`${TILE} bg-[#15233f] text-[#8195b8]`} title={t("levels.locked")} aria-label={`${label} · ${t("levels.locked")}`}>
                  <span className="font-heading text-[22px] leading-none font-extrabold">{definition.id}</span>
                  <span className="text-[11px]">{t("levels.locked.short")}</span>
                </div>
              )}
            </li>
          )
        })}
      </ol>

      <section className={`flex items-center gap-3.5 rounded-3xl border-2 border-[#4ea8ff] p-4 ${MODE_THEME.levels.card}`}>
        <BlockBoardPreview rows={patternRows(current)} cellGap={2} className="w-24 shrink-0 p-1.5" />
        <div className="flex flex-1 flex-col gap-1.5">
          <span className="font-heading text-[22px] leading-none font-extrabold">{t("levels.level", { id: current.id })}</span>
          <span className="flex flex-wrap gap-1.5">
            <span className="rounded-full bg-[#1b3a66] px-2.5 py-0.5 text-xs font-bold">{levelGoalLabel(t, formatNumber, current)}</span>
            <span className="rounded-full bg-[#1b3a66] px-2.5 py-0.5 text-xs font-bold">{t("levels.moves", { count: current.moveLimit })}</span>
          </span>
          <Link href={`${Routes.PLAY}?level=${current.id}`} className={`${MODE_THEME.levels.button} h-11 text-[19px]`}>
            {t("levels.play")}
          </Link>
        </div>
      </section>
    </div>
  )
}
