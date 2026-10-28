import { countPlayersOnline } from "@/server/presence/count-players-online"

/** Công khai: chỉ trả một con số, cache 30s ở server + CDN. */
export async function GET() {
  try {
    return Response.json(await countPlayersOnline(), { headers: { "Cache-Control": "public, max-age=30, s-maxage=30" } })
  } catch (error) {
    console.error("[presence]", error)
    return Response.json({ playing: 0 }, { status: 503, headers: { "Cache-Control": "no-store" } })
  }
}
