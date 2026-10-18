/**
 * src/app.ts — AuraPet G2 Main Application Controller
 * 
 * Pairs Even Reality G2 smart glasses with VoidPet-style emotional companions:
 *   - Continuous voice listening & voice fingerprinting
 *   - Prosody & acoustic emotion classification
 *   - Real-time Pet HUD rendering (576x288 monochrome display)
 *   - Micro-action wellness quests & breeding sanctuary
 */

import { waitForEvenAppBridge, type EvenAppBridge } from '@evenrealities/even_hub_sdk'
import { DisplayManager } from './display'
import { EventManager } from './events'
import { ApiClient } from './api'
import { StateManager } from './state'
import { VoiceAnalyzer } from './audio/voiceAnalyzer'
import { PetManager } from './game/petManager'
import { getPetAscii, getEmotionEmoji } from './game/petAscii'
import type { ActiveHudScreen } from './types/pet'

export class AuraPetApp {
  private bridge!: EvenAppBridge
  private display!: DisplayManager
  private events!: EventManager
  private api: ApiClient
  private state: StateManager
  private petManager: PetManager
  private voiceAnalyzer: VoiceAnalyzer

  private isStarted = false
  private startupRendered = false
  private lastRenderTime = 0

  constructor() {
    this.api = new ApiClient()
    this.state = new StateManager()
    this.petManager = new PetManager()
    this.voiceAnalyzer = new VoiceAnalyzer()
  }

  getStateManager(): StateManager {
    return this.state
  }

  getPetManager(): PetManager {
    return this.petManager
  }

  getVoiceAnalyzer(): VoiceAnalyzer {
    return this.voiceAnalyzer
  }

  getApiClient(): ApiClient {
    return this.api
  }

  /** Initialize the Even Hub SDK bridge and start AuraPet */
  async start(): Promise<void> {
    if (this.isStarted) return
    this.isStarted = true

    console.log('[AuraPet] Connecting to Even Reality Bridge...')
    this.bridge = await waitForEvenAppBridge()
    console.log('[AuraPet] G2 Bridge Connected!')

    this.display = new DisplayManager(this.bridge)
    this.events = new EventManager(this.bridge)
    this.voiceAnalyzer.setBridge(this.bridge)

    // Sync initial state
    this.state.update({
      activePet: this.petManager.getActivePet(),
      allPets: this.petManager.getAllPets(),
      activeQuests: this.petManager.getActiveQuests(),
    })

    // Setup G2 Input and Audio handlers
    this.setupGlassesInputHandlers()
    this.setupAudioAndEmotionPipeline()

    // Render Initial Pet HUD to G2 Glasses
    await this.renderHudScreen(true)

    // Check backend health & sync voice profile
    this.checkBackendAndSync()

    // Start continuous voice listening
    await this.startListening()
  }

