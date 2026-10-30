import { handleJsonRoute, requireUid } from "@/server/http/authenticated-json-route"
import { startRankedMatch } from "@/server/ranked/start-ranked-match"

/** Mở trận xếp hạng với bóng ma cùng trình độ → session `mode: "ranked"` + bóng ma để phát lại. */
export async function POST(request: Request) {
  return handleJsonRoute(async () => startRankedMatch(await requireUid(request)))
}
