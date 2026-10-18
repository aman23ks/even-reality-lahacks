/**
 * src/types.ts — Shared types for AuraPet
 */

/** Per-utterance classification from the backend */
export type MoodLabel = 'storm' | 'fog' | 'clear'

/** What the pet's sky shows (derived from the rolling mood scores) */
export type Weather = 'clear' | 'cloudy' | 'stormy' | 'foggy'

export interface Classification {
  label: MoodLabel
  intensity: number // 0..1
  emotion: string // short free-form label, e.g. "overwhelmed"
  crisis: boolean
}

export interface Verification {
  passed: boolean
  reason: string
}

export type KindAct = 'thanks' | 'compliment' | 'encourage' | 'care' | 'none'

export interface Social {
  harsh: boolean
  repair: boolean
  kind: KindAct
  topic: string
}

export interface UtteranceResult {
  transcript: string
  words: number
  classification: Classification
  verification?: Verification
  social?: Social
  source: 'llm' | 'heuristic'
}

export type ResetId = 'name_it' | 'in_control' | 'good_thing' | 'look_up' | 'breathe'

export type StageId = 'egg' | 'sprout' | 'wisp' | 'guardian' | 'zenith'

export interface PetState {
  name: string
  hatched: boolean
  recoveries: number
  sunlight: number // grows with clear/joyful moments; changes looks, not stage
  createdAt: number
}

export interface MoodPoint {
  t: number
  stress: number
  low: number
  label: MoodLabel
}

export interface RecoveryRecord {
  spikeAt: number
  recoveredAt: number
  resetId: ResetId | 'repair' | 'self'
  bounceBackMs: number
}

export interface ResetStat {
  offered: number
  completed: number
  recovered: number
}

export interface PersistedData {
  version: 1
  onboarded: boolean
  demoMode: boolean
  /** guided 2-minute demo for judges: 3 recoveries to Zenith, on-lens prompts */
  judgeMode: boolean
  /** opt-in: lens goes fully blank when nothing is happening (default shows the tiny pet) */
  blankLens: boolean
  pet: PetState
  timeline: MoodPoint[]
  recoveries: RecoveryRecord[]
  resetStats: Record<ResetId, ResetStat>
  baseline: { wps: number[]; rms: number[]; pitch: number[]; selfRatio: number[] }
  /** what storms were about (topic tags only, never words), for the forecast */
  storms: Array<{ t: number; topic: string }>
  /** kind things you said to people */
  kindness: Array<{ t: number; kind: KindAct }>
  /** last day the timed forecast was shown (YYYY-MM-DD) */
  forecastDay: string
  /** badge id → unlock time */
  badges: Record<string, number>
  /** fastest bounce-back so far (ms), 0 = none yet */
  pbMs: number
  /** times you calmed down before any reset */
  selfRecoveries: number
}

export type InputType = 'tap' | 'double_tap' | 'swipe_forward' | 'swipe_backward' | 'long_press'

export type AudioSourceKind = 'glasses' | 'phone-bridge' | 'phone-web' | 'none'
