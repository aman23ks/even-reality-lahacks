/**
 * src/audio/segmenter.ts — Voice activity detection + utterance segmentation (16 kHz mono).
 *
 * Turns a continuous stream into utterances (speech ending in a ~700ms pause). Frames the glasses tag as
 * another speaker never enter an utterance; they only bump an "ignored" counter.
 */

import { diag } from '../diagnostics'

export const SAMPLE_RATE = 16000
const SUB = 320 // 20ms
const PREROLL_SUBS = 15 // 300ms
const START_SUBS = 3 // 60ms of speech to open an utterance
const END_SILENCE_MS = 500
const MAX_UTTERANCE_MS = 12000
const MIN_VOICED_MS = 450

export interface Utterance {
  pcm: Int16Array
  durationMs: number
  voicedMs: number
  rms: number
  pitchHz: number // 0 if unknown
  endedAt: number
  /** share of loud frames the glasses tagged as the wearer (null when the mic gives no tags) */
  selfRatio: number | null
}

type Role = 'self' | 'other' | 'unknown'

export class Segmenter {
  speaking = false
  /**
   * The G2's per-frame speaker tag flickers even while the wearer talks (~20-80% "self"), so we decide
   * per utterance: it's the wearer's if at least this share of its loud frames were tagged "self".
   * Tuned per person by the voice check (see Aura.calibrateVoice).
   */
  selfThreshold = 0.15

  private carry = new Float32Array(0)
  private noise = 0.01
  private run = 0
  private silenceMs = 0
  private preroll: Float32Array[] = []
  private chunks: Float32Array[] = []
  private voiced: Float32Array[] = []
  private voicedRmsSum = 0
  private tags = { self: 0, other: 0 }
  private trace = { sum: 0, n: 0, self: 0, other: 0 }

  private uttFns: Array<(u: Utterance) => void> = []
  private startFns: Array<() => void> = []
  private otherFns: Array<() => void> = []
  private otherUttFns: Array<(u: Utterance) => void> = []

  onUtterance(fn: (u: Utterance) => void): void {
    this.uttFns.push(fn)
  }
  onSpeechStart(fn: () => void): void {
    this.startFns.push(fn)
  }
  /** The other speaker's audio (only used to sense their mood; their words are never shown or stored) */
  onOtherUtterance(fn: (u: Utterance) => void): void {
    this.otherUttFns.push(fn)
  }
  /** An utterance was judged to be someone other than the wearer */
  onOtherSpeaker(fn: () => void): void {
    this.otherFns.push(fn)
  }

  push(samples: Float32Array, role: Role): void {
    let buf = samples
    if (this.carry.length) {
      buf = new Float32Array(this.carry.length + samples.length)
      buf.set(this.carry)
      buf.set(samples, this.carry.length)
    }
    let i = 0
    for (; i + SUB <= buf.length; i += SUB) this.processSub(buf.slice(i, i + SUB), role)
    this.carry = buf.slice(i)
  }

  private processSub(sub: Float32Array, role: Role): void {
    const rms = rmsOf(sub)
    this.traceLoudness(rms, role)
    const threshold = Math.max(0.01, this.noise * 3.2)
    const loud = rms > threshold

    // Noise floor: drops immediately, rises slowly
    this.noise = rms < this.noise ? rms : this.noise * 1.003 + 1e-6

    if (!this.speaking) {
      this.preroll.push(sub)
      if (this.preroll.length > PREROLL_SUBS) this.preroll.shift()
      this.run = loud ? this.run + 1 : 0
      if (this.run >= START_SUBS) {
        this.speaking = true
        this.chunks = [...this.preroll]
        this.voiced = this.preroll.slice(-START_SUBS)
        this.voicedRmsSum = START_SUBS * rms
        this.tags = { self: 0, other: 0 }
        this.tag(role)
        this.silenceMs = 0
        this.preroll = []
        this.startFns.forEach((fn) => fn())
      }
      return
    }

    this.chunks.push(sub)
    if (loud) {
      this.silenceMs = 0
      this.voiced.push(sub)
      this.voicedRmsSum += rms
      this.tag(role)
    } else {
      this.silence()
    }
    if (this.chunks.length * 20 >= MAX_UTTERANCE_MS) this.finish()
  }

  /** 100ms loudness samples for the diagnostics trace (breath-detection research) */
  private traceLoudness(rms: number, role: Role): void {
    const t = this.trace
    t.sum += rms
    t.n++
    if (role === 'self') t.self++
    else if (role === 'other') t.other++
    if (t.n < 5) return
    const tag = t.self > t.other ? 's' : t.other > t.self ? 'o' : '-'
    diag.audioTrace.push([Date.now(), Math.round((t.sum / t.n) * 10000) / 10000, tag])
    if (diag.audioTrace.length > 150) diag.audioTrace.shift()
    this.trace = { sum: 0, n: 0, self: 0, other: 0 }
  }

