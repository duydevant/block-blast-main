"use client"

import { useCallback, useEffect, useRef } from "react"
import { toast } from "sonner"

import { useI18n } from "@/lib/i18n"
import type { GameRewards } from "@/modules/player-profile/player-profile-types"
import { gameRewardMessages } from "@/modules/progression/progression-labels"
import { isThemeOwned } from "@/modules/progression/theme-unlock-rules"
import { useThemeOwnership } from "@/modules/progression/use-progression-queries"

import { DEFAULT_BLOCK_THEME } from "../render/block-color-palette"
import { useBlockPuzzleSettingsStore } from "../store/block-puzzle-settings-store"

/**
 * Báo phần thưởng sau khi nộp ván (lên cấp, nhiệm vụ, thành tích, quà mời bạn).
 * Trả hàm ổn định để truyền vào sync chạy nền; luôn dùng ngôn ngữ hiện tại qua ref.
 */
export function useGameRewardToasts(): (rewards: GameRewards) => void {
  const i18n = useI18n()
  const i18nRef = useRef(i18n)
  useEffect(() => {
    i18nRef.current = i18n
  }, [i18n])

  return useCallback((rewards: GameRewards) => {
    const messages = gameRewardMessages(i18nRef.current, rewards)
    if (messages.length === 0) return
    const summary = i18nRef.current.t("reward.summary", { xp: rewards.xp, coins: rewards.coins })
    messages.forEach((message, index) => toast.success(message, index === messages.length - 1 ? { description: summary } : undefined))
  }, [])
}

/** Theme đang chọn không còn sở hữu (đổi tài khoản…) → về theme mặc định, chỉ khi đã biết profile. */
export function useEnforceOwnedColorTheme() {
  const ownership = useThemeOwnership()
  const colorTheme = useBlockPuzzleSettingsStore((state) => state.colorTheme)
  const settingsReady = useBlockPuzzleSettingsStore((state) => state.hasHydrated)
  useEffect(() => {
    if (!settingsReady || !ownership || isThemeOwned(colorTheme, ownership)) return
    useBlockPuzzleSettingsStore.getState().setColorTheme(DEFAULT_BLOCK_THEME)
  }, [colorTheme, ownership, settingsReady])
}
