import type { Metadata } from "next"
import { notFound } from "next/navigation"

import { RecapPageClient } from "@/modules/recap/components/recap-page-client"

interface RecapPageProps {
  params: Promise<{ year: string }>
}

export const metadata: Metadata = {
  title: "Year in review",
  robots: { index: false },
}

/** Tổng kết năm của người chơi (dữ liệu riêng tư → tải phía client sau khi đăng nhập; API tự đóng ngoài mùa tổng kết). */
export default async function RecapPage({ params }: RecapPageProps) {
  const year = Number((await params).year)
  if (!Number.isInteger(year) || year < 2026 || year > 2100) notFound()
  return (
    <div className="mx-auto w-full max-w-md px-4 pt-2 pb-6">
      <RecapPageClient year={year} />
    </div>
  )
}
