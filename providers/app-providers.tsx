"use client"

import { ThemeProvider } from "next-themes"

import { TooltipProvider } from "@/components/ui/tooltip"
import { I18nProvider } from "@/lib/i18n"
import { ReferralLinkCapture } from "@/modules/progression/components/referral-link-capture"
import { PwaRuntime } from "@/modules/pwa/components/pwa-runtime"
import { FirebaseAuthProvider } from "@/providers/firebase-auth-provider"
import { QueryProvider } from "@/providers/query-provider"

/** Game chỉ có một giao diện tối (bộ màu trong app/globals.css `.dark`). */
export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider attribute="class" forcedTheme="dark" disableTransitionOnChange>
      <I18nProvider>
        <QueryProvider>
          <FirebaseAuthProvider>
            <TooltipProvider>{children}</TooltipProvider>
            <ReferralLinkCapture />
            <PwaRuntime />
          </FirebaseAuthProvider>
        </QueryProvider>
      </I18nProvider>
    </ThemeProvider>
  )
}
