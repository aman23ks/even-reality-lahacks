/**
 * src/engine/resets.ts — The reset catalog and the "learns what calms you" picker.
 *
 * Every reset is verified by hardware: the wearer's voice (transcript checked by the backend),
 * head movement (IMU), or quiet breathing (no wearer speech for the whole pacer).
 */

import type { ResetId, ResetStat } from '../types'

export type VerifyKind = 'voice' | 'imu' | 'breath'

export interface ResetDef {
  id: ResetId
  title: string
  /** Lens prompt; keep lines short for the 576px display */
  prompt: string
  fits: Array<'storm' | 'fog'>
  verify: VerifyKind
  timeoutMs: number
}

export const BREATH = { inMs: 4000, outMs: 6000, cycles: 3 }
export const LOOK_UP = { holdMs: 15000, tiltDeg: 10 }

export const RESETS: Record<ResetId, ResetDef> = {
  name_it: {
    id: 'name_it',
    title: 'Name it',
    prompt: "Say what you're feeling,\nin one sentence.",
    fits: ['storm', 'fog'],
    verify: 'voice',
    timeoutMs: 60_000,
  },
  in_control: {
    id: 'in_control',
    title: 'In your control',
    prompt: 'Say one thing you can\ndo next.',
    fits: ['storm'],
    verify: 'voice',
    timeoutMs: 60_000,
  },
  good_thing: {
    id: 'good_thing',
    title: 'One good thing',
    prompt: 'Say one thing that went\nokay today. Small counts.',
    fits: ['fog'],
    verify: 'voice',
    timeoutMs: 60_000,
  },
  look_up: {
    id: 'look_up',
    title: 'Look up',
    prompt: 'Lift your gaze to the\nhorizon and hold it.',
    fits: ['fog', 'storm'],
    verify: 'imu',
    timeoutMs: 60_000,
  },
  breathe: {
    id: 'breathe',
    title: 'Breathe together',
    prompt: 'Breathe with {name}.\nIn as it grows, out as it shrinks.',
    fits: ['storm'],
    verify: 'breath',
    timeoutMs: 90_000,
  },
}

export function emptyStats(): Record<ResetId, ResetStat> {
  const out = {} as Record<ResetId, ResetStat>
  for (const id of Object.keys(RESETS) as ResetId[]) out[id] = { offered: 0, completed: 0, recovered: 0 }
  return out
}

/** Success rate with a uniform prior: untried resets start at 50% */
export function successRate(s: ResetStat): number {
  return (s.recovered + 1) / (s.offered + 2)
}

/**
 * Pick the reset most likely to work for this person, with a little randomness so newer
 * resets still get tried. `exclude` lets the wearer swipe to a different one.
 */
export function pickReset(
  kind: 'storm' | 'fog',
  stats: Record<ResetId, ResetStat>,
  opts: { imuAvailable: boolean; exclude?: ResetId[] },
): ResetId {
  const candidates = (Object.values(RESETS) as ResetDef[]).filter(
    (r) =>
      r.fits.includes(kind) &&
      !(opts.exclude ?? []).includes(r.id) &&
      (r.verify !== 'imu' || opts.imuAvailable),
  )
  const pool = candidates.length ? candidates : [RESETS.name_it]
  let best = pool[0]
  let bestScore = -1
  for (const r of pool) {
    const score = successRate(stats[r.id]) + Math.random() * 0.12
    if (score > bestScore) {
      bestScore = score
      best = r
    }
  }
  return best.id
}
