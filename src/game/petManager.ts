/**
 * src/game/petManager.ts — Pet Growth Engine, Emotion Points & The Zenith End Goal
 * 
 * Inspired by VoidPet, tuned for Even Reality G2 Smart Glasses.
 */

import type { 
  Pet, 
  EmotionType, 
  WellnessQuest, 
  BreedingPair, 
  EmotionReading, 
  EmotionPointsRecord,
  EndGoalStatus 
} from '../types/pet'

export type PetStateListener = (activePet: Pet, allPets: Pet[]) => void
export type QuestListener = (quests: WellnessQuest[]) => void
export type PointsListener = (points: EmotionPointsRecord, endGoal: EndGoalStatus) => void

export class PetManager {
  private activePet: Pet
  private inventory: Pet[] = []
  private activeQuests: WellnessQuest[] = []
  private breedingPair?: BreedingPair

  // Individual emotion point banks (EVERY emotion earns points!)
  private emotionPoints: EmotionPointsRecord = {
    joy: 35,
    calm: 40,
    anxiety: 20,
    sadness: 15,
    frustration: 10,
    curiosity: 25,
    totalVoicePoints: 145,
  }

  // Previous mood to detect positive emotional transformation
  private previousMood: EmotionType = 'calm'

  private petListeners: PetStateListener[] = []
  private questListeners: QuestListener[] = []
  private pointsListeners: PointsListener[] = []

  constructor() {
    // Initial Starter Pet starts as a Tiny Hatchling (Level 1)
    this.activePet = {
      id: 'pet_starter_1',
      name: 'Solispark',
      speciesId: 'solispark',
      speciesName: 'Joy Hatchling',
      element: 'joy',
      stage: 'hatchling', // Starts tiny!
      level: 1,
      xp: 25,
      xpToNextLevel: 60,
      happiness: 80,
      hunger: 20,
      dominantMood: 'joy',
      generation: 1,
      sizeScale: 1.0, // 1.0 = Tiny hatchling
      unlockedAt: Date.now(),
    }

    // Companion pet in sanctuary
    const calmPet: Pet = {
      id: 'pet_companion_2',
      name: 'Lumidrop',
      speciesId: 'lumidrop',
      speciesName: 'Calm Waterling',
      element: 'calm',
      stage: 'hatchling',
      level: 1,
      xp: 15,
      xpToNextLevel: 60,
      happiness: 85,
      hunger: 15,
      dominantMood: 'calm',
      generation: 1,
      sizeScale: 1.0,
      unlockedAt: Date.now(),
    }

    this.inventory = [this.activePet, calmPet]
    this.refreshQuestsForMood('joy')
  }

  getActivePet(): Pet {
    return { ...this.activePet }
  }

  getAllPets(): Pet[] {
    return [...this.inventory]
  }

  getActiveQuests(): WellnessQuest[] {
    return [...this.activeQuests]
  }

  getEmotionPoints(): EmotionPointsRecord {
    return { ...this.emotionPoints }
  }

  getBreedingPair(): BreedingPair | undefined {
    return this.breedingPair
  }

  /**
   * Defines the Core End Goal of the App:
   * Awakening the Ascended Zenith Harmony Guardian through emotional balance.
   */
  getEndGoalStatus(): EndGoalStatus {
    const p = this.emotionPoints
    // Equilibrium score: how balanced all 5 emotions are
    const minPts = Math.min(p.joy, p.calm, p.anxiety, p.sadness, p.frustration)
    const targetPerEmotion = 60
    const equilibrium = Math.min(100, Math.round((minPts / targetPerEmotion) * 100))

    const isAwakened = this.activePet.stage === 'ascended' && equilibrium >= 80

    let rank = 'Novice Seeker (Sprout)'
    if (this.activePet.level >= 10) rank = 'Zenith Ascended Guardian'
    else if (this.activePet.level >= 6) rank = 'Emotional Alchemist'
    else if (this.activePet.level >= 3) rank = 'Mindful Companion'

    return {
      title: 'Awaken the Zenith Harmony Guardian',
      description: 'Master all 5 emotional energies (Joy, Calm, Anxiety, Sadness, Anger) and evolve your pet into its giant Celestial Form.',
      equilibriumScore: equilibrium,
      masteryPointsRequired: targetPerEmotion * 5,
      totalPointsEarned: p.totalVoicePoints,
      isAwakened,
      currentAscensionRank: rank,
    }
  }

