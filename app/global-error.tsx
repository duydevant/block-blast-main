"use client"

import { useEffect } from "react"

import { isStaleDeployError, reloadOnceForStaleDeploy } from "@/lib/stale-deploy-error"

/** Lỗi ngay ở root layout (provider…): thay cả layout nên tự dựng html/body, không có CSS/i18n của app. */
export default function GlobalError({ error }: { error: Error & { digest?: string } }) {
  useEffect(() => {
    console.error(error)
    if (isStaleDeployError(error)) reloadOnceForStaleDeploy()
  }, [error])

  return (
    <html lang="en">
      <body style={{ margin: 0, minHeight: "100vh", display: "grid", placeItems: "center", background: "#17132f", color: "#f4f1ff", fontFamily: "system-ui, sans-serif", textAlign: "center", padding: 16 }}>
        <div>
          <h1 style={{ fontSize: 22 }}>Something went wrong · Có lỗi xảy ra</h1>
          <button
            onClick={() => window.location.reload()}
            style={{ marginTop: 12, padding: "10px 20px", borderRadius: 999, border: 0, background: "#ffb547", color: "#17132f", fontWeight: 700, cursor: "pointer" }}
          >
            Reload · Tải lại
          </button>
          <p style={{ marginTop: 12, fontSize: 12, opacity: 0.6, wordBreak: "break-all" }}>{error.digest ?? error.message}</p>
        </div>
      </body>
    </html>
  )
}
