import "server-only"

import type { RankedStatusResponse } from "@/modules/ranked/ranked-types"
import { leagueForLp, PLACEMENT_GAMES, rankedSeasonKeyFor, ratingForSeason } from "@/modules/ranked/rating-rules"
import { getAdminFirestore } from "@/server/firebase/firebase-admin-app"
import { parseStoredPlayer, USERS_COLLECTION } from "@/server/profile/stored-player-document"

export async function getRankedStatus(uid: string): Promise<RankedStatusResponse> {
  const season = rankedSeasonKeyFor(new Date())
  const stored = parseStoredPlayer((await getAdminFirestore().collection(USERS_COLLECTION).doc(uid).get()).data())
  const rating = ratingForSeason(stored.rating, season)
  return {
    season,
    lp: rating.lp,
    league: leagueForLp(rating.lp),
    placementsLeft: Math.max(0, PLACEMENT_GAMES - rating.placements),
    wins: rating.wins,
    losses: rating.losses,
    draws: rating.draws,
  }
}
