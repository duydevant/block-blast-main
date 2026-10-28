import { ImageResponse } from "next/og"

import { AppIconArtwork } from "@/modules/pwa/app-icon-artwork"
import { PWA_ICON_VARIANTS, type PwaIconVariant } from "@/modules/pwa/pwa-icon-variants"

export const dynamic = "force-static"

export function generateStaticParams() {
  return Object.keys(PWA_ICON_VARIANTS).map((variant) => ({ variant }))
}

/** Icon PNG cho manifest: `/pwa-icon/any-192`, `/pwa-icon/any-512`, `/pwa-icon/maskable-512`. */
export async function GET(_request: Request, { params }: { params: Promise<{ variant: string }> }) {
  const { variant } = await params
  const icon = PWA_ICON_VARIANTS[variant as PwaIconVariant]
  if (!icon) return new Response("Not found", { status: 404 })
  return new ImageResponse(<AppIconArtwork size={icon.size} maskable={icon.maskable} />, { width: icon.size, height: icon.size })
}
