import type { Metadata } from "next"
import { notFound } from "next/navigation"

import { ReplayViewer } from "@/modules/replay/components/replay-viewer"
import { gameIdSchema } from "@/server/games/ranked-game-request-schemas"
import { getGameReplay } from "@/server/replays/replay-store"

interface ReplayPageProps {
  params: Promise<{ id: string }>
}

async function loadReplay(id: string) {
  return gameIdSchema.safeParse(id).success ? getGameReplay(id) : null
}

export async function generateMetadata({ params }: ReplayPageProps): Promise<Metadata> {
  const replay = await loadReplay((await params).id)
  if (!replay) return { title: "Replay", robots: { index: false } }
  const name = replay.displayName ?? `Khách #${replay.guestTag}`
  const title = `${name} · ${replay.score.toLocaleString("vi-VN")} điểm`
  const description = "Xem lại từng nước đi của ván này."
  return { title, description, robots: { index: false }, openGraph: { title, description }, twitter: { card: "summary_large_image", title, description } }
}

/** Xem lại một ván đã lưu (kỷ lục, lọt top, hoặc người chơi tự lưu). Render server để link chia sẻ có preview. */
export default async function ReplayPage({ params }: ReplayPageProps) {
  const replay = await loadReplay((await params).id)
  if (!replay) notFound()
  return (
    <div className="mx-auto w-full max-w-md px-4 pt-2 pb-6">
      <ReplayViewer replay={replay} />
    </div>
  )
}
