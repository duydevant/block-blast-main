import { ImageResponse } from "next/og"

import { AppIconArtwork } from "@/modules/pwa/app-icon-artwork"

export const size = { width: 180, height: 180 }
export const contentType = "image/png"

/** Icon khi "Thêm vào MH chính" trên iOS (iOS tự bo góc nên vẽ tràn viền). */
export default function AppleIcon() {
  return new ImageResponse(<AppIconArtwork size={size.width} maskable />, size)
}
