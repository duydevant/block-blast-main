import { OG_IMAGE_SIZE, renderOgImage } from "@/server/og/og-image-frame"

export const alt = "Block puzzle"
export const size = OG_IMAGE_SIZE
export const contentType = "image/png"

/** Ảnh preview mặc định khi dán link trang chủ / màn chơi. */
export default async function SiteOgImage() {
  return renderOgImage({ label: "Xếp khối 8×8 · Block puzzle", headline: "8×8", caption: "Thử thách mỗi ngày · Daily challenge" })
}
