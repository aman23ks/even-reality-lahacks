/**
 * src/engine/mood.ts — Rolling mood from utterance classifications.
 *
 * stress = recency-weighted average of storm intensity, low = same for fog. A virtual neutral prior
 * keeps a single outburst from triggering a nudge; silence lets scores decay back toward clear.
 */

import { MOOD, type Timings } from '../config'
import type { Classification, MoodLabel, Weather } from '../types'

interface Sample {
  t: number
  label: MoodLabel
  intensity: number
}

export interface MoodSnapshot {
  stress: number
  low: number
  weather: Weather
}

export class MoodEngine {
  private samples: Sample[] = []

  constructor(private timings: () => Timings) {}

  add(c: Classification, t = Date.now()): void {
    this.samples.push({ t, label: c.label, intensity: clamp01(c.intensity) })
    this.prune(t)
  }

  snapshot(now = Date.now()): MoodSnapshot {
    this.prune(now)
    const tau = this.timings().moodWindowMs / 2
    let w = MOOD.priorWeight
    let s = 0
    let l = 0
    for (const x of this.samples) {
      const wi = Math.exp(-(now - x.t) / tau)
      w += wi
      if (x.label === 'storm') s += wi * x.intensity
      if (x.label === 'fog') l += wi * x.intensity
    }
    const stress = s / w
    const low = l / w
    return { stress, low, weather: weatherFor(stress, low) }
  }

  /** Sustained negativity: enough negative utterances recently AND a high rolling score */
  spike(now = Date.now()): { kind: 'storm' | 'fog'; since: number } | null {
    const snap = this.snapshot(now)
    const recent = this.samples.filter(
      (x) => now - x.t <= this.timings().triggerWindowMs && x.label !== 'clear' && x.intensity >= (this.timings().negativeIntensity ?? MOOD.negativeIntensity),
    )
    if (recent.length < this.timings().triggerMinUtterances) return null
    if (this.timings().instantTrigger) {
      const last = recent[recent.length - 1]
      return { kind: last.label === 'fog' ? 'fog' : 'storm', since: last.t }
    }
    const kind = snap.stress >= snap.low ? 'storm' : 'fog'
    const score = kind === 'storm' ? snap.stress : snap.low
    if (score < this.timings().triggerScore) return null
    return { kind, since: recent[0].t }
  }

  isRecovered(now = Date.now()): boolean {
    const s = this.snapshot(now)
    return s.stress < MOOD.recoveredBelow && s.low < MOOD.recoveredBelow
  }

  private prune(now: number): void {
    const cutoff = now - this.timings().moodWindowMs * 2
    while (this.samples.length && this.samples[0].t < cutoff) this.samples.shift()
  }
}

export function weatherFor(stress: number, low: number): Weather {
  if (stress >= 0.5 && stress >= low) return 'stormy'
  if (low >= 0.45) return 'foggy'
  if (stress >= 0.28 || low >= 0.28) return 'cloudy'
  return 'clear'
}

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, Number.isFinite(n) ? n : 0))
}
