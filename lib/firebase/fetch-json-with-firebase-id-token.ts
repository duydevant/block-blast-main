import { getFirebaseAuth } from "./firebase-client-app"

/** Lỗi HTTP từ API của app; `status` dùng để phân biệt lỗi tạm (retry) với bị từ chối (bỏ). */
export class ApiRequestError extends Error {
  constructor(
    readonly status: number,
    readonly code: string
  ) {
    super(`${status} ${code}`)
  }
}

/**
 * Gọi API route của app kèm Firebase ID token của người đang đăng nhập (kể cả khách).
 * `expectedUid`: dữ liệu thuộc về uid này — đang đổi tài khoản thì dừng (lỗi tạm) thay vì gửi bằng token người khác.
 */
export async function fetchJsonWithFirebaseIdToken<T>(
  path: string,
  init: { method: string; body?: unknown; expectedUid?: string }
): Promise<T> {
  const user = getFirebaseAuth().currentUser
  if (!user) throw new ApiRequestError(401, "not-signed-in")
  if (init.expectedUid && user.uid !== init.expectedUid) throw new ApiRequestError(401, "account-changed")
  const token = await user.getIdToken()

  const response = await fetch(path, {
    method: init.method,
    headers: { Authorization: `Bearer ${token}`, ...(init.body === undefined ? {} : { "Content-Type": "application/json" }) },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  })
  const json = (await response.json().catch(() => ({}))) as { error?: string }
  if (!response.ok) throw new ApiRequestError(response.status, json.error ?? "unknown")
  return json as T
}
