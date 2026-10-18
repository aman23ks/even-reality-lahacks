/**
 * src/audio/voiceprint.ts — A lightweight voice fingerprint (16 kHz mono).
 *
 * Per utterance we measure the "shape" of a voice, independent of loudness:
 *   - a 24-band log-spectrum profile (100 Hz – 5 kHz, mel-like spacing), each frame mean-normalised
 *   - spectral centroid (brightness)
 *   - median pitch and pitch spread
 * The voice check averages three sentences into a Voiceprint. Each later sentence gets a 0..1 match
 * score. Only these numbers are stored, never audio. It's a practical speaker check for one wearer vs.
 * people nearby, not biometric-grade identification.
 */

const N = 512 // FFT size (20 ms frames zero-padded)
const SR = 16000
const BANDS = 24
const F_LO = 100
const F_HI = 5000

export interface VoiceFeatures {
  bands: number[] // BANDS values, mean-removed log energy
  centroid: number // Hz
  pitch: number // Hz, 0 = unknown
  pitchSpread: number // Hz (IQR)
  frames: number
}

export interface Voiceprint {
  bands: number[]
  centroid: number
  pitch: number
  pitchSpread: number
  /** match score below this = probably not the wearer (set from the voice check itself) */
  threshold: number
  samples: number
  createdAt: number
}

// ── FFT (radix-2, in place) ─────────────────────────────────────

const HANN = new Float32Array(320).map((_, i) => 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / 319))

function fftMag(frame: Float32Array): Float32Array {
  const re = new Float32Array(N)
  const im = new Float32Array(N)
  const n = Math.min(frame.length, HANN.length)
  for (let i = 0; i < n; i++) re[i] = frame[i] * HANN[i]
  // bit reversal
  for (let i = 1, j = 0; i < N; i++) {
    let bit = N >> 1
    for (; j & bit; bit >>= 1) j ^= bit
    j ^= bit
    if (i < j) {
      ;[re[i], re[j]] = [re[j], re[i]]
      ;[im[i], im[j]] = [im[j], im[i]]
    }
  }
  for (let len = 2; len <= N; len <<= 1) {
    const ang = (-2 * Math.PI) / len
    const wr = Math.cos(ang)
    const wi = Math.sin(ang)
    for (let i = 0; i < N; i += len) {
      let cr = 1
      let ci = 0
      for (let k = 0; k < len / 2; k++) {
        const a = i + k
        const b = a + len / 2
        const tr = re[b] * cr - im[b] * ci
        const ti = re[b] * ci + im[b] * cr
        re[b] = re[a] - tr
        im[b] = im[a] - ti
        re[a] += tr
        im[a] += ti
        const ncr = cr * wr - ci * wi
        ci = cr * wi + ci * wr
        cr = ncr
      }
    }
  }
  const mag = new Float32Array(N / 2)
  for (let k = 0; k < N / 2; k++) mag[k] = re[k] * re[k] + im[k] * im[k]
  return mag
}

// Mel-spaced band edges as FFT bin indices
const toMel = (f: number) => 2595 * Math.log10(1 + f / 700)
const fromMel = (m: number) => 700 * (10 ** (m / 2595) - 1)
const EDGES: number[] = (() => {
  const lo = toMel(F_LO)
  const hi = toMel(F_HI)
  const out: number[] = []
  for (let b = 0; b <= BANDS; b++) out.push(Math.round((fromMel(lo + ((hi - lo) * b) / BANDS) / SR) * N))
  return out
})()

