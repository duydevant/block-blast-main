export enum Routes {
  HOME = "/",
  PLAY = "/play",
  /** Vào thẳng thử thách hằng ngày (màn chơi đọc query rồi bỏ đi). */
  PLAY_DAILY = "/play?daily=1",
  /** Nút Play chung: luôn vào ván Vô tận (ván Vô tận đang dở thì chơi tiếp). */
  PLAY_ENDLESS = "/play?endless=1",
  LEADERBOARD = "/leaderboard",
  /** Trang thách đấu: `${Routes.CHALLENGE}/{id}`. */
  CHALLENGE = "/c",
  PROFILE = "/profile",
  /** Giải thích + bảng của thử thách ngày. */
  DAILY = "/daily",
  HOW_TO_PLAY = "/how-to-play",
  LEVELS = "/levels",
  /** Phòng đấu: `${Routes.DUEL}/{id}`. */
  DUEL = "/duel",
}

/** API route nội bộ (Next route handler + Firebase Admin). */
export enum ApiRoutes {
  GAMES_START = "/api/games/start",
  GAMES_SUBMIT = "/api/games/submit",
  PROFILE = "/api/profile",
  DAILY = "/api/daily",
  DAILY_CLAIM = "/api/daily/claim",
  DAILY_WEEK_CLAIM = "/api/daily/week-claim",
  LEADERBOARDS = "/api/leaderboards",
  CHALLENGES = "/api/challenges",
  DUELS = "/api/duels",
  SHOP_THEMES = "/api/shop/themes",
  REFERRAL = "/api/referral",
  REFERRAL_CLAIM = "/api/referral/claim",
  PUSH_SUBSCRIPTIONS = "/api/push/subscriptions",
  PRESENCE = "/api/presence",
}
