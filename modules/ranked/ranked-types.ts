import type { PlayerTierId } from "@/modules/progression/player-form-rules"

import type { LeagueId, MatchResult } from "./rating-rules"

/** Bóng ma gửi cho client: phát lại cùng seed theo nhịp thật. Không có uid. */
export interface GhostView {
  displayName: string | null
  tier: PlayerTierId | null
  isBot: boolean
  /** Nước đi nén (recorded-action-codec). */
  actions: number[]
  /** ms từ đầu ván của từng nước. */
  times: number[]
}

/** POST /api/ranked/match → thông tin trận (đi kèm StartRankedGameResponse mode "ranked"). */
export interface RankedMatchInfo {
  ghost: GhostView
  /** Giờ server trận kết thúc (3 phút). */
  endsAt: number
  serverNow: number
}

/** GET /api/ranked */
export interface RankedStatusResponse {
  season: string
  lp: number
  league: LeagueId
  /** Còn bao nhiêu trận xếp hạng trước khi có LP. */
  placementsLeft: number
  wins: number
  losses: number
  draws: number
}

/** Kết quả trận trả kèm phần thưởng ván. */
export interface RankedMatchReward {
  result: MatchResult
  ghostScore: number
  lpBefore: number
  lpAfter: number
  league: LeagueId
  placementsLeft: number
  isBot: boolean
}
