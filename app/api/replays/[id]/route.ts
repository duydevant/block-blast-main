import { gameIdSchema } from "@/server/games/ranked-game-request-schemas"
import { getGameReplay } from "@/server/replays/replay-store"

/** Replay công khai (không cần đăng nhập, không có uid). Nội dung không đổi → cache lâu ở CDN/trình duyệt. */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!gameIdSchema.safeParse(id).success) return Response.json({ error: "replay-not-found" }, { status: 404 })
  try {
    const replay = await getGameReplay(id)
    if (!replay) return Response.json({ error: "replay-not-found" }, { status: 404 })
    return Response.json(replay, { headers: { "Cache-Control": "public, max-age=3600, s-maxage=86400" } })
  } catch (error) {
    console.error("[api] replay", error)
    return Response.json({ error: "internal" }, { status: 500 })
  }
}