  /** 
   * Ingest vocal emotion reading:
   * 1. Awards emotion points for ANY detected emotion (positive OR negative!)
   * 2. Detects emotional transformation (e.g., Anxiety -> Calm) for bonus points
   * 3. Triggers pet XP and physical growth
   */
  applyVoiceEmotion(reading: EmotionReading): { xpGained: number; leveledUp: boolean; remedySuggested: boolean } {
    const currentMood = reading.primary
    this.activePet.dominantMood = currentMood

    // 1. Award points to this specific emotion pool (even negative emotions!)
    const pts = 3
    this.emotionPoints[currentMood] += pts
    this.emotionPoints.totalVoicePoints += pts

    let xpGained = 4
    let remedySuggested = false

    // 2. Emotional Alchemy Detection: Did the user transform a heavy emotion into a positive one?
    const wasNegative = ['anxiety', 'sadness', 'frustration'].includes(this.previousMood)
    const isNowPositive = ['joy', 'calm', 'curiosity'].includes(currentMood)

    if (wasNegative && isNowPositive) {
      // Bonus: Emotional Transformation Success!
      xpGained += 25
      this.emotionPoints.joy += 10
      this.emotionPoints.calm += 10
      this.activePet.happiness = Math.min(100, this.activePet.happiness + 15)
      console.log('[PetManager] Emotional Alchemy detected! User shifted from', this.previousMood, 'to', currentMood)
    }

    if (currentMood === 'joy' || currentMood === 'calm' || currentMood === 'curiosity') {
      this.activePet.happiness = Math.min(100, this.activePet.happiness + 2)
    } else {
      // User is experiencing a heavy emotion -> Acknowledge it, give points, and suggest remedy
      this.activePet.hunger = Math.min(100, this.activePet.hunger + 3)
      this.refreshQuestsForMood(currentMood)
      remedySuggested = true
    }

    this.previousMood = currentMood

    const leveledUp = this.addXp(xpGained)
    this.notifyPetListeners()
    this.notifyPointsListeners()

    return { xpGained, leveledUp, remedySuggested }
  }

  /** Complete a wellness micro-step to improve mood and gain pet points */
  completeQuest(questId: string): { success: boolean; pet: Pet; leveledUp: boolean } {
    const quest = this.activeQuests.find((q) => q.id === questId && !q.completed)
    if (!quest) return { success: false, pet: this.activePet, leveledUp: false }

    quest.completed = true

    // Award XP and essence
    const leveledUp = this.addXp(quest.rewardXp)
    this.emotionPoints[quest.targetEmotion] += quest.rewardEssence
    this.emotionPoints.totalVoicePoints += quest.rewardEssence

    // Boost happiness & feed hunger
    this.activePet.happiness = Math.min(100, this.activePet.happiness + 20)
    this.activePet.hunger = Math.max(0, this.activePet.hunger - 30)

    // Check breeding pair essence absorption
    if (this.breedingPair && !this.breedingPair.isReadyToHatch) {
      this.breedingPair.currentEssence += quest.rewardEssence
      if (this.breedingPair.currentEssence >= this.breedingPair.hatchCostEssence) {
        this.breedingPair.isReadyToHatch = true
      }
    }

    this.notifyPetListeners()
    this.notifyQuestListeners()
    this.notifyPointsListeners()

    return { success: true, pet: this.activePet, leveledUp }
  }

