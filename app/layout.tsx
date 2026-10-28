import type { Metadata } from "next"
import { Baloo_2 } from "next/font/google"
import localFont from "next/font/local"

import { JsonLd } from "@/components/seo/json-ld"
import { Toaster } from "@/components/ui/sonner"
import { organizationJsonLd, websiteJsonLd } from "@/lib/seo/schema"
import { siteConfig } from "@/lib/site"
import { AppProviders } from "@/providers/app-providers"
import "./globals.css"

const inter = localFont({
  src: "../public/fonts/inter.ttf",
  variable: "--font-inter",
  display: "swap",
})

/** Font tròn cho tiêu đề, số điểm và nút (Google Fonts, tải lúc build và tự host). */
const baloo = Baloo_2({
  subsets: ["latin", "vietnamese"],
  weight: ["600", "700", "800"],
  variable: "--font-baloo",
  display: "swap",
})

export const metadata: Metadata = {
  metadataBase: new URL(siteConfig.url),
  title: {
    default: siteConfig.name,
    template: `%s | ${siteConfig.name}`,
  },
  description: siteConfig.description,
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${inter.variable} ${baloo.variable} dark h-full antialiased`} suppressHydrationWarning>
      <body className="relative flex min-h-full flex-col bg-background">
        <AppProviders>
          <JsonLd data={[websiteJsonLd(), organizationJsonLd()]} />
          {children}
          <Toaster />
        </AppProviders>
      </body>
    </html>
  )
}