  /** Setup Touchpad gestures from G2 temple */
  private setupGlassesInputHandlers(): void {
    // 1. Single Tap on touchpad
    this.events.on('tap', async () => {
      const current = this.state.get().currentScreen
      console.log(`[AuraPet] G2 Tap on screen: ${current}`)

      if (current === 'pet') {
        // Pet the companion! Boosts happiness and triggers cheer
        const activePet = this.petManager.getActivePet()
        activePet.happiness = Math.min(100, activePet.happiness + 5)
        this.state.update({
          activePet,
          coachMessage: `You petted ${activePet.name}! ❤️ (+5 happiness)`,
        })
        await this.renderHudScreen()
      } else if (current === 'quest') {
        // Complete the first pending wellness quest!
        const quests = this.petManager.getActiveQuests()
        const pending = quests.find((q) => !q.completed)
        if (pending) {
          const res = this.petManager.completeQuest(pending.id)
          const cheer = res.leveledUp
            ? `LEVEL UP! ${res.pet.name} is now Lvl ${res.pet.level}! 🎉`
            : `Quest Complete! +${pending.rewardXp} XP 🌟`
          this.state.update({
            activePet: res.pet,
            activeQuests: this.petManager.getActiveQuests(),
            coachMessage: cheer,
          })
          await this.renderHudScreen()
        }
      } else if (current === 'breeding') {
        // Try to hatch ready egg
        const hatched = this.petManager.hatchEgg()
        if (hatched) {
          this.state.update({
            activePet: hatched,
            allPets: this.petManager.getAllPets(),
            coachMessage: `Egg Hatched! Welcome ${hatched.name}! 🐣✨`,
          })
          await this.renderHudScreen()
        }
      }
    })

    // 2. Swipe Forward -> Cycle screens (Pet -> Quest -> Breeding -> EndGoal)
    this.events.on('swipe_forward', async () => {
      const screens: ActiveHudScreen[] = ['pet', 'quest', 'breeding', 'endgoal']
      const current = this.state.get().currentScreen
      const idx = screens.indexOf(current)
      const next = screens[(idx + 1) % screens.length]
      this.state.update({ currentScreen: next })
      await this.renderHudScreen()
    })

    // 3. Swipe Backward -> Cycle screens backwards
    this.events.on('swipe_backward', async () => {
      const screens: ActiveHudScreen[] = ['pet', 'quest', 'breeding', 'endgoal']
      const current = this.state.get().currentScreen
      const idx = screens.indexOf(current)
      const prev = screens[(idx - 1 + screens.length) % screens.length]
      this.state.update({ currentScreen: prev })
      await this.renderHudScreen()
    })

    // 4. Double Tap -> Exit app confirmation (Even App Store requirement)
    this.events.on('double_tap', () => {
      const screen = this.state.get().currentScreen
      if (screen === 'pet') {
        this.display.exitApp(1)
      } else {
        this.state.update({ currentScreen: 'pet' })
        this.renderHudScreen()
      }
    })

    // 5. Incoming Audio PCM frames from glasses microphone
    this.events.onAudio((audioEvent) => {
      if (audioEvent && audioEvent.audioPcm) {
        this.voiceAnalyzer.handleSdkAudioEvent(audioEvent.audioPcm, audioEvent.speakerRole)
      }
    })
  }

  /** Continuous listening pipeline & emotion recognition */
  private setupAudioAndEmotionPipeline(): void {
    let lastMoodChange = 0

    this.voiceAnalyzer.onEmotion(async (reading) => {
      // Only process if user voice confidence is verified
      if (!reading.isUserVoice) return

      // Apply to Pet Manager
      const { leveledUp, remedySuggested } = this.petManager.applyVoiceEmotion(reading)
      const pet = this.petManager.getActivePet()
      const emotionPoints = this.petManager.getEmotionPoints()
      const endGoal = this.petManager.getEndGoalStatus()

      let coachMsg = this.state.get().coachMessage
      const now = Date.now()

      // If heavy mood detected, immediately suggest the remedy
      if (remedySuggested) {
        const quests = this.petManager.getActiveQuests()
        const activeRemedy = quests.find((q) => !q.completed)
        if (activeRemedy) {
          coachMsg = `Remedy: ${activeRemedy.microStep.slice(0, 52)}`
        }
      } else if (now - lastMoodChange > 12000) {
        lastMoodChange = now
        try {
          const res = await this.api.getCoachSuggestion(reading.primary, pet.name, pet.level)
          if (res.success && res.data?.suggestion) {
            coachMsg = res.data.suggestion
          }
        } catch {
          // fallback stays
        }
      }

      if (leveledUp) {
        coachMsg = `★ EVOLUTION! ${pet.name} GREW to Lvl ${pet.level} ${pet.stage.toUpperCase()}! ★`
      }

      this.state.update({
        activePet: pet,
        lastReading: reading,
        coachMessage: coachMsg,
        activeQuests: this.petManager.getActiveQuests(),
        emotionPoints,
        endGoal,
      })

      // Throttle G2 HUD re-renders to at most once per 1.5s
      if (now - this.lastRenderTime > 1500) {
        this.lastRenderTime = now
        await this.renderHudScreen()
      }
    })
  }

