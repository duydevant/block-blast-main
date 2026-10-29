"use client"

import { median } from "@/modules/progression/score-statistics"

const WIDTH = 300
const HEIGHT = 64
const PAD = 4

/** Đường điểm các ván gần nhất (cũ → mới, trái → phải) + đường ngang trung vị. SVG thuần, không thư viện. */
export function ScoreTrendSparkline({ scores, label }: { scores: readonly number[]; label: string }) {
  if (scores.length < 2) return null
  const max = Math.max(...scores, 1)
  const x = (index: number) => PAD + (index / (scores.length - 1)) * (WIDTH - PAD * 2)
  const y = (value: number) => HEIGHT - PAD - (value / max) * (HEIGHT - PAD * 2)
  const points = scores.map((score, index) => `${x(index).toFixed(1)},${y(score).toFixed(1)}`).join(" ")
  const middle = y(median(scores))

  return (
    <figure className="flex flex-col gap-1">
      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="h-16 w-full" role="img" aria-label={label}>
        <line x1={PAD} x2={WIDTH - PAD} y1={middle} y2={middle} stroke="#ffb547" strokeOpacity={0.5} strokeDasharray="4 4" />
        <polyline points={points} fill="none" stroke="#4ea8ff" strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />
      </svg>
      <figcaption className="text-[11px] text-muted-foreground">{label}</figcaption>
    </figure>
  )
}
