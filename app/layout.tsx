import type { Metadata } from "next"
// Baloo 2 tự host qua npm (Fontsource): build không cần gọi Google Fonts.
import "@fontsource-variable/baloo-2"
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
    <html lang="en" className={`${inter.variable} dark h-full antialiased`} suppressHydrationWarning>
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
