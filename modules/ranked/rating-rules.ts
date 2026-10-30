import { seasonKeyFor } from "@/lib/vn-calendar"

/**
 * Đấu xếp hạng với "bóng ma" (ván đã ghi của người cùng trình độ, cùng seed): MMR ẩn để ghép + LP hiển thị để xếp
 * giải (giống PvP của Minesweeper). Mùa = quý (giờ VN); sang quý mới: 3 trận xếp hạng lại, MMR kéo về giữa 25%.
 * Tên giải khác hẳn Bậc kỹ năng (Đồng…Cao thủ) để không nhầm. Thuần, dùng chung client + server.
 */
/** Trận xếp hạng dài 3 phút (giờ server). */
export const RANKED_TIME_MS = 180_000
export const MMR_START = 1000
export const PLACEMENT_GAMES = 3
const K_PLACEMENT = 48
const K_NORMAL = 24
/** LP đổi tối đa mỗi trận (trước khi kéo LP về MMR). */
const LP_SWING = 40
/** Bot mạnh nhất từ khoảng MMR này (bot-ghost) → thắng bot không đẩy MMR cao hơn, LP không vượt mức MMR này cho phép. */
export const BOT_MMR_CAP = 1300
/** Chênh điểm ≤ tỉ lệ này coi như hoà. */
export const DRAW_MARGIN = 0.02

export const LEAGUES = [
  { id: "recruit", minLp: 0 },
  { id: "warrior", minLp: 100 },
  { id: "knight", minLp: 200 },
  { id: "hero", minLp: 300 },
  { id: "grandmaster", minLp: 400 },
  { id: "saint", minLp: 500 },
  { id: "legend", minLp: 600 },
] as const
export type LeagueId = (typeof LEAGUES)[number]["id"]

export interface RankedRating {
  season: string
  mmr: number
  lp: number
  /** Số trận xếp hạng đã chơi trong mùa (đủ PLACEMENT_GAMES mới có LP). */
  placements: number
  wins: number
  losses: number
  draws: number
  /** uid đối thủ gần nhất (tránh gặp lại liên tục). */
  recentOpponents: string[]
}

export type MatchResult = "win" | "loss" | "draw"

/** "2026-Q4" — quý theo giờ VN. */
export function rankedSeasonKeyFor(now: Date): string {
  const month = seasonKeyFor(now)
  return `${month.slice(0, 4)}-Q${Math.floor((Number(month.slice(5, 7)) - 1) / 3) + 1}`
}

export function emptyRating(season: string): RankedRating {
  return { season, mmr: MMR_START, lp: 0, placements: 0, wins: 0, losses: 0, draws: 0, recentOpponents: [] }
}

/** Sang mùa (quý) mới: xếp hạng lại 3 trận, MMR kéo về giữa 25%, giữ đối thủ gần đây. */
export function ratingForSeason(rating: RankedRating | null, season: string): RankedRating {
  if (!rating) return emptyRating(season)
  if (rating.season === season) return rating
  return { ...emptyRating(season), mmr: Math.round(rating.mmr + (MMR_START - rating.mmr) * 0.25), recentOpponents: rating.recentOpponents }
}

export function matchResult(myScore: number, ghostScore: number): MatchResult {
  if (Math.abs(myScore - ghostScore) <= Math.max(myScore, ghostScore, 1) * DRAW_MARGIN) return "draw"
  return myScore > ghostScore ? "win" : "loss"
}

const expectedScore = (mmr: number, opponentMmr: number) => 1 / (1 + 10 ** ((opponentMmr - mmr) / 400))
const resultValue = (result: MatchResult) => (result === "win" ? 1 : result === "draw" ? 0.5 : 0)
const lpToMmr = (lp: number) => 700 + lp * 1.5
const lpFromMmr = (mmr: number) => Math.round(Math.min(650, Math.max(0, (mmr - 700) / 1.5)))

export interface MatchUpdate {
  rating: RankedRating
  mmrDelta: number
  lpDelta: number
}

/**
 * Cập nhật sau một trận. Đối thủ là máy → K và LP đổi một nửa; thắng máy không đẩy MMR quá BOT_MMR_CAP và không đẩy
 * LP quá mức MMR cho phép (không cày LP vô hạn bằng bot khi thiếu người).
 */
export function applyMatch(rating: RankedRating, opponent: { mmr: number; uid: string | null; isBot: boolean }, result: MatchResult): MatchUpdate {
  const placing = rating.placements < PLACEMENT_GAMES
  const k = (placing ? K_PLACEMENT : K_NORMAL) / (opponent.isBot ? 2 : 1)
  const surprise = resultValue(result) - expectedScore(rating.mmr, opponent.mmr)
  const rawMmr = Math.max(0, Math.round(rating.mmr + k * surprise))
  const mmr = opponent.isBot && rawMmr > rating.mmr ? Math.max(rating.mmr, Math.min(rawMmr, BOT_MMR_CAP)) : rawMmr
  const placements = rating.placements + 1
  let lp = rating.lp
  if (placements === PLACEMENT_GAMES) lp = lpFromMmr(mmr)
  else if (!placing) {
    // LP theo kết quả + kéo nhẹ về MMR (MMR cao hơn LP → lên nhanh hơn).
    const pull = Math.max(-5, Math.min(5, Math.round((mmr - lpToMmr(rating.lp)) / 50)))
    lp = Math.max(0, rating.lp + Math.round((LP_SWING / (opponent.isBot ? 2 : 1)) * surprise) + pull)
    if (opponent.isBot && lp > rating.lp) lp = Math.max(rating.lp, Math.min(lp, lpFromMmr(mmr)))
  }
  const recentOpponents = opponent.uid ? [opponent.uid, ...rating.recentOpponents.filter((uid) => uid !== opponent.uid)].slice(0, 10) : rating.recentOpponents
  return {
    rating: {
      ...rating,
      mmr,
      lp,
      placements,
      wins: rating.wins + (result === "win" ? 1 : 0),
      losses: rating.losses + (result === "loss" ? 1 : 0),
      draws: rating.draws + (result === "draw" ? 1 : 0),
      recentOpponents,
    },
    mmrDelta: mmr - rating.mmr,
    lpDelta: lp - rating.lp,
  }
}

export function leagueForLp(lp: number): LeagueId {
  let league: LeagueId = "recruit"
  for (const item of LEAGUES) if (lp >= item.minLp) league = item.id
  return league
}

/** Nhóm MMR để tìm bóng ma (100 MMR / nhóm). */
export const mmrBucket = (mmr: number) => Math.max(0, Math.floor(mmr / 100))
