export enum Routes {
  HOME = "/",
  PLAY = "/play",
  /** Vào thẳng thử thách hằng ngày (màn chơi đọc query rồi bỏ đi). */
  PLAY_DAILY = "/play?daily=1",
  /** Nút Play chung: luôn vào ván Vô tận (ván Vô tận đang dở thì chơi tiếp). */
  PLAY_ENDLESS = "/play?endless=1",
  /** Chế độ "Không bế tắc" (khay luôn có lối đi). */
  PLAY_LOGIC = "/play?logic=1",
  LEADERBOARD = "/leaderboard",
  /** Trang thách đấu: `${Routes.CHALLENGE}/{id}`. */
  CHALLENGE = "/c",
  PROFILE = "/profile",
  /** Lịch sử ván đã nộp của chính mình. */
  PROFILE_GAMES = "/profile/games",
  /** Xem lại ván: `${Routes.REPLAY}/{replayId}`. */
  REPLAY = "/game",
  /** Đấu trường: chọn loại + cấp, lượt đang mở. */
  ARENA = "/arena",
  /** Mùa giải tháng: nhiệm vụ mùa, Bậc cao nhất, thưởng mùa trước. */
  SEASON = "/season",
  /** Hồ sơ công khai: `${Routes.PLAYER}/{tag}`. */
  PLAYER = "/u",
  /** Giải thích + bảng của thử thách ngày. */
  DAILY = "/daily",
  /** Cách chơi; bài học kỹ thuật ở `${Routes.HOW_TO_PLAY}/{slug}`. */
  HOW_TO_PLAY = "/how-to-play",
  LEVELS = "/levels",
  /** Phòng đấu: `${Routes.DUEL}/{id}`. */
  DUEL = "/duel",
}

/** API route nội bộ (Next route handler + Firebase Admin). */
export enum ApiRoutes {
  GAMES_START = "/api/games/start",
  GAMES_SUBMIT = "/api/games/submit",
  GAMES_HISTORY = "/api/games/history",
  MISSIONS_REPLACE = "/api/missions/replace",
  REPLAYS = "/api/replays",
  REPORTS = "/api/reports",
  ARENA = "/api/arena",
  ARENA_RUNS = "/api/arena/runs",
  ARENA_ABANDON = "/api/arena/runs/abandon",
  SEASONS = "/api/seasons",
  SEASONS_CLAIM = "/api/seasons/claim",
  LESSONS_COMPLETE = "/api/lessons/complete",
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
