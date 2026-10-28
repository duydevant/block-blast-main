"use client"

import { useEffect, useState } from "react"
import { BellIcon, BellOffIcon, VibrateIcon, VibrateOffIcon, Volume2Icon, VolumeXIcon, type LucideIcon } from "lucide-react"
import { toast } from "sonner"

import { useI18n } from "@/lib/i18n"
import { useBlockPuzzleSettingsStore } from "@/modules/block-puzzle/store/block-puzzle-settings-store"
import { usePushReminders } from "@/modules/push/use-push-reminders"

import { InstallAppButton } from "./install-app-button"

const TOGGLE =
  "flex h-[60px] flex-col items-center justify-center gap-0.5 rounded-2xl text-sm font-extrabold transition disabled:opacity-50 aria-pressed:bg-[#2a2459] aria-pressed:text-white aria-[pressed=false]:bg-[#1a1640] aria-[pressed=false]:text-violet-200/70 [&_svg]:size-5"

function ToggleTile({ on, label, onIcon, offIcon, disabled, onToggle }: { on: boolean; label: string; onIcon: LucideIcon; offIcon: LucideIcon; disabled?: boolean; onToggle: () => void }) {
  const { t } = useI18n()
  const Icon = on ? onIcon : offIcon
  return (
    <button className={TOGGLE} aria-pressed={on} disabled={disabled} onClick={onToggle}>
      <Icon aria-hidden="true" />
      {label}
      <span className="text-[11px] font-semibold">{t(on ? "game.on" : "game.off")}</span>
    </button>
  )
}

/** Hồ sơ: 3 nút bật/tắt (âm thanh, rung, nhắc nhở hằng ngày) + cài game ra màn hình chính. */
export function ProfileAppCard() {
  const { t } = useI18n()
  const sound = useBlockPuzzleSettingsStore((state) => state.sound)
  const haptics = useBlockPuzzleSettingsStore((state) => state.haptics)
  const setSound = useBlockPuzzleSettingsStore((state) => state.setSound)
  const setHaptics = useBlockPuzzleSettingsStore((state) => state.setHaptics)
  const push = usePushReminders()
  const [busy, setBusy] = useState(false)

  // Cài đặt nằm trong localStorage (đọc sau khi mount như ở màn chơi).
  useEffect(() => {
    void useBlockPuzzleSettingsStore.persist.rehydrate()
  }, [])

  const togglePush = async () => {
    setBusy(true)
    try {
      if (push.status === "on") {
        await push.disable()
        toast.success(t("push.disabled"))
      } else if (await push.enable()) {
        toast.success(t("push.enabled"))
      }
    } catch (error) {
      console.warn("[push] toggle failed", error)
      toast.error(t("push.failed"))
    } finally {
      setBusy(false)
    }
  }
  const pushHint = push.status === "needs-install" ? "push.needsInstall" : push.status === "denied" ? "push.denied" : push.status === "unsupported" ? "push.unsupported" : null

  return (
    <section aria-label={t("pwa.cardTitle")} className="flex flex-col gap-2.5">
      <div className="grid grid-cols-3 gap-2">
        <ToggleTile on={sound} label={t("game.sound")} onIcon={Volume2Icon} offIcon={VolumeXIcon} onToggle={() => setSound(!sound)} />
        <ToggleTile on={haptics} label={t("game.haptics")} onIcon={VibrateIcon} offIcon={VibrateOffIcon} onToggle={() => setHaptics(!haptics)} />
        <ToggleTile
          on={push.status === "on"}
          label={t("push.title")}
          onIcon={BellIcon}
          offIcon={BellOffIcon}
          disabled={busy || (push.status !== "on" && push.status !== "off")}
          onToggle={() => void togglePush()}
        />
      </div>
      {pushHint && <p className="text-center text-xs text-muted-foreground">{t(pushHint)}</p>}
      <InstallAppButton className="w-full" />
    </section>
  )
}
