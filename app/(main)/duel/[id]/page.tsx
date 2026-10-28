import type { Metadata } from "next"
import { notFound, redirect } from "next/navigation"

import { DuelRoomView } from "@/modules/duel/components/duel-room-view"
import { DUEL_ID_PATTERN, normalizeDuelCode } from "@/modules/duel/duel-types"
import { Routes } from "@/lib/routes"

/** Phòng riêng qua link mời — không cho Google index. */
export const metadata: Metadata = {
  title: "1v1 duel",
  robots: { index: false, follow: false },
}

export default async function DuelRoomPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  // Mã gõ tay/chia sẻ có thể là chữ thường → chuyển về mã chuẩn.
  const code = normalizeDuelCode(id)
  if (code && code !== id) redirect(`${Routes.DUEL}/${code}`)
  if (!DUEL_ID_PATTERN.test(id)) notFound()
  return (
    <div className="mx-auto w-full max-w-md px-4 pt-2 pb-6">
      <DuelRoomView duelId={id} />
    </div>
  )
}
