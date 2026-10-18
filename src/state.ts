/**
 * src/state.ts — AuraPet State Manager
 */

import type { Pet, EmotionReading, WellnessQuest, ActiveHudScreen } from './types/pet'

export interface AppState {
  currentScreen: ActiveHudScreen
  activePet: Pet
  allPets: Pet[]
  lastReading?: EmotionReading
  isListening: boolean
  isCalibrating: boolean
  calibrationProgress: number
  voiceEnrolled: boolean
  activeQuests: WellnessQuest[]
  coachMessage: string
  backendOnline: boolean
  lastHudSync: number
}

export class StateManager {
  private state: AppState
  private listeners: Array<(state: AppState) => void> = []

  constructor(initial?: Partial<AppState>) {
    this.state = {
      currentScreen: 'pet',
      activePet: {
        id: 'pet_starter_1',
        name: 'Solispark',
        speciesId: 'solispark',
        speciesName: 'Joy Wisp',
        element: 'joy',
        stage: 'wisp',
        level: 2,
        xp: 45,
        xpToNextLevel: 100,
        happiness: 85,
        hunger: 30,
        dominantMood: 'joy',
        generation: 1,
        unlockedAt: Date.now(),
      },
      allPets: [],
      isListening: false,
      isCalibrating: false,
      calibrationProgress: 0,
      voiceEnrolled: false,
      activeQuests: [],
      coachMessage: 'Speak naturally to bond with your pet...',
      backendOnline: false,
      lastHudSync: Date.now(),
      ...initial,
    }
  }

  get(): Readonly<AppState> {
    return { ...this.state }
  }

  update(partial: Partial<AppState>): void {
    this.state = { ...this.state, ...partial }
    this.notify()
  }

  onChange(listener: (state: AppState) => void): () => void {
    this.listeners.push(listener)
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener)
    }
  }

  private notify(): void {
    const snapshot = this.get()
    for (const listener of this.listeners) {
      try {
        listener(snapshot)
      } catch (err) {
        console.error('[StateManager] Listener error:', err)
      }
    }
  }
}