  /** Add XP and handle physical size scaling & stage evolution */
  private addXp(amount: number): boolean {
    this.activePet.xp += amount
    let leveledUp = false

    while (this.activePet.xp >= this.activePet.xpToNextLevel) {
      this.activePet.xp -= this.activePet.xpToNextLevel
      this.activePet.level += 1
      this.activePet.xpToNextLevel = Math.round(this.activePet.xpToNextLevel * 1.35)
      leveledUp = true

      // Physical size scaling & 4-stage evolution:
      // Lvl 1-2: Hatchling (Tiny, 1.0x)
      // Lvl 3-5: Wisp (Medium, 1.5x)
      // Lvl 6-9: Juvenile (Large, 2.2x)
      // Lvl 10+: Ascended Guardian (Giant, 3.0x)
      if (this.activePet.level >= 10) {
        this.activePet.stage = 'ascended'
        this.activePet.sizeScale = 3.0
      } else if (this.activePet.level >= 6) {
        this.activePet.stage = 'juvenile'
        this.activePet.sizeScale = 2.2
      } else if (this.activePet.level >= 3) {
        this.activePet.stage = 'wisp'
        this.activePet.sizeScale = 1.5
      } else {
        this.activePet.stage = 'hatchling'
        this.activePet.sizeScale = 1.0
      }
    }

    return leveledUp
  }

  /** Set up breeding between two pets */
  startBreeding(parentAId: string, parentBId: string): boolean {
    const parentA = this.inventory.find((p) => p.id === parentAId)
    const parentB = this.inventory.find((p) => p.id === parentBId)
    if (!parentA || !parentB || parentA.id === parentB.id) return false

    this.breedingPair = {
      parentA,
      parentB,
      eggSpecies: 'serenidrake',
      hatchCostEssence: 50,
      currentEssence: 0,
      isReadyToHatch: false,
    }

    return true
  }

  /** Hatch the ready egg into a new hybrid pet */
  hatchEgg(customName?: string): Pet | null {
    if (!this.breedingPair || !this.breedingPair.isReadyToHatch) return null

    const newPet: Pet = {
      id: `pet_hybrid_${Date.now()}`,
      name: customName || 'Serenidrake',
      speciesId: this.breedingPair.eggSpecies,
      speciesName: 'Celestial Dragon',
      element: 'calm',
      stage: 'hatchling',
      level: 1,
      xp: 0,
      xpToNextLevel: 100,
      happiness: 100,
      hunger: 0,
      dominantMood: 'calm',
      generation: Math.max(this.breedingPair.parentA.generation, this.breedingPair.parentB.generation) + 1,
      sizeScale: 1.0,
      parents: [this.breedingPair.parentA.name, this.breedingPair.parentB.name],
      unlockedAt: Date.now(),
    }

    this.inventory.push(newPet)
    this.activePet = newPet
    this.breedingPair = undefined

    this.notifyPetListeners()
    return newPet
  }

  selectPet(petId: string): boolean {
    const pet = this.inventory.find((p) => p.id === petId)
    if (pet) {
      this.activePet = pet
      this.notifyPetListeners()
      return true
    }
    return false
  }

