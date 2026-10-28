/** Các icon PNG manifest cần (Android yêu cầu 192 + 512, thêm bản maskable cho launcher bo hình). */
export const PWA_ICON_VARIANTS = {
  "any-192": { size: 192, maskable: false },
  "any-512": { size: 512, maskable: false },
  "maskable-512": { size: 512, maskable: true },
} as const

export type PwaIconVariant = keyof typeof PWA_ICON_VARIANTS

export const PWA_ICON_PATH = "/pwa-icon"
