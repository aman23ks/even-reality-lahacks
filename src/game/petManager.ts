/**
 * src/game/petManager.ts — Gamified Pet System, Breeding Lab, and Wellness Quests
 * 
 * Inspired by VoidPet, tuned for Even Reality G2 Smart Glasses.
 */

import type { Pet, EmotionType, WellnessQuest, BreedingPair, EmotionReading } from '../types/pet'

export type PetStateListener = (activePet: Pet, allPets: Pet[]) => void
export type QuestListener = (quests: WellnessQuest[]) => void

export class PetManager {
  private activePet: Pet
  private inventory: Pet[] = []
  private activeQuests: WellnessQuest[] = []
  private breedingPair?: BreedingPair
  private essencePoints: Record<EmotionType, number> = {
    joy: 40,
    calm: 50,
    anxiety: 10,
    sadness: 10,
    frustration: 5,
    curiosity: 25,
  }

  private petListeners: PetStateListener[] = []
  private questListeners: QuestListener[] = []

  constructor() {
    // Initial Starter Pet: Solispark (Joy Wisp)
    this.activePet = {
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
    }

    // Companion pet in sanctuary: Lumidrop (Calm Waterling)
    const calmPet: Pet = {
      id: 'pet_companion_2',
      name: 'Lumidrop',
      speciesId: 'lumidrop',
      speciesName: 'Calm Waterling',
      element: 'calm',
      stage: 'wisp',
      level: 2,
      xp: 30,
      xpToNextLevel: 100,
      happiness: 90,
      hunger: 20,
      dominantMood: 'calm',
      generation: 1,
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

  getEssencePoints(): Record<EmotionType, number> {
    return { ...this.essencePoints }
  }

  getBreedingPair(): BreedingPair | undefined {
    return this.breedingPair
  }

  /** Update active pet's mood based on incoming voice emotion reading */
  applyVoiceEmotion(reading: EmotionReading): { xpGained: number; leveledUp: boolean } {
    this.activePet.dominantMood = reading.primary
    const emotion = reading.primary

    // Gain essence corresponding to detected emotion
    this.essencePoints[emotion] = (this.essencePoints[emotion] || 0) + 1

    let xpGained = 2
    // Extra bonus for expressing positive emotional awareness
    if (emotion === 'joy' || emotion === 'calm' || emotion === 'curiosity') {
      this.activePet.happiness = Math.min(100, this.activePet.happiness + 2)
      xpGained = 5
    } else {
      // For heavy emotions, we want to support the user:
      // Pet shows empathy, hunger increases slightly, prompt user with supportive quest
      this.activePet.hunger = Math.min(100, this.activePet.hunger + 3)
      this.refreshQuestsForMood(emotion)
    }

    const leveledUp = this.addXp(xpGained)
    this.notifyPetListeners()
    return { xpGained, leveledUp }
  }

  /** Complete a wellness micro-step to improve mood and gain pet points */
  completeQuest(questId: string): { success: boolean; pet: Pet; leveledUp: boolean } {
    const quest = this.activeQuests.find((q) => q.id === questId && !q.completed)
    if (!quest) return { success: false, pet: this.activePet, leveledUp: false }

    quest.completed = true

    // Add XP & Essence
    const leveledUp = this.addXp(quest.rewardXp)
    this.essencePoints[quest.targetEmotion] = (this.essencePoints[quest.targetEmotion] || 0) + quest.rewardEssence

    // Boost happiness & feed hunger
    this.activePet.happiness = Math.min(100, this.activePet.happiness + 15)
    this.activePet.hunger = Math.max(0, this.activePet.hunger - 25)

    // Check if breeding pair can absorb essence
    if (this.breedingPair && !this.breedingPair.isReadyToHatch) {
      this.breedingPair.currentEssence += quest.rewardEssence
      if (this.breedingPair.currentEssence >= this.breedingPair.hatchCostEssence) {
        this.breedingPair.isReadyToHatch = true
      }
    }

    this.notifyPetListeners()
    this.notifyQuestListeners()
    return { success: true, pet: this.activePet, leveledUp }
  }

  /** Add XP and handle stage evolution */
  private addXp(amount: number): boolean {
    this.activePet.xp += amount
    let leveledUp = false

    while (this.activePet.xp >= this.activePet.xpToNextLevel) {
      this.activePet.xp -= this.activePet.xpToNextLevel
      this.activePet.level += 1
      this.activePet.xpToNextLevel = Math.round(this.activePet.xpToNextLevel * 1.35)
      leveledUp = true

      // Evolution stage check:
      // 1: Egg, 2-4: Wisp, 5-9: Juvenile, 10+: Ascended
      if (this.activePet.level >= 10 && this.activePet.stage !== 'ascended') {
        this.activePet.stage = 'ascended'
      } else if (this.activePet.level >= 5 && this.activePet.stage === 'wisp') {
        this.activePet.stage = 'juvenile'
      } else if (this.activePet.level >= 2 && this.activePet.stage === 'egg') {
        this.activePet.stage = 'wisp'
      }
    }

    return leveledUp
  }

  /** Set up breeding between two pets */
  startBreeding(parentAId: string, parentBId: string): boolean {
    const parentA = this.inventory.find((p) => p.id === parentAId)
    const parentB = this.inventory.find((p) => p.id === parentBId)
    if (!parentA || !parentB || parentA.id === parentB.id) return false

    // Hybrid calculation: Joy + Calm = Serenidrake
    let eggSpecies = 'serenidrake'
    if (
      (parentA.element === 'joy' && parentB.element === 'calm') ||
      (parentA.element === 'calm' && parentB.element === 'joy')
    ) {
      eggSpecies = 'serenidrake'
    } else {
      eggSpecies = 'serenidrake' // default legendary hybrid
    }

    this.breedingPair = {
      parentA,
      parentB,
      eggSpecies,
      hatchCostEssence: 60,
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
      stage: 'wisp',
      level: 1,
      xp: 0,
      xpToNextLevel: 120,
      happiness: 100,
      hunger: 0,
      dominantMood: 'calm',
      generation: Math.max(this.breedingPair.parentA.generation, this.breedingPair.parentB.generation) + 1,
      parents: [this.breedingPair.parentA.name, this.breedingPair.parentB.name],
      unlockedAt: Date.now(),
    }

    this.inventory.push(newPet)
    this.activePet = newPet
    this.breedingPair = undefined

    this.notifyPetListeners()
    return newPet
  }

  /** Switch active companion pet */
  selectPet(petId: string): boolean {
    const pet = this.inventory.find((p) => p.id === petId)
    if (pet) {
      this.activePet = pet
      this.notifyPetListeners()
      return true
    }
    return false
  }

  /** Refresh micro-quests dynamically based on detected mood */
  refreshQuestsForMood(mood: EmotionType): void {
    const questPool: Record<EmotionType, Omit<WellnessQuest, 'id' | 'completed'>[]> = {
      anxiety: [
        {
          title: '🌬️ Box Breathing',
          microStep: 'Inhale 4s, hold 4s, exhale 4s, hold 4s.',
          targetEmotion: 'calm',
          rewardXp: 45,
          rewardEssence: 20,
          durationSec: 16,
        },
        {
          title: '🧘 Jaw & Shoulder Release',
          microStep: 'Drop shoulders down and unclamp teeth.',
          targetEmotion: 'calm',
          rewardXp: 30,
          rewardEssence: 15,
        },
      ],
      frustration: [
        {
          title: '💧 Cool Sip Reset',
          microStep: 'Take a slow sip of water and pause for 5s.',
          targetEmotion: 'calm',
          rewardXp: 40,
          rewardEssence: 20,
        },
        {
          title: '🌱 Perspective Shift',
          microStep: 'Say out loud: "This moment will pass smoothly."',
          targetEmotion: 'curiosity',
          rewardXp: 50,
          rewardEssence: 25,
        },
      ],
      sadness: [
        {
          title: '☀️ Gratitude Spark',
          microStep: 'Speak aloud 1 thing you are grateful for right now.',
          targetEmotion: 'joy',
          rewardXp: 50,
          rewardEssence: 25,
        },
        {
          title: '👀 Horizon Gaze',
          microStep: 'Look 20 feet away through your glasses for 20s.',
          targetEmotion: 'calm',
          rewardXp: 35,
          rewardEssence: 15,
        },
      ],
      joy: [
        {
          title: '✨ Radiate Your Vibe',
          microStep: 'Share a compliment or smile at someone nearby.',
          targetEmotion: 'joy',
          rewardXp: 60,
          rewardEssence: 30,
        },
        {
          title: '🧬 Essence Synthesis',
          microStep: 'Maintain positive cadence for 60 seconds.',
          targetEmotion: 'calm',
          rewardXp: 45,
          rewardEssence: 20,
        },
      ],
      calm: [
        {
          title: '☯ Deep Flow State',
          microStep: 'Take 2 long nasal breaths and ground feet.',
          targetEmotion: 'calm',
          rewardXp: 40,
          rewardEssence: 20,
        },
        {
          title: '🌟 Mindful Check-in',
          microStep: 'Notice the physical space around you.',
          targetEmotion: 'curiosity',
          rewardXp: 35,
          rewardEssence: 15,
        },
      ],
      curiosity: [
        {
          title: '🚀 Learning Curiosity',
          microStep: 'Ask one interesting question or observe a detail.',
          targetEmotion: 'curiosity',
          rewardXp: 45,
          rewardEssence: 20,
        },
      ],
    }

    const pool = questPool[mood] || questPool.calm
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
}
