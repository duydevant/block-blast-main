/** Âm thanh tổng hợp bằng Web Audio (oscillator + envelope), không dùng file âm thanh. */
export type SoundName = "pick" | "place" | "invalid" | "clear" | "combo" | "gameOver"

let audioContext: AudioContext | null = null
let master: GainNode | null = null

/** Thang ngũ cung (C major pentatonic) cho tiếng xoá dòng. */
const PENTATONIC = [523.25, 587.33, 659.25, 783.99, 880, 1046.5, 1174.66, 1318.51, 1567.98]

/** Gọi trong user gesture (pointerdown/up, keydown) để trình duyệt cho phép phát tiếng. */
export function unlockAudio() {
  try {
    const AudioContextClass = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!AudioContextClass) return
    if (!audioContext) {
      audioContext = new AudioContextClass()
      master = audioContext.createGain()
      master.gain.value = 0.22
      master.connect(audioContext.destination)
    }
    if (audioContext.state !== "running") void audioContext.resume().catch(() => {})
  } catch {
    audioContext = null
    master = null
  }
}

interface ToneOptions {
  frequency: number
  /** Tần số cuối (glide), mặc định giữ nguyên. */
  endFrequency?: number
  type?: OscillatorType
  delay?: number
  duration?: number
  volume?: number
}

function tone({ frequency, endFrequency = frequency, type = "sine", delay = 0, duration = 0.12, volume = 1 }: ToneOptions) {
  if (!audioContext || !master || audioContext.state !== "running") return
  const start = audioContext.currentTime + delay
  const oscillator = audioContext.createOscillator()
  const gain = audioContext.createGain()
  oscillator.type = type
  oscillator.frequency.setValueAtTime(frequency, start)
  oscillator.frequency.exponentialRampToValueAtTime(Math.max(1, endFrequency), start + duration)
  // Attack ngắn rồi tắt dần để không bị "click".
  gain.gain.setValueAtTime(0.0001, start)
  gain.gain.exponentialRampToValueAtTime(volume, start + 0.008)
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration)
  oscillator.connect(gain).connect(master)
  oscillator.start(start)
  oscillator.stop(start + duration + 0.02)
}

/** `intensity`: số dòng xoá (clear) hoặc bậc combo (combo). */
export function playSound(name: SoundName, intensity = 1) {
  switch (name) {
    case "pick":
      tone({ frequency: 520, endFrequency: 700, type: "triangle", duration: 0.06, volume: 0.5 })
      return
    case "place":
      tone({ frequency: 180, endFrequency: 110, type: "sine", duration: 0.1, volume: 0.9 })
      tone({ frequency: 900, type: "triangle", duration: 0.03, volume: 0.15 })
      return
    case "invalid":
      tone({ frequency: 200, endFrequency: 140, type: "square", duration: 0.12, volume: 0.25 })
      return
    case "clear": {
      // Arpeggio dài hơn khi xoá nhiều dòng.
      const notes = Math.min(PENTATONIC.length, 3 + Math.max(1, intensity))
      for (let i = 0; i < notes; i++) tone({ frequency: PENTATONIC[i], type: "triangle", delay: i * 0.045, duration: 0.18, volume: 0.55 })
      return
    }
    case "combo": {
      const base = PENTATONIC[Math.min(PENTATONIC.length - 1, Math.max(0, intensity - 2))]
      tone({ frequency: base, endFrequency: base * 2, type: "sawtooth", delay: 0.12, duration: 0.25, volume: 0.18 })
      tone({ frequency: base * 1.5, type: "triangle", delay: 0.18, duration: 0.3, volume: 0.35 })
      return
    }
    case "gameOver":
      ;[392, 330, 262, 196].forEach((frequency, i) => tone({ frequency, type: "triangle", delay: i * 0.16, duration: 0.3, volume: 0.5 }))
      return
  }
}
