/**
 * src/audio/input.ts — Picks the best available microphone and feeds 16 kHz audio to the segmenter.
 *
 * Order: G2 glasses mic (speaker-tagged) → phone mic via Even bridge → browser getUserMedia (preview/testing).
 * Note: the glasses mic only streams after the startup page exists, so call start() after the first render.
 */

import type { Glasses, AudioFrame } from '../platform/glasses'
import type { AudioSourceKind } from '../types'
import { Segmenter, SAMPLE_RATE } from './segmenter'
import { diag, diagEvent } from '../diagnostics'

const KNOWN_RATES = [8000, 16000, 22050, 24000, 32000, 44100, 48000]
const FIRST_FRAME_WAIT_MS = 5000

export class AudioInput {
  source: AudioSourceKind = 'none'
  private bridgeRate = SAMPLE_RATE
  private rateProbe = { start: 0, bytes: 0, done: false }
  private lastBridgeFrameAt = 0
  private web?: { ctx: AudioContext; stream: MediaStream; node: ScriptProcessorNode }
  private listeners: Array<() => void> = []

  constructor(
    private glasses: Glasses,
    private segmenter: Segmenter,
  ) {
    glasses.onAudio((f) => this.onBridgeFrame(f))
  }

  onSourceChange(fn: () => void): void {
    this.listeners.push(fn)
  }

  async start(): Promise<AudioSourceKind> {
    if (this.glasses.connected) {
      if ((await this.glasses.openMic('glasses')) && (await this.waitForFrames())) {
        return this.setSource('glasses')
      }
      diagEvent('glasses_mic_silent_trying_phone')
      if ((await this.glasses.openMic('phone')) && (await this.waitForFrames())) {
        return this.setSource('phone-bridge')
      }
    }
    if (await this.startWebMic()) return this.setSource('phone-web')
    return this.setSource('none')
  }

  /** Browser mic needs a user gesture on some WebViews; the phone UI calls this from a button */
  async startFromGesture(): Promise<AudioSourceKind> {
    if (this.source !== 'none') return this.source
    if (this.web) await this.web.ctx.resume()
    return this.start()
  }

  private setSource(s: AudioSourceKind): AudioSourceKind {
    this.source = s
    diag.audioSource = s
    diagEvent('audio_source', s)
    this.listeners.forEach((fn) => fn())
    return s
  }

  private waitForFrames(): Promise<boolean> {
    const since = Date.now()
    return new Promise((resolve) => {
      const check = setInterval(() => {
        if (this.lastBridgeFrameAt > since) {
          clearInterval(check)
          resolve(true)
        } else if (Date.now() - since > FIRST_FRAME_WAIT_MS) {
          clearInterval(check)
          resolve(false)
        }
      }, 200)
    })
  }

  private onBridgeFrame(f: AudioFrame): void {
    this.lastBridgeFrameAt = Date.now()
    // Glasses audio showed up late (e.g. after reconnect): prefer it over the browser mic
    if (this.source === 'phone-web' && f.source === 'glasses') {
      this.stopWebMic()
      this.setSource('glasses')
    }
    if (this.source === 'phone-web') return

    this.probeRate(f.pcm.length)
    const n = Math.floor(f.pcm.length / 2)
    if (n < 16) return
    const view = new DataView(f.pcm.buffer, f.pcm.byteOffset, n * 2)
    const samples = new Float32Array(n)
    for (let i = 0; i < n; i++) samples[i] = view.getInt16(i * 2, true) / 32768
    this.segmenter.push(resample(samples, this.bridgeRate), f.role)
  }

  /** The SDK doesn't document the PCM rate; infer it from bytes/second over the first few seconds */
  private probeRate(bytes: number): void {
    const p = this.rateProbe
    if (p.done) return
    const now = Date.now()
    if (!p.start) p.start = now
    p.bytes += bytes
    const elapsed = (now - p.start) / 1000
    if (elapsed >= 3) {
      const raw = p.bytes / 2 / elapsed
      this.bridgeRate = KNOWN_RATES.reduce((a, b) => (Math.abs(b - raw) < Math.abs(a - raw) ? b : a))
      diag.sampleRateEstimate = this.bridgeRate
      p.done = true
      diagEvent('pcm_rate', { raw: Math.round(raw), snapped: this.bridgeRate })
    }
  }

  private async startWebMic(): Promise<boolean> {
    if (!navigator.mediaDevices?.getUserMedia) return false
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      })
      const Ctx = window.AudioContext || (window as any).webkitAudioContext
      const ctx: AudioContext = new Ctx()
      const src = ctx.createMediaStreamSource(stream)
      const node = ctx.createScriptProcessor(4096, 1, 1)
      node.onaudioprocess = (e) => {
        const input = e.inputBuffer.getChannelData(0)
        this.segmenter.push(resample(new Float32Array(input), ctx.sampleRate), 'unknown')
      }
      src.connect(node)
      node.connect(ctx.destination)
      if (ctx.state === 'suspended') await ctx.resume().catch(() => undefined)
      this.web = { ctx, stream, node }
      return true
    } catch (e) {
      diagEvent('web_mic_error', String(e))
      return false
    }
  }

  private stopWebMic(): void {
    if (!this.web) return
    this.web.node.disconnect()
    this.web.stream.getTracks().forEach((t) => t.stop())
    void this.web.ctx.close()
    this.web = undefined
  }
}

/** Linear resample to 16 kHz */
function resample(input: Float32Array, fromRate: number): Float32Array {
  if (fromRate === SAMPLE_RATE) return input
  const ratio = fromRate / SAMPLE_RATE
  const out = new Float32Array(Math.floor(input.length / ratio))
  for (let i = 0; i < out.length; i++) {
    const pos = i * ratio
    const i0 = Math.floor(pos)
    const i1 = Math.min(i0 + 1, input.length - 1)
    const t = pos - i0
    out[i] = input[i0] * (1 - t) + input[i1] * t
  }
  return out
}
