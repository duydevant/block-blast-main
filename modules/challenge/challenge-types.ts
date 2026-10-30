/** Kiểu dữ liệu thách đấu bạn bè dùng chung giữa API/trang server và UI client. */

/** Id thách đấu: 10 ký tự chữ/số (đủ khó đoán, link ngắn). */
export const CHALLENGE_ID_PATTERN = /^[A-Za-z0-9]{10}$/

export interface ChallengeResultRow {
  /** null = khách chưa đặt tên → UI hiện "Khách #tag". Không trả uid ra trang công khai. */
  displayName: string | null
  tag: string
  score: number
}

/** GET /api/challenges/{id} và trang /c/{id}. Không chứa seed. */
export interface ChallengeView {
  id: string
  creatorName: string | null
  creatorTag: string
  creatorScore: number
  attempts: number
  /** Hạn thưởng 2 chiều (epoch ms) khi còn hạn: vượt điểm trước hạn → cả hai nhận xu. null = hết hạn / thách đấu cũ. */
  rewardExpiresAt: number | null
  results: ChallengeResultRow[]
}

/** POST /api/challenges */
export interface CreateChallengeResponse {
  challengeId: string
}

/** Người thách đấu, gắn vào ván đang chơi để so sánh ở màn hết ván. */
export interface ChallengeOpponent {
  id: string
  creatorName: string | null
  creatorTag: string
  creatorScore: number
}
