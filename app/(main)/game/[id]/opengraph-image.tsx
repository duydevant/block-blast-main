import { gameIdSchema } from "@/server/games/ranked-game-request-schemas"
import { OG_IMAGE_SIZE, renderOgImage } from "@/server/og/og-image-frame"
import { getGameReplay } from "@/server/replays/replay-store"

export const alt = "Replay"
export const size = OG_IMAGE_SIZE
export const contentType = "image/png"

/** Ảnh preview link xem lại: tên người chơi + điểm. */
export default async function ReplayOgImage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const replay = gameIdSchema.safeParse(id).success ? await getGameReplay(id) : null
  if (!replay) return renderOgImage({ label: "Replay", headline: "?", caption: "Xem lại ván đấu" })
  return renderOgImage({
    label: replay.displayName ?? `Khách #${replay.guestTag}`,
    headline: replay.score.toLocaleString("vi-VN"),
    caption: "Xem lại từng nước đi",
  })
}
