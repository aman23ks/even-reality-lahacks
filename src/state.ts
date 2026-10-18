/**
 * src/state.ts — AuraPet State Manager
 */

import type { Pet, EmotionReading, WellnessQuest, ActiveHudScreen, EmotionPointsRecord, EndGoalStatus } from './types/pet'

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
  emotionPoints: EmotionPointsRecord
  endGoal: EndGoalStatus
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
        speciesName: 'Joy Hatchling',
        element: 'joy',
        stage: 'hatchling',
        level: 1,
        xp: 25,
        xpToNextLevel: 60,
        happiness: 80,
        hunger: 20,
        dominantMood: 'joy',
        generation: 1,
        sizeScale: 1.0,
        unlockedAt: Date.now(),
      },
      allPets: [],
      isListening: false,
      isCalibrating: false,
      calibrationProgress: 0,
      voiceEnrolled: false,
      activeQuests: [],
      emotionPoints: {
        joy: 35,
        calm: 40,
        anxiety: 20,
        sadness: 15,
        frustration: 10,
        curiosity: 25,
        totalVoicePoints: 145,
      },
      endGoal: {
        title: 'Awaken the Zenith Harmony Guardian',
        description: 'Master all 5 emotional energies and evolve your pet into its giant Celestial Form.',
        equilibriumScore: 25,
        masteryPointsRequired: 300,
        totalPointsEarned: 145,
        isAwakened: false,
        currentAscensionRank: 'Novice Seeker (Sprout)',
      },
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
