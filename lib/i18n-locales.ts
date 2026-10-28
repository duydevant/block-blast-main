/** Ngôn ngữ hỗ trợ — tách khỏi lib/i18n.tsx (client component) để code server import được. */
export const locales = ["en", "vi"] as const

export type Locale = (typeof locales)[number]
