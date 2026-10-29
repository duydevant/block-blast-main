"use client"

import { useState } from "react"
import { SparklesIcon } from "lucide-react"

import { AppEmptyState } from "@/components/common/app-empty-state"
import { PageHeader } from "@/components/game-ui/page-header"
import { useI18n } from "@/lib/i18n"
import { Routes } from "@/lib/routes"

import { GAME_HISTORY_MODES, type GameHistoryEntry } from "../game-history-types"
import type { RankedGameMode } from "../player-profile-types"
import { useGameHistoryQuery } from "../use-game-history-query"
import { gameModeLabel } from "./game-mode-label"
import { ScoreTrendSparkline } from "./score-trend-sparkline"

const TREND_GAMES = 30
const CHIP = "shrink-0 rounded-full px-3 py-1.5 text-[13px] font-bold transition"

function GameHistoryRow({ game }: { game: GameHistoryEntry }) {
  const { t, formatNumber, localeTag } = useI18n()
  const date = new Date(game.finishedAt).toLocaleString(localeTag, { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })
  const details = [
    t("history.moves", { count: formatNumber(game.moveCount) }),
    t("history.lines", { count: formatNumber(game.linesCleared) }),
    t("history.combo", { count: formatNumber(game.bestCombo) }),
  ]
  return (
    <li className="flex items-center gap-3 rounded-2xl bg-card px-3 py-2.5">
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="flex items-center gap-1.5 text-[13px] font-bold">
          {gameModeLabel(t, game.mode, game.levelId)}
          {game.pure && (
            <span className="inline-flex items-center gap-0.5 rounded-full bg-[#2ec4b6]/20 px-1.5 text-[11px] text-[#7fe0d6]" title={t("metrics.pureHint")}>
              <SparklesIcon className="size-3" aria-hidden="true" />
              {t("history.pure")}
            </span>
          )}
        </span>
        <span className="truncate text-[11px] text-muted-foreground">{details.join(" · ")}</span>
      </div>
      <div className="flex flex-col items-end">
        <span className="font-heading text-xl leading-none font-extrabold tabular-nums">{formatNumber(game.score)}</span>
        <time className="text-[11px] text-muted-foreground" dateTime={new Date(game.finishedAt).toISOString()}>
          {date}
        </time>
      </div>
    </li>
  )
}

/** Trang lịch sử ván: lọc theo chế độ, biểu đồ điểm gần nhất, danh sách phân trang. */
export function GameHistoryList() {
  const { t, formatNumber } = useI18n()
  const [mode, setMode] = useState<RankedGameMode | null>(null)
  const query = useGameHistoryQuery(mode)
  const games = query.data?.pages.flatMap((page) => page.items) ?? []
  const trend = games.slice(0, TREND_GAMES).map((game) => game.score).reverse()
  const filters: (RankedGameMode | null)[] = [null, ...GAME_HISTORY_MODES]

  return (
    <div className="flex flex-col gap-3">
      <PageHeader title={t("history.title")} backHref={Routes.PROFILE} />
      <p className="text-[13px] text-muted-foreground">{t("history.description")}</p>
      <div role="group" aria-label={t("modeStats.title")} className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
        {filters.map((item) => (
          <button
            key={item ?? "all"}
            aria-pressed={mode === item}
            onClick={() => setMode(item)}
            className={`${CHIP} ${mode === item ? "bg-[#ffb547] text-[#2a1600]" : "bg-card text-violet-200 hover:brightness-110"}`}
          >
            {item ? gameModeLabel(t, item) : t("history.all")}
          </button>
        ))}
      </div>
      <ScoreTrendSparkline scores={trend} label={t("history.trend", { count: formatNumber(trend.length) })} />
      {query.isError && <p className="text-sm text-destructive">{t("history.loadFailed")}</p>}
      {query.isPending && <p className="text-sm text-muted-foreground">{t("profile.loading")}</p>}
      {query.isSuccess && games.length === 0 && <AppEmptyState title={t("history.empty")} className="py-10" />}
      <ul className="flex flex-col gap-2">
        {games.map((game) => (
          <GameHistoryRow key={game.gameId} game={game} />
        ))}
      </ul>
      {query.hasNextPage && (
        <button
          onClick={() => query.fetchNextPage()}
          disabled={query.isFetchingNextPage}
          className="rounded-2xl bg-card py-3 text-sm font-bold hover:brightness-110 disabled:opacity-60"
        >
          {t("history.loadMore")}
        </button>
      )}
    </div>
  )
}
