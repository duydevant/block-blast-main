"use client"

import Link from "next/link"

import { useI18n } from "@/lib/i18n"
import { Routes } from "@/lib/routes"
import { cn } from "@/lib/utils"
import { guestTagFromUid } from "@/modules/player-profile/player-profile-types"
import { useSignedInUid } from "@/modules/player-profile/use-player-profile-query"

import type { LeaderboardPeriod, LeaderboardRow } from "../leaderboard-types"
import { useLeaderboardQuery } from "../use-leaderboard-queries"

/** Bục top 3 (giữa cao nhất), màu vàng / bạc / đồng. */
const PODIUM = [
  { place: 2, height: "h-[88px]", avatar: "size-13 bg-[#c9d4e0]" },
  { place: 1, height: "h-[112px]", avatar: "size-16 bg-[#ffcf4a]" },
  { place: 3, height: "h-[72px]", avatar: "size-13 bg-[#e8a36b]" },
] as const

/**
 * Top của một kỳ: bục top 3 + danh sách + thanh "hạng của bạn" (kể cả khi ngoài top).
 * `initialTop` (render server) hiện trong lúc chờ đăng nhập/tải, chưa có thanh hạng của mình.
 */
export function LeaderboardTable({ period, initialTop }: { period: LeaderboardPeriod; initialTop?: LeaderboardRow[] }) {
  const { t, formatNumber } = useI18n()
  const uid = useSignedInUid()
  const query = useLeaderboardQuery(period)

  if (query.isError && !initialTop) return <p className="text-sm text-destructive">{t("leaderboard.loadFailed")}</p>
  if (!query.data && !initialTop) return <p className="text-sm text-muted-foreground">{t("profile.loading")}</p>

  const top = query.data?.top ?? initialTop ?? []
  const me = query.data?.me ?? null
  const nameOf = (row: { uid: string; displayName: string | null }) =>
    row.displayName ?? t("profile.guestName", { tag: guestTagFromUid(row.uid) })
  // Đồng điểm thì đồng hạng: hạng = vị trí của người đầu tiên có điểm này.
  const rankOf = (index: number) => top.findIndex((item) => item.score === top[index].score) + 1

  if (top.length === 0) return <p className="rounded-3xl bg-[#10322f] p-5 text-center text-sm text-[#9fe3db]">{t("leaderboard.empty")}</p>

  return (
    <div className="flex flex-col gap-4">
      <section aria-label="Top 3" className="grid grid-cols-3 items-end gap-2 pt-1">
        {PODIUM.map(({ place, height, avatar }) => {
          const row = top[place - 1]
          if (!row) return <div key={place} />
          return (
            <div key={place} className="flex min-w-0 flex-col items-center gap-1.5">
              <span className={cn("flex items-center justify-center rounded-full font-heading text-2xl font-extrabold text-[#04211e] uppercase", avatar)} aria-hidden="true">
                {nameOf(row).charAt(0)}
              </span>
              <span className={cn("max-w-full truncate text-[13px] font-bold", row.uid === uid && "text-[#2ec4b6]")}>{nameOf(row)}</span>
              <div className={cn("flex w-full flex-col items-center justify-center gap-0.5 rounded-t-2xl rounded-b-md bg-[#14403b]", height)}>
                <span className="font-heading text-[26px] leading-none font-extrabold">{rankOf(place - 1)}</span>
                <span className="text-sm font-extrabold tabular-nums">{formatNumber(row.score)}</span>
              </div>
            </div>
          )
        })}
      </section>

      {top.length > 3 && (
        <ol className="rounded-3xl bg-[#10322f] px-4 py-1">
          {top.slice(3).map((row, offset) => {
            const index = offset + 3
            const isMe = row.uid === uid
            return (
              <li key={row.uid} className={cn("flex items-center gap-3 border-b border-[#184a44] py-2.5 last:border-0", isMe && "font-extrabold text-[#2ec4b6]")}>
                <span className="w-7 font-extrabold text-[#9fe3db] tabular-nums">{index > 0 && top[index - 1].score === row.score ? "" : rankOf(index)}</span>
                <span className="min-w-0 flex-1 truncate font-semibold">
                  {nameOf(row)}
                  {isMe && <span className="ml-1.5 text-xs">({t("leaderboard.you")})</span>}
                </span>
                <span className="font-extrabold tabular-nums">{formatNumber(row.score)}</span>
              </li>
            )
          })}
        </ol>
      )}

      {query.data && (
        <div className="sticky bottom-3 flex items-center gap-3 rounded-3xl bg-[#2ec4b6] px-4 py-3 text-[#04211e] shadow-lg">
          {me ? (
            <>
              <span className="font-heading text-[26px] font-extrabold">#{formatNumber(me.rank)}</span>
              <span className="flex min-w-0 flex-col leading-tight">
                <span className="font-extrabold">{t("ranking.you", { score: formatNumber(me.score) })}</span>
                {me.nextScore !== null && (
                  <span className="text-[13px] font-semibold">{t("ranking.toNext", { points: formatNumber(me.nextScore - me.score + 1), rank: formatNumber(Math.max(1, me.rank - 1)) })}</span>
                )}
              </span>
            </>
          ) : (
            <span className="font-extrabold">{t("leaderboard.notRanked")}</span>
          )}
          <Link href={Routes.PLAY} className="ml-auto flex h-10 shrink-0 items-center rounded-xl bg-[#04211e] px-4 font-extrabold text-[#9fe3db]">
            {t("ui.play")}
          </Link>
        </div>
      )}
    </div>
  )
}
