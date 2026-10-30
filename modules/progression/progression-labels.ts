import type { useI18n } from "@/lib/i18n"
import type { GameRewards } from "@/modules/player-profile/player-profile-types"

import type { DailyMissionKind } from "./daily-mission-catalog"

type I18n = Pick<ReturnType<typeof useI18n>, "t" | "formatNumber">

/** "Xoá 20 dòng", "Đạt 1.500 điểm trong 1 ván"… */
export function missionTitle({ t, formatNumber }: I18n, kind: DailyMissionKind, target: number): string {
  return t(`mission.${kind}`, { target: formatNumber(target) })
}

/** Id nhiệm vụ có dạng `${kind}-${target}` (xem daily-mission-catalog). */
export function missionTitleFromId(i18n: I18n, id: string): string {
  const cut = id.lastIndexOf("-")
  return missionTitle(i18n, id.slice(0, cut) as DailyMissionKind, Number(id.slice(cut + 1)))
}

/** Danh sách thông báo cho phần thưởng của một ván (rỗng nếu không có gì đáng báo). */
export function gameRewardMessages(i18n: I18n, rewards: GameRewards): string[] {
  const { t } = i18n
  return [
    ...(rewards.levelUp !== null ? [t("reward.levelUp", { level: rewards.levelUp })] : []),
    ...(rewards.tierUp ? [t("reward.tierUp", { tier: t(`tier.${rewards.tierUp}`) })] : []),
    ...rewards.missions.map((id) => t("reward.mission", { name: missionTitleFromId(i18n, id) })),
    ...rewards.achievements.map((id) => t("reward.achievement", { name: t(`achievement.${id}` as Parameters<I18n["t"]>[0]) })),
    ...(rewards.referralBonus ? [t("reward.referral")] : []),
  ]
}
