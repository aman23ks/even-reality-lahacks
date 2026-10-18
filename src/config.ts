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
  triggerScore: number // rolling stress/low score needed to nudge
  triggerMinUtterances: number // ...plus this many negative utterances in the trigger window
  /** judge mode: any single clearly negative sentence nudges, regardless of the rolling score */
  instantTrigger?: boolean
  /** override MOOD.negativeIntensity (judge mode counts mild annoyance too) */
  negativeIntensity?: number
  /** silence (from everyone) that marks the end of a conversation */
  convoGapMs: number
  /** tense sentences from the wearer during a conversation that earn a debrief */
  debriefMinTense: number
}

export const NORMAL_TIMINGS: Timings = {
  moodWindowMs: 120_000,
  triggerWindowMs: 90_000,
  cooldownMs: 10 * 60_000,
  nudgeVisibleMs: 60_000,
  recoveryWatchMs: 10 * 60_000,
  paceCooldownMs: 45_000,
  triggerScore: 0.58,
  triggerMinUtterances: 2,
  convoGapMs: 20_000,
  debriefMinTense: 2,
}

export const DEMO_TIMINGS: Timings = {
  moodWindowMs: 60_000,
  triggerWindowMs: 90_000,
  cooldownMs: 30_000,
  nudgeVisibleMs: 60_000,
  recoveryWatchMs: 180_000,
  paceCooldownMs: 20_000,
  triggerScore: 0.58,
  triggerMinUtterances: 2,
  convoGapMs: 10_000,
  debriefMinTense: 1,
}

/** Judge mode: a stranger wearing G2 for ~2 minutes should reach Zenith in three quick rounds */
export const JUDGE_TIMINGS: Timings = {
  moodWindowMs: 30_000,
  triggerWindowMs: 60_000,
  cooldownMs: 4_000,
  nudgeVisibleMs: 60_000,
  recoveryWatchMs: 90_000,
  paceCooldownMs: 60_000,
  triggerScore: 0.3,
  triggerMinUtterances: 1,
  instantTrigger: true,
  negativeIntensity: 0.3,
  convoGapMs: 6_000,
  debriefMinTense: 1,
}

export const MOOD = {
  negativeIntensity: 0.45, // an utterance counts as negative above this intensity
  recoveredBelow: 0.4, // both scores below this = recovered
  priorWeight: 0.6, // virtual neutral weight so a single outburst can't trigger alone
}

export type StageDef = { id: StageId; at: number; label: string }

export const JUDGE_STAGES: StageDef[] = [
  { id: 'sprout', at: 0, label: 'Sprout' },
  { id: 'wisp', at: 1, label: 'Wisp' },
  { id: 'guardian', at: 2, label: 'Guardian' },
  { id: 'zenith', at: 3, label: 'Zenith' },
]

export const STAGES: StageDef[] = [
  { id: 'sprout', at: 0, label: 'Sprout' },
  { id: 'wisp', at: 3, label: 'Wisp' },
  { id: 'guardian', at: 8, label: 'Guardian' },
  { id: 'zenith', at: 15, label: 'Zenith' },
]

