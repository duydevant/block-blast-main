"use client"

import { CoinsIcon, LockIcon } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { useI18n } from "@/lib/i18n"
import { ApiRequestError } from "@/lib/firebase/fetch-json-with-firebase-id-token"
import { usePlayerProfileQuery } from "@/modules/player-profile/use-player-profile-query"
import { isThemeOwned, NO_THEME_OWNERSHIP, THEME_UNLOCKS } from "@/modules/progression/theme-unlock-rules"
import { useBuyThemeMutation, useThemeOwnership } from "@/modules/progression/use-progression-queries"

import { BLOCK_THEME_IDS, BLOCK_THEMES, type BlockThemeId } from "../render/block-color-palette"
import { useBlockPuzzleGameStore } from "../store/block-puzzle-game-store"
import { useBlockPuzzleSettingsStore } from "../store/block-puzzle-settings-store"
import { GAME_PANEL } from "./game-ui-styles"

interface PopupProps {
  open: boolean
  onClose: () => void
}

/** Ô màu mẫu của theme, vẽ bằng CSS (không ảnh). */
function ThemeSwatch({ themeId, colorId }: { themeId: keyof typeof BLOCK_THEMES; colorId: number }) {
  const theme = BLOCK_THEMES[themeId]
  const color = theme.colors[colorId]
  const style =
    theme.style === "neon"
      ? { background: color.dark, boxShadow: `0 0 10px ${color.base}, inset 0 0 0 3px ${color.light}` }
      : { background: theme.style === "glossy" ? `linear-gradient(${color.light}, ${color.base} 60%)` : color.base, boxShadow: `inset 0 -4px 0 ${color.dark}` }
  return <span className="size-8 rounded-lg" style={style} />
}

/** Ô theme: chọn nếu đã có; chưa có thì hiện điều kiện mở hoặc nút mua bằng xu. */
function ThemeTile({ themeId, owned, coins }: { themeId: BlockThemeId; owned: boolean; coins: number | null }) {
  const { t, formatNumber } = useI18n()
  const colorTheme = useBlockPuzzleSettingsStore((state) => state.colorTheme)
  const setColorTheme = useBlockPuzzleSettingsStore((state) => state.setColorTheme)
  const buyTheme = useBuyThemeMutation()
  const unlock = THEME_UNLOCKS[themeId]
  const selected = owned && colorTheme === themeId

  const buy = () =>
    buyTheme.mutate(themeId, {
      onSuccess: () => {
        setColorTheme(themeId)
        toast.success(t("themes.bought"))
      },
      onError: (error) =>
        toast.error(t(error instanceof ApiRequestError && error.code === "not-enough-coins" ? "themes.notEnoughCoins" : "themes.buyFailed")),
    })

  return (
    <div
      className={`flex flex-col items-center gap-2 rounded-2xl border-2 p-3 text-sm font-bold transition ${
        selected ? "border-amber-300 bg-[#342c70]" : "border-transparent bg-[#2a2459]"
      }`}
    >
      <button
        aria-pressed={selected}
        disabled={!owned}
        onClick={() => setColorTheme(themeId)}
        className="flex flex-col items-center gap-2 disabled:opacity-50"
      >
        <span className="flex gap-1.5">
          {[1, 4, 7].map((colorId) => (
            <ThemeSwatch key={colorId} themeId={themeId} colorId={colorId} />
          ))}
        </span>
        <span className="flex items-center gap-1">
          {!owned && <LockIcon className="size-3.5" aria-label={t("themes.locked")} />}
          {t(`game.theme.${themeId}`)}
        </span>
      </button>
      {!owned && unlock.kind === "level" && <span className="text-xs font-semibold text-white/60">{t("themes.unlockLevel", { level: unlock.level })}</span>}
      {!owned && unlock.kind === "referral" && <span className="text-xs font-semibold text-white/60">{t("themes.unlockReferral")}</span>}
      {!owned && unlock.kind === "coins" && (
        <Button
          size="sm"
          className="h-7 rounded-full bg-amber-400 px-3 text-xs font-bold text-[#2a2459] hover:bg-amber-300"
          disabled={coins === null || coins < unlock.price || buyTheme.isPending}
          onClick={buy}
        >
          <CoinsIcon />
          {t("themes.buy", { price: formatNumber(unlock.price) })}
        </Button>
      )}
    </div>
  )
}

export function GameThemesDialog({ open, onClose }: PopupProps) {
  const { t, formatNumber } = useI18n()
  const ownership = useThemeOwnership()
  const coins = usePlayerProfileQuery().data?.coins ?? null

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className={GAME_PANEL + " max-w-sm"}>
        <DialogHeader>
          <DialogTitle className="text-center text-2xl font-bold">{t("game.themes")}</DialogTitle>
        </DialogHeader>
        <p className="flex items-center justify-center gap-1.5 text-sm font-bold text-amber-300">
          {coins === null ? (
            <span className="font-semibold text-white/60">{t("themes.needsOnline")}</span>
          ) : (
            <>
              <CoinsIcon className="size-4" aria-hidden="true" />
              {t("progress.coins", { count: formatNumber(coins) })}
            </>
          )}
        </p>
        <div className="grid max-h-[60vh] grid-cols-2 gap-3 overflow-y-auto">
          {BLOCK_THEME_IDS.map((themeId) => (
            <ThemeTile
              key={themeId}
              themeId={themeId}
              owned={isThemeOwned(themeId, ownership ?? NO_THEME_OWNERSHIP)}
              coins={coins}
            />
          ))}
        </div>
      </DialogContent>
    </Dialog>
  )
}

export function GameStatsDialog({ open, onClose }: PopupProps) {
  const { t, formatNumber } = useI18n()
  const score = useBlockPuzzleGameStore((state) => state.game?.score ?? 0)
  const best = useBlockPuzzleGameStore((state) => state.best)
  const moves = useBlockPuzzleGameStore((state) => state.game?.moveCount ?? 0)
  const rows: [string, number][] = [
    [t("game.best"), best],
    [t("game.score"), score],
    [t("game.moves"), moves],
  ]

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className={GAME_PANEL + " max-w-sm"}>
        <DialogHeader>
          <DialogTitle className="text-center text-2xl font-bold">{t("game.statistics")}</DialogTitle>
        </DialogHeader>
        <dl className="space-y-3 py-2 text-lg font-bold">
          {rows.map(([label, value]) => (
            <div key={label} className="flex justify-between rounded-2xl bg-[#2a2459] px-4 py-3">
              <dt>{label}</dt>
              <dd className="text-amber-300 tabular-nums">{formatNumber(value)}</dd>
            </div>
          ))}
        </dl>
      </DialogContent>
    </Dialog>
  )
}
