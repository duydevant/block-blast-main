import { ImageResponse } from "next/og"

import { AppIconArtwork } from "@/modules/pwa/app-icon-artwork"

export const size = { width: 64, height: 64 }
export const contentType = "image/png"

/** Favicon (tab trình duyệt). */
export default function Icon() {
  return new ImageResponse(<AppIconArtwork size={size.width} />, size)
}
