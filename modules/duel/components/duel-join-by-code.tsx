"use client"

import { useRouter } from "next/navigation"
import { useState } from "react"
import { LogInIcon } from "lucide-react"

import { useI18n } from "@/lib/i18n"
import { Routes } from "@/lib/routes"

import { DUEL_CODE_LENGTH, normalizeDuelCode } from "../duel-types"

/** Ô nhập mã phòng 6 ký tự + nút "Vào" (cùng hàng, cùng chiều cao) → mở phòng như khi bấm link. */
export function DuelJoinByCode() {
  const { t } = useI18n()
  const router = useRouter()
  const [value, setValue] = useState("")
  const code = normalizeDuelCode(value)

  return (
    <form
      className="flex flex-col gap-2"
      onSubmit={(event) => {
        event.preventDefault()
        if (code) router.push(`${Routes.DUEL}/${code}`)
      }}
    >
      <label htmlFor="duel-code" className="text-sm font-extrabold">
        {t("duel.joinWithCode")}
      </label>
      <div className="flex items-stretch gap-2">
        <input
          id="duel-code"
          value={value}
          onChange={(event) => setValue(event.target.value.toUpperCase().slice(0, DUEL_CODE_LENGTH + 2))}
          placeholder={t("duel.codePlaceholder")}
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          inputMode="text"
          maxLength={DUEL_CODE_LENGTH + 2}
          className="h-14 min-w-0 flex-1 rounded-2xl border-2 border-[#5a2448] bg-[#2a1226] px-4 text-center font-heading text-2xl font-extrabold tracking-[0.3em] text-white uppercase placeholder:text-white/25 focus:border-[#ff7eb6] focus:outline-none"
        />
        <button
          type="submit"
          disabled={!code}
          className="flex h-14 shrink-0 items-center gap-2 rounded-2xl bg-[#ff7eb6] px-5 font-heading text-xl font-extrabold text-[#3a0620] shadow-[0_4px_0_#c94480] disabled:opacity-40 disabled:shadow-none"
        >
          <LogInIcon className="size-5" aria-hidden="true" />
          {t("duel.go")}
        </button>
      </div>
    </form>
  )
}
