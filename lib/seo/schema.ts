import { Routes } from "@/lib/routes"
import { siteConfig } from "@/lib/site"

export function websiteJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: siteConfig.name,
    url: siteConfig.url,
  }
}

export function videoGameJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "VideoGame",
    name: siteConfig.name,
    description: siteConfig.description,
    url: new URL(Routes.PLAY, siteConfig.url).toString(),
    genre: "Puzzle",
    gamePlatform: "Web browser",
    applicationCategory: "Game",
    operatingSystem: "Any",
    offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
  }
}

export function organizationJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: siteConfig.name,
    url: siteConfig.url,
  }
}
