import type { useI18n } from "@/lib/i18n"

import type { RankedGameMode } from "../player-profile-types"

type Translate = ReturnType<typeof useI18n>["t"]

/** Tên chế độ trong lịch sử / thống kê; màn chơi có số màn thì hiện "Màn 3", không có thì "Màn chơi". */
export function gameModeLabel(t: Translate, mode: RankedGameMode, levelId: number | null = null): string {
  if (mode === "level") return levelId === null ? t("nav.levels") : t("history.mode.level", { level: levelId })
  return t(`history.mode.${mode}`)
}
