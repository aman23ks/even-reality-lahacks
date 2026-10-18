/**
 * src/diagnostics.ts — Passive device diagnostics.
 *
 * Other modules write into `diag`; a snapshot is posted to the backend every 5s (server appends to diag.log)
 * and shown in the phone's debug panel. Contains no transcripts or audio.
 */

import { API_BASE_URL } from './api'

export const diag = {
  seq: 0,
  bootAt: Date.now(),
  userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
  bridgeAttached: false,
  launchSource: null as string | null,
  inForeground: true,
  visibility: typeof document !== 'undefined' ? document.visibilityState : 'unknown',
  speechRecognitionAvailable: false,
  audioSource: 'none',
  sampleRateEstimate: 0,
  audio: {
    frames: 0,
    bytes: 0,
    lastFrameAt: 0,
    byRole: {} as Record<string, number>,
    bySource: {} as Record<string, number>,
    framesInBackground: 0,
  },
  imuFrames: 0,
  /** sensor traces for tuning "Look up" and testing breath detection (last ~15s, numbers only) */
  imuTrace: [] as Array<[number, number, number, number]>, // [t, x, y, z]
  audioTrace: [] as Array<[number, number, string]>, // [t, rms per 100ms, dominant speaker tag]
  utterances: 0,
  ignoredOtherSpeech: 0,
  /** per-utterance share of frames tagged as the wearer (-1 = untagged mic) */
  recentSelfRatios: [] as number[],
  selfThreshold: 0.15,
  /** per-utterance voiceprint match % (when a voiceprint is set) */
  recentVoiceMatches: [] as number[],
  startupPageResult: null as number | null,
  imageMode: 'png',
  lastImageResult: '',
  backend: { online: false, stt: false, llm: false },
  events: [] as Array<{ t: number; kind: string; detail?: unknown }>,
}

export function diagEvent(kind: string, detail?: unknown): void {
  diag.events.push({ t: Date.now(), kind, detail })
  if (diag.events.length > 40) diag.events.shift()
  console.log('[Compassion Coach]', kind, detail ?? '')
}

export function startDiagnostics(): void {
  const w = window as any
  diag.speechRecognitionAvailable = Boolean(w.SpeechRecognition || w.webkitSpeechRecognition)
  document.addEventListener('visibilitychange', () => {
    diag.visibility = document.visibilityState
    diagEvent('visibility', document.visibilityState)
    void flush()
  })
  setInterval(() => void flush(), 5000)
}

async function flush(): Promise<void> {
  diag.seq++
  try {
    await fetch(`${API_BASE_URL}/api/diag`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...diag, sentAt: Date.now() }),
      keepalive: true,
    })
  } catch {
    // backend unreachable
  }
}
