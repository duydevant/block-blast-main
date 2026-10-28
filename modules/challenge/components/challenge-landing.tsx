"use client"

import Link from "next/link"
import { SwordsIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { useI18n } from "@/lib/i18n"
import { Routes } from "@/lib/routes"

import type { ChallengeView } from "../challenge-types"

/** Nội dung trang /c/{id}: người thách, điểm cần vượt, nút nhận thách đấu, bảng kết quả. */
export function ChallengeLanding({ view }: { view: ChallengeView }) {
  const { t, formatNumber } = useI18n()
  const nameOf = (displayName: string | null, tag: string) => displayName ?? t("profile.guestName", { tag })
  const challenger = nameOf(view.creatorName, view.creatorTag)

  return (
    <div className="mx-auto flex max-w-xl flex-col gap-6 px-4 py-10">
      <Card>
        <CardHeader className="text-center">
          <SwordsIcon className="mx-auto size-8 text-primary" aria-hidden="true" />
          <CardTitle className="text-2xl">{t("challenge.pageTitle", { name: challenger })}</CardTitle>
          <CardDescription>{t("challenge.pageTarget", { score: formatNumber(view.creatorScore) })}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col items-center gap-3">
          <div className="text-6xl font-bold tabular-nums">{formatNumber(view.creatorScore)}</div>
          <Button size="lg" className="h-11 px-6 text-base" nativeButton={false} render={<Link href={`${Routes.PLAY}?challenge=${view.id}`} />}>
            {t("challenge.accept")}
          </Button>
          {view.attempts > 0 && <p className="text-sm text-muted-foreground">{t("challenge.attempts", { count: formatNumber(view.attempts) })}</p>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("challenge.results")}</CardTitle>
        </CardHeader>
        <CardContent>
          <ol className="flex flex-col divide-y text-sm">
            <li className="flex justify-between py-2 font-semibold">
              <span>
                {challenger} <span className="text-xs font-normal text-muted-foreground">({t("challenge.challenger")})</span>
              </span>
              <span className="tabular-nums">{formatNumber(view.creatorScore)}</span>
            </li>
            {view.results.map((row, index) => (
              <li key={`${row.tag}-${index}`} className="flex justify-between py-2">
                <span className="truncate">{nameOf(row.displayName, row.tag)}</span>
                <span className={row.score > view.creatorScore ? "font-semibold text-primary tabular-nums" : "tabular-nums"}>{formatNumber(row.score)}</span>
              </li>
            ))}
          </ol>
          {view.results.length === 0 && <p className="mt-2 text-sm text-muted-foreground">{t("challenge.noResults")}</p>}
        </CardContent>
      </Card>
    </div>
  )
}
