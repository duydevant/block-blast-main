import "server-only"

import { ImageResponse } from "next/og"

import { siteConfig } from "@/lib/site"

export const OG_IMAGE_SIZE = { width: 1200, height: 630 }

/** Ảnh 1200×630 cùng khung với thẻ share trong game: tên game, dòng phụ, số lớn, chú thích. */
export async function renderOgImage(content: { label: string; headline: string; caption: string }): Promise<ImageResponse> {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(180deg, #2f2468 0%, #110e27 100%)",
          color: "#ffffff",
          textAlign: "center",
          padding: 60,
        }}
      >
        <div style={{ fontSize: 40, fontWeight: 700, color: "#c4b5fd" }}>{siteConfig.name}</div>
        <div style={{ fontSize: 44, marginTop: 36, color: "#e9e5ff" }}>{content.label}</div>
        <div style={{ fontSize: 150, fontWeight: 800, lineHeight: 1.1 }}>{content.headline}</div>
        <div style={{ fontSize: 46, fontWeight: 700, color: "#fcd34d", marginTop: 12 }}>{content.caption}</div>
      </div>
    ),
    // Font mặc định của next/og (Geist). Inter trong public/fonts là font variable — satori không đọc được.
    OG_IMAGE_SIZE
  )
}
