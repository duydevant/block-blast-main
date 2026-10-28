import Link from "next/link"

import { Button } from "@/components/ui/button"
import { Routes } from "@/lib/routes"

export default function NotFound() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 text-center">
      <h1 className="text-4xl font-bold">404</h1>
      <p className="text-muted-foreground">This page could not be found.</p>
      <Button render={<Link href={Routes.HOME} />}>Back home</Button>
    </div>
  )
}