  private tag(role: Role): void {
    if (role === 'self') this.tags.self++
    else if (role === 'other') this.tags.other++
  }

  private silence(): void {
    this.silenceMs += 20
    if (this.silenceMs >= END_SILENCE_MS) this.finish()
  }

  private finish(): void {
    const voicedMs = this.voiced.length * 20
    const chunks = this.chunks
    const voiced = this.voiced
    const rmsMean = voiced.length ? this.voicedRmsSum / voiced.length : 0
    const tagged = this.tags.self + this.tags.other
    const selfRatio = tagged ? this.tags.self / tagged : null
    this.speaking = false
    this.chunks = []
    this.voiced = []
    this.voicedRmsSum = 0
    this.run = 0
    this.silenceMs = 0

    if (voicedMs < MIN_VOICED_MS) return

    const isWearer = selfRatio === null || selfRatio >= this.selfThreshold
    diag.recentSelfRatios.push(selfRatio === null ? -1 : Math.round(selfRatio * 100) / 100)
    if (diag.recentSelfRatios.length > 20) diag.recentSelfRatios.shift()
    // Trim trailing silence
    const keep = Math.max(1, chunks.length - Math.floor(END_SILENCE_MS / 20) + 5)
    const pcm = floatToInt16(concat(chunks.slice(0, keep)))
    const utt: Utterance = {
      pcm,
      durationMs: (pcm.length / SAMPLE_RATE) * 1000,
      voicedMs,
      rms: rmsMean,
      pitchHz: medianPitch(voiced),
      endedAt: Date.now(),
      selfRatio,
    }
    if (!isWearer) {
      diag.ignoredOtherSpeech++
      this.otherFns.forEach((fn) => fn())
      this.otherUttFns.forEach((fn) => fn(utt))
      return
    }
    diag.utterances++
    this.uttFns.forEach((fn) => fn(utt))
  }
}

function rmsOf(a: Float32Array): number {
  let s = 0
  for (let i = 0; i < a.length; i++) s += a[i] * a[i]
  return Math.sqrt(s / a.length)
}

function concat(parts: Float32Array[]): Float32Array {
  const out = new Float32Array(parts.reduce((n, p) => n + p.length, 0))
  let o = 0
  for (const p of parts) {
    out.set(p, o)
    o += p.length
  }
  return out
}

function floatToInt16(a: Float32Array): Int16Array {
  const out = new Int16Array(a.length)
  for (let i = 0; i < a.length; i++) {
    const v = Math.max(-1, Math.min(1, a[i]))
    out[i] = v < 0 ? v * 0x8000 : v * 0x7fff
  }
  return out
}

/** Median autocorrelation pitch over pairs of voiced 20ms frames (40ms windows) */
function medianPitch(voiced: Float32Array[]): number {
  const pitches: number[] = []
  for (let i = 0; i + 1 < voiced.length; i += 3) {
    const win = concat([voiced[i], voiced[i + 1]])
    const p = autocorrPitch(win)
    if (p > 0) pitches.push(p)
  }
  if (!pitches.length) return 0
  pitches.sort((a, b) => a - b)
  return pitches[Math.floor(pitches.length / 2)]
}

function autocorrPitch(x: Float32Array): number {
  const minLag = Math.floor(SAMPLE_RATE / 400)
  const maxLag = Math.floor(SAMPLE_RATE / 70)
  let energy = 0
  for (let i = 0; i < x.length; i++) energy += x[i] * x[i]
  if (energy < 1e-4) return 0
  let best = 0
  let bestLag = 0
  for (let lag = minLag; lag <= maxLag; lag++) {
    let c = 0
    for (let i = 0; i + lag < x.length; i++) c += x[i] * x[i + lag]
    const norm = c / energy
    if (norm > best) {
      best = norm
      bestLag = lag
    }
  }
  return best > 0.45 && bestLag ? SAMPLE_RATE / bestLag : 0
}

/** 16-bit mono WAV → base64 */
export function wavBase64(pcm: Int16Array, sampleRate = SAMPLE_RATE): string {
  const dataBytes = pcm.length * 2
  const buf = new ArrayBuffer(44 + dataBytes)
  const v = new DataView(buf)
  const str = (o: number, s: string) => {
    for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i))
  }
  str(0, 'RIFF')
  v.setUint32(4, 36 + dataBytes, true)
  str(8, 'WAVE')
  str(12, 'fmt ')
  v.setUint32(16, 16, true)
  v.setUint16(20, 1, true)
  v.setUint16(22, 1, true)
  v.setUint32(24, sampleRate, true)
  v.setUint32(28, sampleRate * 2, true)
  v.setUint16(32, 2, true)
  v.setUint16(34, 16, true)
  str(36, 'data')
  v.setUint32(40, dataBytes, true)
  new Int16Array(buf, 44).set(pcm)

  const bytes = new Uint8Array(buf)
  let bin = ''
  for (let i = 0; i < bytes.length; i += 0x8000) {
    bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  }
  return btoa(bin)
}