  /** Start continuous listening */
  async startListening(): Promise<boolean> {
    const ok = await this.voiceAnalyzer.startListening()
    this.state.update({ isListening: ok })
    return ok
  }

  /** Stop continuous listening */
  async stopListening(): Promise<void> {
    await this.voiceAnalyzer.stopListening()
    this.state.update({ isListening: false })
  }

  /** Trigger Voice Fingerprint Calibration */
  async startCalibration(): Promise<void> {
    this.state.update({ isCalibrating: true, currentScreen: 'calibrate' })
    this.voiceAnalyzer.startCalibration()
    await this.renderHudScreen()

    // 5-second calibration window
    setTimeout(async () => {
      const fp = this.voiceAnalyzer.finishCalibration()
      this.state.update({
        isCalibrating: false,
        voiceEnrolled: true,
        currentScreen: 'pet',
        coachMessage: `Voice enrolled! Baseline pitch: ${fp.medianPitchHz} Hz 🎯`,
      })
      // Sync with server
      await this.api.enrollVoice({
        medianPitchHz: fp.medianPitchHz,
        pitchVariance: fp.pitchVariance,
        spectralCentroid: fp.spectralCentroid,
      })
      await this.renderHudScreen()
    }, 5000)
  }

  /** Render the current screen on the G2 Smart Glasses HUD (576x288 px) */
  async renderHudScreen(isStartup = false): Promise<void> {
    const s = this.state.get()
    const pet = s.activePet
    const screen = s.currentScreen

    switch (screen) {
      case 'pet': {
        const ascii = getPetAscii(pet.speciesId, pet.stage)
        const moodBadge = getEmotionEmoji(pet.dominantMood)
        const reading = s.lastReading

        // Left Container Content: Art + Species
        const leftText = [
          `[ ${pet.name} ]`,
          `Lvl ${pet.level} ${pet.stage.toUpperCase()}`,
          '',
          ascii,
          '',
          `Mood: ${moodBadge}`,
        ].join('\n')

        // Right Container Content: Stats + Micro Advice + Controls
        const happinessBar = '■'.repeat(Math.floor(pet.happiness / 20)) + '□'.repeat(5 - Math.floor(pet.happiness / 20))
        const xpPercent = Math.min(100, Math.round((pet.xp / pet.xpToNextLevel) * 100))

        const rightText = [
          `HP: [${happinessBar}] ${pet.happiness}%`,
          `XP: ${pet.xp}/${pet.xpToNextLevel} (${xpPercent}%)`,
          `Pitch: ${reading ? reading.pitchHz + ' Hz' : '--'}`,
          '---------------------',
          `"${s.coachMessage.slice(0, 55)}"`,
          '---------------------',
          '>> [Tap] Pet companion',
          '>> [Swipe] Quests',
        ].join('\n')

        if (isStartup || !this.startupRendered) {
          const res = await this.display.renderPetHud(leftText, rightText, true)
          console.log('[AuraPet] Startup render result code:', res)
          if (res === 0) {
            this.startupRendered = true
          }
        } else {
          // Fast in-place container text upgrade
          await this.display.updateText(1, 'pet_display', leftText)
          await this.display.updateText(2, 'pet_stats', rightText)
        }
        break
      }

      case 'quest': {
        const quests = s.activeQuests
        const active = quests.find((q) => !q.completed) || quests[0]

        const title = `[WELLNESS QUEST] +${active ? active.rewardXp : 0} XP`
        const body = active
          ? [
              active.title,
              '',
              `Action: ${active.microStep}`,
              `Reward: +${active.rewardEssence} ${active.targetEmotion.toUpperCase()} Essence`,
              '',
              '---------------------------------------',
              '>> [TAP] Complete Step  |  [SWIPE] Return',
            ].join('\n')
          : 'All quests completed! Great job breathing and staying present.'

        await this.display.renderQuestHud(title, body)
        break
      }

      case 'breeding': {
        const pair = this.petManager.getBreedingPair()
        const essence = this.petManager.getEmotionPoints()

        const header = '[BREEDING SANCTUARY & ESSENCE]'
        const content = pair
          ? [
              `Incubating Egg: ${pair.eggSpecies.toUpperCase()}`,
              `Parents: ${pair.parentA.name} + ${pair.parentB.name}`,
              `Progress: ${pair.currentEssence}/${pair.hatchCostEssence} Essence`,
              pair.isReadyToHatch ? '★ READY TO HATCH! [TAP] NOW! ★' : 'Earn Calm/Joy Essence to hatch.',
              '',
              '>> [TAP] Hatch  |  [SWIPE] Pet HUD',
            ].join('\n')
          : [
              'Essence Vault:',
              `☀️ Joy: ${essence.joy}  |  💧 Calm: ${essence.calm}`,
              `✨ Curiosity: ${essence.curiosity}  |  🌪️ Wind: ${essence.anxiety}`,
              '',
              'Keep speaking in positive cadence or complete quests to unlock breeding!',
              '>> [SWIPE] Pet HUD',
            ].join('\n')

        await this.display.renderBreedingHud(header, content)
        break
      }

      case 'endgoal': {
        const goal = this.petManager.getEndGoalStatus()
        const pts = this.petManager.getEmotionPoints()
        const title = '[END GOAL: ZENITH AWAKENING]'
        const body = [
          `Rank: ${goal.currentAscensionRank.toUpperCase()}`,
          `Equilibrium: ${goal.equilibriumScore}% / 100%`,
          `Voice Points: ${pts.totalVoicePoints} total`,
          '---------------------------------------',
          `☀️ Joy: ${pts.joy} | 💧 Calm: ${pts.calm} | ✨ Focus: ${pts.curiosity}`,
          `🌪️ Anxiety: ${pts.anxiety} | 🌙 Gloom: ${pts.sadness} | ⚡ Grit: ${pts.frustration}`,
          '---------------------------------------',
          goal.isAwakened ? '★ ZENITH GUARDIAN AWAKENED! ★' : 'Balance all 5 emotions to awaken Zenith!',
          '>> [SWIPE] Pet HUD',
        ].join('\n')

        await this.display.renderQuestHud(title, body)
        break
      }

      case 'calibrate': {
        const title = '[VOICE CALIBRATION]'
        const body = [
          'Calibrating your unique vocal fingerprint...',
          '',
          'Please speak naturally for 5 seconds.',
          '(e.g., "Hello AuraPet, this is my natural voice")',
          '',
          '>> The G2 glasses will filter out other people\'s voices!',
        ].join('\n')

        await this.display.renderQuestHud(title, body)
        break
      }
    }
  }

  /** Check backend server connectivity */
  private async checkBackendAndSync(): Promise<void> {
    const health = await this.api.healthCheck()
    if (health.success) {
      console.log('[AuraPet] Backend connected:', health.data)
      this.state.update({ backendOnline: true })

      // Fetch server voice profile
      const prof = await this.api.getVoiceProfile()
      if (prof.success && prof.data?.profile?.enrolled) {
        this.state.update({ voiceEnrolled: true })
      }
    } else {
      console.warn('[AuraPet] Backend unreachable, operating in autonomous edge mode')
    }
  }

  /** Force re-render startup page to glasses lens */
  async reconnectGlasses(): Promise<number> {
    console.log('[AuraPet] Forcing startup page push to glasses...')
    this.startupRendered = false
    await this.renderHudScreen(true)
    return 0
  }
}
