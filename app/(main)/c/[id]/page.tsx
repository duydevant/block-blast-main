import type { Metadata } from "next"
import { notFound } from "next/navigation"

import { ChallengeLanding } from "@/modules/challenge/components/challenge-landing"
import { challengerLabel, formatScoreVi, loadChallengeView } from "@/server/challenges/challenge-page-data"

interface ChallengePageProps {
  params: Promise<{ id: string }>
}

export async function generateMetadata({ params }: ChallengePageProps): Promise<Metadata> {
  const view = await loadChallengeView((await params).id)
  if (!view) return { title: "Thách đấu", robots: { index: false } }
  const title = `${challengerLabel(view)} thách bạn vượt ${formatScoreVi(view.creatorScore)} điểm`
  const description = "Chơi đúng chuỗi khối đó và xem ai cao điểm hơn. Không cần đăng ký."
  // Link cá nhân → không cho máy tìm kiếm index; ảnh OG lấy từ opengraph-image.tsx cùng thư mục.
  return { title, description, robots: { index: false }, openGraph: { title, description }, twitter: { card: "summary_large_image", title, description } }
}

/** Trang người nhận thách đấu mở từ link chia sẻ. Render server để có metadata/OG cho Zalo, Messenger. */
export default async function ChallengePage({ params }: ChallengePageProps) {
  const view = await loadChallengeView((await params).id)
  if (!view) notFound()
  return <ChallengeLanding view={view} />
}
