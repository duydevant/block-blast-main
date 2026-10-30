"use client"

import { useEffect } from "react"

import { useI18n } from "@/lib/i18n"
import { prefersReducedMotion } from "@/modules/block-puzzle/input/haptic-feedback"
import { resolveReducedMotion, useBlockPuzzleSettingsStore } from "@/modules/block-puzzle/store/block-puzzle-settings-store"

import { DUEL_EMOTES } from "../duel-emote-rules"
import type { DuelEmotes, VisibleEmote } from "../use-duel-emotes"

/** Hàng 6 emote cố định cho người chơi (người xem không có); khoá trong lúc chờ hết thời gian chờ. */
export function DuelEmoteBar({ emotes, className = "" }: { emotes: DuelEmotes; className?: string }) {
  const { t } = useI18n()
  return (
    <div role="group" aria-label={t("emote.barLabel")} className={`flex justify-center gap-1.5 ${className}`}>
      {DUEL_EMOTES.map((emote, index) => (
        <button
          key={emote}
          onClick={() => emotes.send(index)}
          disabled={emotes.coolingDown}
          aria-label={t("emote.send", { emote })}
          className="flex h-8 min-w-8 items-center justify-center rounded-full bg-white/10 px-2 text-sm font-bold transition hover:bg-white/20 disabled:opacity-40"
        >
          {emote}
        </button>
      ))}
    </div>
  )
}

/** Hàm tra emote đang hiện theo uid (đã lọc theo cài đặt "ẩn emote đối thủ"); null = không hiện gì. */
export function useEmoteLookup(emotes: DuelEmotes, myUid: string | null): (uid: string | undefined) => VisibleEmote | null {
  const hideOpponent = useBlockPuzzleSettingsStore((state) => state.hideOpponentEmotes)
  const settingsReady = useBlockPuzzleSettingsStore((state) => state.hasHydrated)
  // Trang phòng đấu không mở màn chơi → tự nạp cài đặt (store cài đặt bỏ qua nạp tự động khi render server).
  useEffect(() => {
    if (!settingsReady) void useBlockPuzzleSettingsStore.persist.rehydrate()
  }, [settingsReady])
  return (uid) => (!uid || (hideOpponent && uid !== myUid) ? null : (emotes.visible[uid] ?? null))
}

/** Bong bóng emote nổi trên bàn / tên người chơi (không hiệu ứng khi giảm chuyển động). */
export function FloatingEmote({ emote, className = "" }: { emote: VisibleEmote | null; className?: string }) {
  const reduceMotion = useBlockPuzzleSettingsStore((state) => state.reduceMotion)
  if (!emote) return null
  const animated = !resolveReducedMotion(reduceMotion, prefersReducedMotion())
  return (
    <span
      key={emote.key}
      role="status"
      className={`pointer-events-none absolute z-10 rounded-full bg-white px-2 py-0.5 text-lg leading-tight font-extrabold text-[#2a1600] shadow-lg ${animated ? "animate-in fade-in zoom-in-50 duration-300" : ""} ${className}`}
    >
      {DUEL_EMOTES[emote.e]}
    </span>
  )
}
