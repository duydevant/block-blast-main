"use client"

import { useEffect, useState } from "react"
import { useQueryClient } from "@tanstack/react-query"
import Link from "next/link"
import { HomeIcon, SendIcon, Share2Icon, SwordsIcon } from "lucide-react"
import { toast } from "sonner"

import { useFirebaseAuthStore } from "@/lib/auth/firebase-auth-store"
import { useI18n } from "@/lib/i18n"
import { Routes } from "@/lib/routes"
import { siteConfig } from "@/lib/site"
import { challengeUrl, createChallengeFromCurrentGame } from "@/modules/challenge/challenge-game-actions"
import { DAILY_STATUS_QUERY_KEY, formatDayKey, LEADERBOARD_QUERY_KEY } from "@/modules/leaderboard/use-leaderboard-queries"
import { PLAYER_PROFILE_QUERY_KEY } from "@/modules/player-profile/use-player-profile-query"
import { renderResultShareCard } from "@/modules/share/render-result-share-card"
import { shareOrCopyLink } from "@/modules/share/share-or-copy-link"

import { useBlockPuzzleGameStore } from "../store/block-puzzle-game-store"
import { useBlockPuzzleSettingsStore } from "../store/block-puzzle-settings-store"

/** Ô icon + chữ ngắn ở đáy hộp hết ván. */
const ACTION_TILE =
  "flex h-16 flex-col items-center justify-center gap-1 rounded-2xl bg-[#2a2459] text-xs font-semibold text-white transition hover:bg-[#332c6b] disabled:opacity-50 [&_svg]:size-5.5"

/**
 * Nút ở màn hết ván: "Thách bạn bè" (ván classic tính điểm) và "Chia sẻ" (ảnh kết quả + link).
 * Web Share chỉ chạy trong lúc còn "thao tác người dùng" (Safari rất ngắn) → ảnh vẽ sẵn khi mở,
 * còn thách đấu chia 2 lần bấm: tạo link (gọi mạng) rồi mới "Gửi" (mở bảng share ngay).
 */
export function GameOverShareActions() {
  const { t, formatNumber, localeTag } = useI18n()
  const queryClient = useQueryClient()
  const game = useBlockPuzzleGameStore((state) => state.game)
  const best = useBlockPuzzleGameStore((state) => state.best)
  const rankedSession = useBlockPuzzleGameStore((state) => state.rankedSession)
  const dailyDay = useBlockPuzzleGameStore((state) => state.dailyDay)
  const challenge = useBlockPuzzleGameStore((state) => state.challenge)
  const hasVariantRun = useBlockPuzzleGameStore((state) => state.variantRun !== null)
  const themeId = useBlockPuzzleSettingsStore((state) => state.colorTheme)
  const cloudReady = useFirebaseAuthStore((state) => state.status === "ready")
  const [busy, setBusy] = useState(false)
  const [image, setImage] = useState<Blob | undefined>(undefined)
  const [createdChallengeId, setCreatedChallengeId] = useState<string | null>(null)

  const score = game ? formatNumber(game.score) : "0"
  const dailyDate = dailyDay ? formatDayKey(dailyDay, localeTag) : null

  // Vẽ sẵn ảnh kết quả khi màn hết ván hiện (daily không vẽ bàn để không lộ chuỗi khối).
  useEffect(() => {
    if (!game?.isGameOver) return
    let cancelled = false
    const label = challenge ? t("challenge.label") : dailyDate ? t("daily.badgeRanked", { date: dailyDate }) : t("share.scoreLabel")
    const caption = dailyDate ? t("daily.title") : game.score > 0 && game.score >= best ? t("share.newBest") : t("share.beatMe")
    renderResultShareCard({
      siteName: siteConfig.name,
      label,
      score,
      caption,
      footer: new URL(siteConfig.url).host,
      board: dailyDate ? null : game.board,
      themeId,
    })
      .then((blob) => !cancelled && setImage(blob))
      .catch((error: unknown) => console.warn("[share] card render failed", error))
    return () => {
      cancelled = true
    }
  }, [game, best, challenge, dailyDate, score, t, themeId])

  if (!game) return null
  const canChallenge = cloudReady && rankedSession !== null && !dailyDay && !challenge && !hasVariantRun && game.score > 0

  const share = (text: string, url: string) => {
    shareOrCopyLink({ title: siteConfig.name, text, url, image })
      .then((outcome) => outcome === "copied" && toast.success(t("share.copied")))
      .catch((error: unknown) => {
        console.warn("[share] failed", error)
        toast.error(t("share.failed"))
      })
  }

  const createChallenge = async () => {
    setBusy(true)
    try {
      setCreatedChallengeId(await createChallengeFromCurrentGame())
      toast.success(t("share.challengeReady"))
      // Ván vừa được nộp qua đường tạo thách đấu → làm mới hồ sơ/bảng xếp hạng.
      for (const queryKey of [PLAYER_PROFILE_QUERY_KEY, DAILY_STATUS_QUERY_KEY, LEADERBOARD_QUERY_KEY]) void queryClient.invalidateQueries({ queryKey })
    } catch (error) {
      console.warn("[challenge] create failed", error)
      toast.error(t("share.failed"))
    } finally {
      setBusy(false)
    }
  }

  const shareResult = () => {
    if (challenge) {
      const opponent = challenge.creatorName ?? t("profile.guestName", { tag: challenge.creatorTag })
      return share(t("share.textChallengeResult", { score, opponent, target: formatNumber(challenge.creatorScore) }), challengeUrl(challenge.id))
    }
    if (dailyDate) {
      return share(t("share.textDaily", { name: siteConfig.name, date: dailyDate, score }), new URL(Routes.PLAY_DAILY, siteConfig.url).toString())
    }
    share(t("share.textClassic", { score, name: siteConfig.name }), siteConfig.url)
  }

  return (
    <div className="grid w-full grid-cols-3 gap-2.5">
      {canChallenge &&
        (createdChallengeId ? (
          <button
            className={ACTION_TILE}
            onClick={() => share(t("share.textChallenge", { score, name: siteConfig.name }), challengeUrl(createdChallengeId))}
          >
            <SendIcon className="text-[#ff7eb6]" aria-hidden="true" />
            {t("share.sendChallenge")}
          </button>
        ) : (
          <button className={ACTION_TILE} disabled={busy} onClick={() => void createChallenge()}>
            <SwordsIcon className="text-[#ff7eb6]" aria-hidden="true" />
            {t("game.challengeFriend")}
          </button>
        ))}
      <button className={ACTION_TILE} onClick={shareResult}>
        <Share2Icon className="text-[#4ea8ff]" aria-hidden="true" />
        {t("game.share")}
      </button>
      <Link href={Routes.HOME} className={ACTION_TILE}>
        <HomeIcon aria-hidden="true" />
        {t("ui.home")}
      </Link>
    </div>
  )
}
