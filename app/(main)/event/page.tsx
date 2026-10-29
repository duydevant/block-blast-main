import { redirect } from "next/navigation"

import { Routes } from "@/lib/routes"

/** Sự kiện tuần đã gộp vào thử thách ngày (mốc + bảng tổng tuần) → link cũ chuyển sang /daily. */
export default function EventPage() {
  redirect(Routes.DAILY)
}
