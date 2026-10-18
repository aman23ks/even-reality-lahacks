/**
 * src/audio/speechFallback.ts — WebView speech recognition, used only when the backend has no STT key.
 * It listens through the phone mic, so the controller gates each transcript on recent wearer audio.
 */

import { diagEvent } from '../diagnostics'

export function startSpeechFallback(onText: (text: string) => void): boolean {
  const w = window as any
  const Rec = w.SpeechRecognition || w.webkitSpeechRecognition
  if (!Rec) return false
  const rec = new Rec()
  rec.continuous = true
  rec.interimResults = false
  rec.lang = 'en-US'

  let blocked = false
  let failures = 0
  rec.onresult = (e: any) => {
    failures = 0
    const r = e.results[e.results.length - 1]
    if (r?.isFinal) onText(String(r[0]?.transcript ?? ''))
  }
  rec.onerror = (e: any) => {
    if (e.error === 'not-allowed' || e.error === 'service-not-allowed') {
      blocked = true
      diagEvent('speech_api_blocked', e.error)
    } else if (e.error !== 'no-speech' && e.error !== 'aborted') {
      failures++
      diagEvent('speech_api_error', e.error)
    }
  }
  rec.onend = () => {
    if (blocked) return
    // Back off on repeated failures so a broken mic can't spin the CPU
    setTimeout(() => {
      try {
        rec.start()
      } catch {
        // already running
      }
    }, Math.min(10_000, 300 * 2 ** failures))
  }
  try {
    rec.start()
    diagEvent('speech_api_started')
    return true
  } catch (e) {
    diagEvent('speech_api_start_failed', String(e))
    return false
  }
}
