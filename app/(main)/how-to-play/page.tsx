import type { Metadata } from "next"

import { JsonLd } from "@/components/seo/json-ld"
import { Routes } from "@/lib/routes"
import { HowToPlayGuide } from "@/modules/seo/components/how-to-play-guide"
import { HOW_TO_PLAY_FAQ, howToPlayEn } from "@/modules/seo/how-to-play-translations"

export const metadata: Metadata = {
  title: howToPlayEn["guide.metaTitle"],
  description: howToPlayEn["guide.metaDescription"],
  alternates: { canonical: Routes.HOW_TO_PLAY },
}

/** FAQ structured data khớp với nội dung render server (tiếng Anh). */
function faqJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: HOW_TO_PLAY_FAQ.map((index) => ({
      "@type": "Question",
      name: howToPlayEn[`guide.faq${index}q`],
      acceptedAnswer: { "@type": "Answer", text: howToPlayEn[`guide.faq${index}a`] },
    })),
  }
}

export default function HowToPlayPage() {
  return (
    <>
      <JsonLd data={faqJsonLd()} />
      <HowToPlayGuide />
    </>
  )
}
