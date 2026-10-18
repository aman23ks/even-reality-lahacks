/**
 * src/engine/imu.ts — Head tilt from the G2 IMU, for the "Look up" reset.
 *
 * The SDK doesn't document IMU units. If the vector magnitude is ~constant we treat it as an
 * accelerometer (gravity vector → angle from baseline); otherwise as Euler angles in degrees.
 */

import type { Glasses } from '../platform/glasses'

interface V {
  x: number
  y: number
  z: number
  t: number
}

export class HeadTracker {
  private samples: V[] = []
  private baseline: V | null = null

  constructor(glasses: Glasses) {
    glasses.onImu((v) => {
      this.samples.push({ ...v, t: Date.now() })
      if (this.samples.length > 200) this.samples.shift()
    })
  }

  get available(): boolean {
    const last = this.samples[this.samples.length - 1]
    return Boolean(last && Date.now() - last.t < 3000)
  }

  /** Use the average of the last second as "looking ahead" */
  setBaseline(): void {
    const recent = this.recent(1000)
    this.baseline = recent.length ? mean(recent) : null
  }

  /** Degrees away from the baseline head pose (0 if unknown) */
  tiltDeg(): number {
    const recent = this.recent(400)
    if (!this.baseline || !recent.length) return 0
    const cur = mean(recent)
    if (this.looksLikeAccelerometer()) {
      const dot = cur.x * this.baseline.x + cur.y * this.baseline.y + cur.z * this.baseline.z
      const m = norm(cur) * norm(this.baseline)
      if (!m) return 0
      return (Math.acos(Math.max(-1, Math.min(1, dot / m))) * 180) / Math.PI
    }
    return Math.max(Math.abs(cur.x - this.baseline.x), Math.abs(cur.y - this.baseline.y))
  }

  private looksLikeAccelerometer(): boolean {
    const mags = this.samples.slice(-50).map(norm)
    if (mags.length < 5) return true
    const avg = mags.reduce((a, b) => a + b, 0) / mags.length
    const dev = Math.sqrt(mags.reduce((a, b) => a + (b - avg) ** 2, 0) / mags.length)
    return avg > 0 && dev / avg < 0.25
  }

  private recent(ms: number): V[] {
    const cutoff = Date.now() - ms
    return this.samples.filter((s) => s.t >= cutoff)
  }
}

function mean(vs: V[]): V {
  const n = vs.length
  return {
    x: vs.reduce((a, v) => a + v.x, 0) / n,
    y: vs.reduce((a, v) => a + v.y, 0) / n,
    z: vs.reduce((a, v) => a + v.z, 0) / n,
    t: Date.now(),
  }
}

function norm(v: { x: number; y: number; z: number }): number {
  return Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z)
}
