"use client"

import { useId } from "react"

import { useI18n, type TranslationKey } from "@/lib/i18n"

import {
  DRAG_LIFT_OPTIONS,
  REDUCE_MOTION_OPTIONS,
  useBlockPuzzleSettingsStore,
} from "../store/block-puzzle-settings-store"

const SEGMENT =
  "flex-1 rounded-xl px-2 py-1.5 text-sm font-bold text-violet-200/70 transition hover:bg-white/10 aria-pressed:bg-[#4b3fa8] aria-pressed:text-white"
const ROW = "flex flex-col gap-1.5 rounded-2xl bg-[#2a2459] p-3"

/** Chọn 1 trong vài giá trị (nút bấm có aria-pressed, gom trong group có nhãn). */
function SegmentedSetting<T extends string>({ label, options, value, onChange, optionKey }: {
  label: string
  options: readonly T[]
  value: T
  onChange: (value: T) => void
  optionKey: (option: T) => TranslationKey
}) {
  const { t } = useI18n()
  const labelId = useId()
  return (
    <div className={ROW}>
      <span id={labelId} className="text-sm font-bold text-white">{label}</span>
      <div role="group" aria-labelledby={labelId} className="flex gap-1 rounded-xl bg-black/20 p-1">
        {options.map((option) => (
          <button key={option} className={SEGMENT} aria-pressed={value === option} onClick={() => onChange(option)}>
            {t(optionKey(option))}
          </button>
        ))}
      </div>
    </div>
  )
}

/** Công tắc bật/tắt có dòng giải thích ngắn. */
function SwitchSetting({ label, hint, checked, onChange }: { label: string; hint: string; checked: boolean; onChange: (value: boolean) => void }) {
  return (
    <button role="switch" aria-checked={checked} onClick={() => onChange(!checked)} className={`${ROW} flex-row items-center justify-between text-left`}>
      <span className="flex flex-col">
        <span className="text-sm font-bold text-white">{label}</span>
        <span className="text-xs text-violet-200/70">{hint}</span>
      </span>
      <span aria-hidden="true" className={`relative h-6 w-11 shrink-0 rounded-full transition ${checked ? "bg-[#7c6cf0]" : "bg-white/20"}`}>
        <span className={`absolute top-0.5 size-5 rounded-full bg-white transition-all ${checked ? "left-[22px]" : "left-0.5"}`} />
      </span>
    </button>
  )
}

/** Nhóm "Điều khiển & hiển thị" trong menu ván: nâng khối khi kéo, giảm chuyển động, ký hiệu màu, báo trước dòng xoá. */
export function GameDisplaySettingsSection() {
  const { t } = useI18n()
  const settings = useBlockPuzzleSettingsStore()

  return (
    <section aria-labelledby="game-display-settings" className="flex flex-col gap-2">
      <h3 id="game-display-settings" className="px-1 text-sm font-extrabold tracking-wide text-violet-200/80 uppercase">
        {t("gameSettings.controlsTitle")}
      </h3>
      <SegmentedSetting
        label={t("gameSettings.dragLift")}
        options={DRAG_LIFT_OPTIONS}
        value={settings.dragLift}
        onChange={settings.setDragLift}
        optionKey={(option) => `gameSettings.dragLift.${option}`}
      />
      <SegmentedSetting
        label={t("gameSettings.reduceMotion")}
        options={REDUCE_MOTION_OPTIONS}
        value={settings.reduceMotion}
        onChange={settings.setReduceMotion}
        optionKey={(option) => `gameSettings.reduceMotion.${option}`}
      />
      <SwitchSetting
        label={t("gameSettings.colorblindMarks")}
        hint={t("gameSettings.colorblindMarksHint")}
        checked={settings.colorblindMarks}
        onChange={settings.setColorblindMarks}
      />
      <SwitchSetting
        label={t("gameSettings.linePreview")}
        hint={t("gameSettings.linePreviewHint")}
        checked={settings.linePreview}
        onChange={settings.setLinePreview}
      />
      <p className="px-1 text-xs text-violet-200/60">{t("gameSettings.keyboardHint")}</p>
    </section>
  )
}
