"use client"

import { useFirebaseAuthStore } from "@/lib/auth/firebase-auth-store"
import { useI18n } from "@/lib/i18n"
import { GoogleAccountButton } from "@/modules/player-profile/components/google-account-button"
import { ProfileAccountCard } from "@/modules/player-profile/components/profile-account-card"
import { ProfileHero } from "@/modules/player-profile/components/profile-hero"
import { ProfileStatsCard } from "@/modules/player-profile/components/profile-stats-card"
import { ProfileAchievementsCard } from "@/modules/progression/components/profile-achievements-card"
import { ReferralInviteCard } from "@/modules/progression/components/referral-invite-card"
import { ProfileAppCard } from "@/modules/pwa/components/profile-app-card"

/** Hồ sơ: cấp/xu ở đầu, số liệu dạng ô, huy hiệu, mời bạn, bật/tắt cài đặt; đổi tên + tài khoản ở cuối. */
export default function ProfilePage() {
  const { t } = useI18n()
  const status = useFirebaseAuthStore((state) => state.status)
  const isGuest = useFirebaseAuthStore((state) => state.player?.isAnonymous ?? false)

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-4 px-4 pt-2 pb-6">
      <ProfileHero />
      {status === "loading" && <p className="text-sm text-muted-foreground">{t("profile.loading")}</p>}
      {(status === "error" || status === "disabled") && <p className="text-sm text-muted-foreground">{t("auth.unavailable")}</p>}
      {status === "ready" && (
        <>
          {isGuest && <GoogleAccountButton className="h-12 w-full rounded-2xl bg-white text-[15px] font-bold text-[#1f1f1f] hover:bg-white/90" />}
          <ProfileStatsCard />
          <ProfileAchievementsCard />
          <ReferralInviteCard />
          <ProfileAppCard />
          <ProfileAccountCard />
        </>
      )}
    </div>
  )
}
