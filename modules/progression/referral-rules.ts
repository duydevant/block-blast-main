/** Luật mời bạn, dùng chung client (link, chữ hướng dẫn) và server (kiểm tra, phát quà). */

/** Bảng chữ không có ký tự dễ nhầm (0/O, 1/I/L) vì mã có thể được đọc/gõ tay. */
export const REFERRAL_CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"
export const REFERRAL_CODE_LENGTH = 6
export const REFERRAL_CODE_PATTERN = /^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{6}$/

/** Query param của link mời: `/?ref=ABC123`. */
export const REFERRAL_QUERY_PARAM = "ref"

/** Người được mời phải chơi đủ số ván (đã server replay) thì cả hai mới nhận quà. */
export const REFERRAL_GAMES_REQUIRED = 3
export const REFERRAL_COINS = 200
/** Người mời chỉ nhận xu cho tối đa từng ấy bạn (chặn farm bằng tài khoản khách). */
export const MAX_REWARDED_REFERRALS = 10

export function normalizeReferralCode(raw: string): string | null {
  const code = raw.trim().toUpperCase()
  return REFERRAL_CODE_PATTERN.test(code) ? code : null
}

/** GET /api/referral */
export interface ReferralInfoResponse {
  code: string
  /** Số bạn đã chơi đủ ván (đã phát quà). */
  referralCount: number
}