  /** Micro-remedy quests tailored to transform negative states into positive growth */
  refreshQuestsForMood(mood: EmotionType): void {
    const remedies: Record<EmotionType, Omit<WellnessQuest, 'id' | 'completed'>[]> = {
      anxiety: [
        {
          title: '🌬️ 4-7-8 Breath Remedy',
          microStep: 'Inhale 4s, hold 7s, exhale 8s. Release stomach tension.',
          remedyFor: 'anxiety',
          targetEmotion: 'calm',
          rewardXp: 50,
          rewardEssence: 25,
          durationSec: 19,
        },
        {
          title: '🧘 Grounding 5-4-3-2-1',
          microStep: 'Notice 3 things in your vision through your glasses.',
          remedyFor: 'anxiety',
          targetEmotion: 'calm',
          rewardXp: 35,
          rewardEssence: 15,
        },
      ],
      frustration: [
        {
          title: '💧 Cool Sip Reset',
          microStep: 'Sip cool water, drop shoulders 2 inches, unclamp jaw.',
          remedyFor: 'frustration',
          targetEmotion: 'calm',
          rewardXp: 45,
          rewardEssence: 20,
        },
        {
          title: '🌱 Power Reframe',
          microStep: 'Speak aloud: "I have the patience and power to solve this."',
          remedyFor: 'frustration',
          targetEmotion: 'curiosity',
          rewardXp: 55,
          rewardEssence: 30,
        },
      ],
      sadness: [
        {
          title: '☀️ Gratitude Spark',
          microStep: 'Say aloud 1 small thing that made you smile today.',
          remedyFor: 'sadness',
          targetEmotion: 'joy',
          rewardXp: 50,
          rewardEssence: 25,
        },
        {
          title: '👀 Horizon Gaze',
          microStep: 'Gaze into the distance for 20 seconds. Let eyes soften.',
          remedyFor: 'sadness',
          targetEmotion: 'calm',
          rewardXp: 40,
          rewardEssence: 20,
        },
      ],
      joy: [
        {
          title: '✨ Vibe Multiplication',
          microStep: 'Give someone a high-five or share an encouraging word.',
          remedyFor: 'joy',
          targetEmotion: 'joy',
          rewardXp: 60,
          rewardEssence: 35,
        },
        {
          title: '🔥 Essence Synthesis',
          microStep: 'Take a joyful deep breath and anchor this high vibration.',
          remedyFor: 'joy',
          targetEmotion: 'calm',
          rewardXp: 45,
          rewardEssence: 20,
        },
      ],
      calm: [
        {
          title: '☯ Deep Flow State',
          microStep: 'Keep breathing smoothly. Let your companion absorb peace.',
          remedyFor: 'calm',
          targetEmotion: 'calm',
          rewardXp: 40,
          rewardEssence: 20,
        },
      ],
      curiosity: [
        {
          title: '🚀 Wonder Exploration',
          microStep: 'Ask one creative question about what you are learning.',
          remedyFor: 'curiosity',
          targetEmotion: 'curiosity',
          rewardXp: 45,
          rewardEssence: 25,
        },
      ],
    }

    const pool = remedies[mood] || remedies.calm
    this.activeQuests = pool.map((q, idx) => ({
      ...q,
      id: `quest_${mood}_${idx}_${Date.now()}`,
      completed: false,
    }))

    this.notifyQuestListeners()
  }

  onPetChange(fn: PetStateListener): () => void {
    this.petListeners.push(fn)
    return () => {
      this.petListeners = this.petListeners.filter((l) => l !== fn)
    }
  }

  onQuestChange(fn: QuestListener): () => void {
    this.questListeners.push(fn)
    return () => {
      this.questListeners = this.questListeners.filter((l) => l !== fn)
    }
  }

  onPointsChange(fn: PointsListener): () => void {
    this.pointsListeners.push(fn)
    return () => {
      this.pointsListeners = this.pointsListeners.filter((l) => l !== fn)
    }
  }

  private notifyPetListeners(): void {
    this.petListeners.forEach((fn) => {
      try {
        fn(this.activePet, this.inventory)
      } catch (e) {
        console.error('[PetManager] Listener error:', e)
      }
    })
  }

  private notifyQuestListeners(): void {
    this.questListeners.forEach((fn) => {
      try {
        fn(this.activeQuests)
      } catch (e) {
        console.error('[PetManager] Quest listener error:', e)
      }
    })
  }

  private notifyPointsListeners(): void {
    const endGoal = this.getEndGoalStatus()
    this.pointsListeners.forEach((fn) => {
      try {
        fn(this.emotionPoints, endGoal)
      } catch (e) {
        console.error('[PetManager] Points listener error:', e)
      }
    })
  }
}
