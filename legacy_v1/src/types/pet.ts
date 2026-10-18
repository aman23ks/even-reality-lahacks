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
  speakerId?: string
  speakerLabel?: string
  diarizationConfidence?: number
}

export interface SpeechTranscriptionRecord {
  id: string
  text: string
  timestamp: number
  primaryEmotion: EmotionType
  confidence: number
  emotionScores: Record<EmotionType, number>
  pitchHz: number
  isWearerVoice: boolean
  wearerConfidence: number
  speakerId: string
  speakerLabel: string
  diarizationConfidence: number
}

// 4 distinct physical growth stages from small to giant
export type PetStage = 'hatchling' | 'wisp' | 'juvenile' | 'ascended'

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
  hunger: number // 0 to 100
  dominantMood: EmotionType
  generation: number
  sizeScale: number // 1.0 (small) to 3.0 (giant ascended)
  parents?: [string, string]
  unlockedAt: number
}

export interface EmotionPointsRecord {
  joy: number
  calm: number
  anxiety: number
  sadness: number
  frustration: number
  curiosity: number
  totalVoicePoints: number
}

export interface WellnessQuest {
  id: string
  title: string
  microStep: string
  remedyFor: EmotionType
  targetEmotion: EmotionType
  rewardXp: number
  rewardEssence: number
  completed: boolean
  durationSec?: number
  category?: 'anxiety_remedy' | 'burnout_shield' | 'joy_anchor' | 'mindful_reset' | 'grit_power'
  categoryLabel?: string
  icon?: string
  triggerReason?: string
  steps?: string[]
  isDynamic?: boolean
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
  spectralRolloff?: number
  nearFieldRmsThreshold?: number
  diarizationMode?: 'strict' | 'adaptive' | 'permissive'
  enrolledPhrase?: string
  minPitchHz?: number
  maxPitchHz?: number
  sampleCount: number
}

export interface EndGoalStatus {
  title: string
  description: string
  equilibriumScore: number // 0 to 100%
  masteryPointsRequired: number
  totalPointsEarned: number
  isAwakened: boolean
  currentAscensionRank: string
}

export type ActiveHudScreen = 'pet' | 'quest' | 'breeding' | 'calibrate' | 'endgoal'
