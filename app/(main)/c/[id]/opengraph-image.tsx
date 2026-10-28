import { challengerLabel, formatScoreVi, loadChallengeView } from "@/server/challenges/challenge-page-data"
import { OG_IMAGE_SIZE, renderOgImage } from "@/server/og/og-image-frame"

export const alt = "Thách đấu"
export const size = OG_IMAGE_SIZE
export const contentType = "image/png"

/** Ảnh preview khi dán link thách đấu: "<tên> thách bạn" + điểm cần vượt. */
export default async function ChallengeOgImage({ params }: { params: Promise<{ id: string }> }) {
  const view = await loadChallengeView((await params).id)
  if (!view) return renderOgImage({ label: "Thách đấu", headline: "?", caption: "Bạn vượt được không?" })
  return renderOgImage({
    label: `${challengerLabel(view)} thách bạn`,
    headline: formatScoreVi(view.creatorScore),
    caption: "Bạn vượt được không?",
  })
}
