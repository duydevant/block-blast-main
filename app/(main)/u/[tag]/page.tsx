import type { Metadata } from "next"
import { notFound } from "next/navigation"

import { PublicProfileView } from "@/modules/player-profile/components/public-profile-view"
import { getPublicPlayerProfile } from "@/server/players/public-player-store"

interface PublicProfilePageProps {
  params: Promise<{ tag: string }>
}

export async function generateMetadata({ params }: PublicProfilePageProps): Promise<Metadata> {
  const profile = await getPublicPlayerProfile((await params).tag)
  if (!profile) return { title: "Player", robots: { index: false } }
  const name = profile.displayName ?? `Khách #${profile.guestTag}`
  return { title: name, description: `Kỷ lục ${profile.stats.bestScore.toLocaleString("vi-VN")} điểm`, robots: { index: false } }
}

/** Hồ sơ công khai của người chơi (mở từ BXH / replay). */
export default async function PublicProfilePage({ params }: PublicProfilePageProps) {
  const profile = await getPublicPlayerProfile((await params).tag)
  if (!profile) notFound()
  return (
    <div className="mx-auto w-full max-w-md px-4 pt-2 pb-6">
      <PublicProfileView profile={profile} />
    </div>
  )
}
