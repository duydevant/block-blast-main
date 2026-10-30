"use client"

import { useI18n } from "@/lib/i18n"

import { useAnalysisVerdicts, verdictShares } from "../analysis-verdict-history"

/** "20 ván phân tích gần nhất: 35% xui, 65% sai lầm" — chỉ hiện khi đã có lần phân tích có kết luận. */
export function AnalysisStatsNote({ className = "" }: { className?: string }) {
  const { t, formatNumber } = useI18n()
  const shares = verdictShares(useAnalysisVerdicts())
  if (shares.counted === 0) return null
  return (
    <p className={`text-xs text-muted-foreground ${className}`}>
      {t("analysis.stats", { count: formatNumber(shares.counted), unlucky: shares.unlucky, mistake: shares.mistake })}
    </p>
  )
}
