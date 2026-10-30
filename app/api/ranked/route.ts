import { handleJsonRoute, requireUid } from "@/server/http/authenticated-json-route"
import { getRankedStatus } from "@/server/ranked/ranked-status-store"

/** Giải + LP + trận xếp hạng còn lại của mùa quý hiện tại (MMR ẩn, không trả ra). */
export async function GET(request: Request) {
  return handleJsonRoute(async () => getRankedStatus(await requireUid(request)))
}