/** Features from the voiced 20 ms frames of one utterance (+ the pitch values already measured) */
export function voiceFeatures(voiced: Float32Array[], pitches: number[]): VoiceFeatures | null {
  if (voiced.length < 8) return null
  // Spread the work: at most ~150 frames per utterance
  const step = Math.max(1, Math.floor(voiced.length / 150))
  const acc = new Array(BANDS).fill(0)
  let centroidSum = 0
  let used = 0
  for (let f = 0; f < voiced.length; f += step) {
    const mag = fftMag(voiced[f])
    const logs: number[] = []
    for (let b = 0; b < BANDS; b++) {
      let e = 1e-10
      for (let k = EDGES[b]; k < Math.max(EDGES[b] + 1, EDGES[b + 1]); k++) e += mag[k]
      logs.push(Math.log(e))
    }
    const mean = logs.reduce((x, y) => x + y, 0) / BANDS
    for (let b = 0; b < BANDS; b++) acc[b] += logs[b] - mean // loudness-independent shape
    let num = 0
    let den = 1e-10
    for (let k = EDGES[0]; k < EDGES[BANDS]; k++) {
      num += k * mag[k]
      den += mag[k]
    }
    centroidSum += ((num / den) * SR) / N
    used++
  }
  const ps = pitches.filter((p) => p > 0).sort((a, b) => a - b)
  const q = (x: number) => ps[Math.min(ps.length - 1, Math.floor(ps.length * x))] ?? 0
  return {
    bands: acc.map((v) => v / used),
    centroid: centroidSum / used,
    pitch: ps.length ? q(0.5) : 0,
    pitchSpread: ps.length > 3 ? q(0.75) - q(0.25) : 0,
    frames: used,
  }
}

function cosine(a: number[], b: number[]): number {
  let ab = 0
  let aa = 0
  let bb = 0
  for (let i = 0; i < a.length; i++) {
    ab += a[i] * b[i]
    aa += a[i] * a[i]
    bb += b[i] * b[i]
  }
  return aa && bb ? ab / Math.sqrt(aa * bb) : 0
}

/** 0..1: how much this utterance sounds like the voiceprint */
export function matchScore(vp: Pick<Voiceprint, 'bands' | 'centroid' | 'pitch' | 'pitchSpread'>, f: VoiceFeatures): number {
  // Spectral shape: cosine of mean-removed profiles, mapped from [0.88, 1] → [0, 1]
  const shape = Math.max(0, Math.min(1, (cosine(vp.bands, f.bands) - 0.88) / 0.12))
  // Pitch: Gaussian closeness, with some room for emotional swings
  const tol = Math.max(18, vp.pitchSpread * 1.2, vp.pitch * 0.1)
  const pitch = vp.pitch && f.pitch ? Math.exp(-(((f.pitch - vp.pitch) / tol) ** 2)) : 0.5
  // Brightness
  const bright = Math.exp(-(((f.centroid - vp.centroid) / Math.max(250, vp.centroid * 0.25)) ** 2))
  return 0.55 * shape + 0.3 * pitch + 0.15 * bright
}

/** Average the voice-check samples into a voiceprint, with a threshold learned from them */
export function buildVoiceprint(samples: VoiceFeatures[]): Voiceprint | null {
  const ok = samples.filter((s) => s.frames >= 8)
  if (!ok.length) return null
  const avg = (sel: (s: VoiceFeatures) => number) => ok.reduce((x, s) => x + sel(s), 0) / ok.length
  const bands = new Array(BANDS).fill(0).map((_, b) => avg((s) => s.bands[b]))
  const pitches = ok.map((s) => s.pitch).filter((p) => p > 0).sort((a, b) => a - b)
  const base = {
    bands,
    centroid: avg((s) => s.centroid),
    pitch: pitches.length ? pitches[Math.floor(pitches.length / 2)] : 0,
    pitchSpread: Math.max(avg((s) => s.pitchSpread), pitches.length > 1 ? pitches[pitches.length - 1] - pitches[0] : 0),
  }
  // Leave-one-out: how well do your own sentences match a print built from the others?
  const selfScores = ok.length >= 2
    ? ok.map((s, i) => {
        const rest = ok.filter((_, j) => j !== i)
        const ravg = (sel: (x: VoiceFeatures) => number) => rest.reduce((x, r) => x + sel(r), 0) / rest.length
        return matchScore(
          { bands: bands.map((_, b) => ravg((r) => r.bands[b])), centroid: ravg((r) => r.centroid), pitch: ravg((r) => r.pitch), pitchSpread: base.pitchSpread },
          s,
        )
      })
    : [0.8]
  const minSelf = Math.min(...selfScores)
  return {
    ...base,
    threshold: Math.max(0.35, Math.min(0.8, minSelf - 0.15)),
    samples: ok.length,
    createdAt: Date.now(),
  }
}
