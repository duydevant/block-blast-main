import "server-only"

import type { z } from "zod"

import { getAdminAuth } from "@/server/firebase/firebase-admin-app"

/** Lỗi có HTTP status rõ ràng; lỗi khác coi là 500 và không lộ chi tiết ra client. */
export class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly code: string
  ) {
    super(code)
  }
}

/** Lấy uid từ header `Authorization: Bearer <Firebase ID token>`; uid không bao giờ lấy từ body. */
export async function requireUid(request: Request): Promise<string> {
  const header = request.headers.get("authorization") ?? ""
  const match = /^Bearer (.+)$/.exec(header)
  if (!match) throw new HttpError(401, "missing-token")
  // Lỗi cấu hình Admin SDK phải ra 500 (client giữ ván để thử lại), không lẫn với token sai.
  const adminAuth = getAdminAuth()
  try {
    const decoded = await adminAuth.verifyIdToken(match[1])
    return decoded.uid
  } catch (error) {
    const code = (error as { code?: unknown }).code
    if (typeof code === "string" && code.startsWith("auth/")) throw new HttpError(401, "invalid-token")
    throw error
  }
}

/** Đọc + validate body JSON với giới hạn kích thước. */
export async function readJsonBody<T>(request: Request, schema: z.ZodType<T>, maxBytes: number): Promise<T> {
  const declared = Number(request.headers.get("content-length") ?? 0)
  if (declared > maxBytes) throw new HttpError(413, "body-too-large")
  const text = await request.text()
  if (text.length > maxBytes) throw new HttpError(413, "body-too-large")

  let json: unknown
  try {
    json = text ? JSON.parse(text) : {}
  } catch {
    throw new HttpError(400, "invalid-json")
  }
  const parsed = schema.safeParse(json)
  if (!parsed.success) throw new HttpError(400, "invalid-body")
  return parsed.data
}

/** Bọc handler: chuyển HttpError thành JSON `{ error }`, log lỗi lạ phía server. */
export async function handleJsonRoute(handler: () => Promise<unknown>): Promise<Response> {
  try {
    return Response.json(await handler(), { headers: { "Cache-Control": "no-store" } })
  } catch (error) {
    if (error instanceof HttpError) return Response.json({ error: error.code }, { status: error.status })
    console.error("[api]", error)
    return Response.json({ error: "internal" }, { status: 500 })
  }
}
