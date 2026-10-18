/**
 * src/config.ts — Tunables. Demo mode shortens timers so a full loop fits in a 3-minute pitch.
 */

import type { StageId } from './types'

export interface Timings {
  moodWindowMs: number // how far back the rolling mood looks
  triggerWindowMs: number // negative utterances must fall inside this window to trigger a nudge
  cooldownMs: number // min gap between resets
  nudgeVisibleMs: number // nudge auto-hides after this (still available from the pet card)
  recoveryWatchMs: number // after a reset, how long we wait to see the mood actually clear
  paceCooldownMs: number // min gap between "slow down" whispers
}

export const NORMAL_TIMINGS: Timings = {
  moodWindowMs: 120_000,
  triggerWindowMs: 90_000,
  cooldownMs: 10 * 60_000,
  nudgeVisibleMs: 60_000,
  recoveryWatchMs: 10 * 60_000,
  paceCooldownMs: 45_000,
}

export const DEMO_TIMINGS: Timings = {
  moodWindowMs: 60_000,
  triggerWindowMs: 90_000,
  cooldownMs: 30_000,
  nudgeVisibleMs: 60_000,
  recoveryWatchMs: 180_000,
  paceCooldownMs: 20_000,
}

export const MOOD = {
  triggerScore: 0.58, // rolling stress/low score needed to nudge
  triggerMinUtterances: 2, // ...plus this many negative utterances in the trigger window
  negativeIntensity: 0.45, // an utterance counts as negative above this intensity
  recoveredBelow: 0.4, // both scores below this = recovered
  priorWeight: 0.6, // virtual neutral weight so a single outburst can't trigger alone
}

export const STAGES: Array<{ id: StageId; at: number; label: string }> = [
  { id: 'sprout', at: 0, label: 'Sprout' },
  { id: 'wisp', at: 3, label: 'Wisp' },
  { id: 'guardian', at: 8, label: 'Guardian' },
  { id: 'zenith', at: 15, label: 'Zenith' },
]

