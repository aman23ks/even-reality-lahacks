/**
 * src/types/pet.ts — Core Types for AuraPet (VoidPet for Even Reality G2)
 */

export type EmotionType = 
  | 'joy' 
  | 'calm' 
  | 'anxiety' 
  | 'sadness' 
  | 'frustration' 
  | 'curiosity'

export interface EmotionReading {
  primary: EmotionType
  confidence: number // 0 to 1
  scores: Record<EmotionType, number>
  pitchHz: number
  energyRms: number
  tempoBpm: number
  timestamp: number
  isUserVoice: boolean
  userVoiceConfidence: number
}

export type PetStage = 'egg' | 'wisp' | 'juvenile' | 'ascended'

export interface PetSpecies {
  id: string
  name: string
  element: EmotionType
  description: string
  baseArt: Record<PetStage, string>
}

export interface Pet {
  id: string
  name: string
  speciesId: string
  speciesName: string
  element: EmotionType
  stage: PetStage
  level: number
  xp: number
  xpToNextLevel: number
  happiness: number // 0 to 100
  hunger: number // 0 to 100 (needs wellness actions)
  dominantMood: EmotionType
  generation: number
  parents?: [string, string]
  unlockedAt: number
}

export interface WellnessQuest {
  id: string
  title: string
  microStep: string
  targetEmotion: EmotionType
  rewardXp: number
  rewardEssence: number
  completed: boolean
  durationSec?: number
}

export interface BreedingPair {
  parentA: Pet
  parentB: Pet
  eggSpecies: string
  hatchCostEssence: number
  currentEssence: number
  isReadyToHatch: boolean
}

export interface VoiceFingerprint {
  isEnrolled: boolean
  enrolledAt?: number
  medianPitchHz: number
  pitchVariance: number
  spectralCentroid: number
  sampleCount: number
}

export type ActiveHudScreen = 'pet' | 'quest' | 'breeding' | 'calibrate'
