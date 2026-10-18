/**
 * src/engine/store.ts — Persisted user data (no audio, no transcripts — only mood scores and counts).
 */

import type { Storage } from '../platform/glasses'
import type { PersistedData, StageId } from '../types'
import { JUDGE_STAGES, STAGES, type StageDef } from '../config'
import { emptyStats } from './resets'

const KEY = 'aurapet_v2'
const TIMELINE_KEEP_MS = 3 * 24 * 3600_000

export function freshData(): PersistedData {
  return {
    version: 1,
    onboarded: false,
    demoMode: false,
    // Builds packaged for judging start in judge mode on a fresh install
    judgeMode: import.meta.env.VITE_JUDGE_DEFAULT === '1',
    blankLens: false,
    pet: { name: 'Mochi', hatched: false, recoveries: 0, sunlight: 0, createdAt: Date.now() },
    timeline: [],
    recoveries: [],
    resetStats: emptyStats(),
    baseline: { wps: [], rms: [], pitch: [], selfRatio: [] },
    storms: [],
    kindness: [],
    forecastDay: '',
    badges: {},
    pbMs: 0,
    selfRecoveries: 0,
  }
}

export class Store {
  data: PersistedData = freshData()
  private saveTimer?: ReturnType<typeof setTimeout>

  constructor(private storage: Storage) {}

  async load(): Promise<void> {
    const raw = await this.storage.get(KEY)
    if (!raw) return
    try {
      const parsed = JSON.parse(raw) as PersistedData
      const base = freshData()
      this.data = {
        ...base,
        ...parsed,
        pet: { ...base.pet, ...parsed.pet },
        resetStats: { ...base.resetStats, ...parsed.resetStats },
        baseline: { ...base.baseline, ...parsed.baseline },
      }
    } catch {
      // corrupt → start fresh
    }
    useJudgeStages(this.data.judgeMode)
  }

  /** Debounced save */
  save(): void {
    clearTimeout(this.saveTimer)
    this.saveTimer = setTimeout(() => void this.flush(), 800)
  }

  async flush(): Promise<void> {
    clearTimeout(this.saveTimer)
    const cutoff = Date.now() - TIMELINE_KEEP_MS
    this.data.timeline = this.data.timeline.filter((p) => p.t >= cutoff)
    await this.storage.set(KEY, JSON.stringify(this.data))
  }

  async reset(): Promise<void> {
    this.data = freshData()
    useJudgeStages(this.data.judgeMode)
    await this.flush()
  }
}

let stages: StageDef[] = STAGES

/** Judge mode swaps in the short evolution ladder (1 / 2 / 3 recoveries) */
export function useJudgeStages(on: boolean): void {
  stages = on ? JUDGE_STAGES : STAGES
}

export function currentStages(): StageDef[] {
  return stages
}

export function stageFor(recoveries: number, hatched: boolean): StageId {
  if (!hatched) return 'egg'
  let stage: StageId = 'sprout'
  for (const s of stages) if (recoveries >= s.at) stage = s.id
  return stage
}

export function nextStage(recoveries: number): { label: string; at: number } | null {
  const next = stages.find((s) => s.at > recoveries)
  return next ? { label: next.label, at: next.at } : null
}

export function stageLabel(id: StageId): string {
  return id === 'egg' ? 'Egg' : stages.find((s) => s.id === id)?.label ?? id
}

/** Running median helper for per-user baselines */
export function median(values: number[], fallback: number): number {
  if (!values.length) return fallback
  const s = [...values].sort((a, b) => a - b)
  return s[Math.floor(s.length / 2)]
}
