/**
 * src/engine/aura.ts — AuraPet's brain.
 *
 *   listen → detect a sustained spiral → nudge → one verified reset → bloom → watch for real recovery → grow
 *
 * Plus: "slow down" pace whisper, crisis safety screen, hatching, and the lens view for every phase.
 */

import { DEMO_TIMINGS, JUDGE_TIMINGS, NORMAL_TIMINGS, type Timings } from '../config'
import type { Glasses } from '../platform/glasses'
import type { Segmenter, Utterance } from '../audio/segmenter'
import { wavBase64 } from '../audio/segmenter'
import type { HudRenderer } from '../hud/renderer'
import { ambientFrame, bar, cardFrame, textFrame, wideFrame, type HudFrame } from '../hud/frames'
import type { Face, SpriteSpec } from '../hud/sprite'
import { api } from '../api'
import type { InputType, MoodLabel, ResetId, Social, StageId, UtteranceResult, Weather } from '../types'
import { MoodEngine, type MoodSnapshot } from './mood'
import { BREATH, LOOK_UP, RESETS, pickReset } from './resets'
import { Store, median, nextStage, stageFor, stageLabel, useJudgeStages } from './store'
import type { HeadTracker } from './imu'
import { diag, diagEvent } from '../diagnostics'
import { ACCESSORY_NAMES, BADGES, accessoriesFor, fmtDuration, type BadgeId } from './badges'
import { buildVoiceprint, type VoiceFeatures } from '../audio/voiceprint'

export type Phase = 'hatching' | 'idle' | 'nudged' | 'active' | 'bloom' | 'cleared' | 'evolving' | 'crisis' | 'voicecheck' | 'intro'

interface ActiveReset {
  id: ResetId
  kind: 'storm' | 'fog'
  startedAt: number
  attempts: number
  tried: ResetId[]
  message: string
  progress: number
  breathStart: number
  lookAccumMs: number
  lastTick: number
}

export interface AuraSnapshot {
  phase: Phase
  mood: MoodSnapshot
  stage: StageId
  pending: boolean
  active: { id: ResetId; title: string; progress: number; message: string } | null
  watching: boolean
  lastTranscript: string
  lastLabel: MoodLabel | null
  lastEmotion: string
  whisperActive: boolean
  backendStt: boolean
  inConversation: boolean
}

const MAX_BASELINE = 40

/** Item IDs for AuraPet's entries in the G2 long-press menu */
const MENU = { voice: 1, judge: 2, exitJudge: 3 }

type NoticeKind = 'repair' | 'room' | 'kind' | 'forecast' | 'badge' | 'pb' | 'self'

export type JudgeFeature = 'storm' | 'kind' | 'repair' | 'room' | 'convo' | 'pace' | 'forecast'

const VOICE_LINES = [
  'Hi, this is my normal speaking voice.',
  "I'm testing my glasses at the hackathon today.",
  'The quick brown fox jumps over the lazy dog.',
]

export class Aura {
  phase: Phase = 'idle'
  lastTranscript = ''
  lastLabel: MoodLabel | null = null
  lastEmotion = ''
  backendStt = true
  /** false when nothing can turn speech into words (no server STT and no WebView speech API) */
  speechReady = true
  voiceStep = 0
  /** a reset answer is being checked (shows "Checking..." immediately) */
  private checking = false
  private ambientShowUntil = 0
  private lastWeather = ''
  /**
   * Post-conversation debrief. When the glasses hear both the wearer and someone else, we're in a
   * conversation: nudges are held (nobody talks to their glasses mid-argument) while tension is tracked.
   * When everyone goes quiet, a tense conversation gets one gentle "that got tense" offer.
   */
  private convo: { startedAt: number; lastSpeechAt: number; tense: number; storm: number; fog: number } | null = null
  private lastSelfAt = 0
  private lastOtherAt = 0
  private debrief = false

  /** One short, quiet lens moment from the social features (repair / read the room / kindness / forecast) */
  private notice: { kind: NoticeKind; title: string; body: string; until: number } | null = null
  /** Rewards (badges, personal bests) wait their turn until the lens is free */
  private noticeQueue: Array<{ kind: NoticeKind; title: string; body: string; ms: number }> = []
  /** "Calmed down on your own": a storm that clears without any reset */
  private selfWatch: { since: number; assisted: boolean } | null = null
  /** Judge runs collect their own badges so a demo never touches the owner's trophies */
  private judgeBadges = new Set<BadgeId>()
  private voiceSamples: VoiceFeatures[] = []
  /** last sentence's voiceprint match (for the phone), null = no voiceprint */
  lastVoiceMatch: { score: number; you: boolean } | null = null
  private judgePbMs = 0
  /** After a sharp remark: an apology within this window counts as a repair (a bounce-back) */
  private repairWindow: { since: number; until: number } | null = null
  /** After "they sound stressed": a caring reply within this window counts */
  private careWindowUntil = 0
  private lastRepairOfferAt = 0
  private lastRoomCueAt = 0
  private lastKindShownAt = 0
  private bloomText = ''
  private judgeStartedAt = 0
  /**
   * Judge tour: 0 storm → 1 kindness → 2 repair → 3 conversation (read the room + debrief) → 4 extra
   * storm rounds until Zenith. Every step says on the lens what to do; swipe skips a step.
   */
  private judgeStep = 0
  private judgeDone = new Set<JudgeFeature>()
  private sessionStartedAt = Date.now()
  private forecastShown = false

  private mood: MoodEngine
  private pending: { kind: 'storm' | 'fog'; since: number } | null = null
  private active: ActiveReset | null = null
  private watch: { spikeAt: number; resetId: ResetId; until: number } | null = null
  private celebrate: { kind: 'cleared' | 'evolving'; bounceMs: number } | null = null
  private lastResetEndedAt = 0
  private nudgeShownAt = 0
  private cardUntil = 0
  private phaseUntil = 0
  private whisperUntil = 0
  private lastWhisperAt = 0
  private quietUntil = 0 // no nudges (after crisis screen / dismiss)
  private frame = 0
  private lastEval = 0
  private lastUtt: Utterance | null = null
  private changeFns: Array<(s: AuraSnapshot) => void> = []

  constructor(
    private glasses: Glasses,
    private store: Store,
    private head: HeadTracker,
    private hud: HudRenderer,
    private segmenter: Segmenter,
  ) {
    this.mood = new MoodEngine(() => this.timings())
    this.phase = store.data.pet.hatched ? 'idle' : 'hatching'
    if (store.data.judgeMode && !store.data.pet.hatched) setTimeout(() => this.startJudgeDemo(), 0)
    this.applyVoiceThreshold()
    this.applyVoiceprint()

    glasses.onInput((t) => this.onInput(t))
    // Entries in the G2 long-press menu while AuraPet is open
    hud.menuItems = [
      { itemID: MENU.voice, itemName: 'Learn my voice' },
      { itemID: MENU.judge, itemName: 'Start judge tour' },
      { itemID: MENU.exitJudge, itemName: 'Exit judge tour' },
    ]
    glasses.onMenu((id) => this.onMenu(id))
    segmenter.onUtterance((u) => void this.onUtterance(u))
    segmenter.onSpeechStart(() => this.onSpeechStart())
    segmenter.onOtherUtterance((u) => {
      if (u.voiceMatch !== null) this.lastVoiceMatch = { score: u.voiceMatch, you: false }
      void this.onOtherUtterance(u)
    })
    segmenter.onOtherSpeaker(() => {
      this.hud.caption = 'Someone else is talking - not counted'
      this.noteSpeech('other')
      this.changed()
    })
    setInterval(() => this.tick(), 250)
  }

  timings(): Timings {
    if (this.store.data.judgeMode) return JUDGE_TIMINGS
    return this.store.data.demoMode ? DEMO_TIMINGS : NORMAL_TIMINGS
  }

  get judgeMode(): boolean {
    return this.store.data.judgeMode
  }

  /**
   * Judge mode: a fresh, guided 2-minute run. Mochi starts as a Sprout and reaches Zenith after three
   * real bounce-backs (vent → nudge → spoken reset → say something calm), prompted on the lens.
   */
  startJudgeDemo(): void {
    const d = this.store.data
    d.judgeMode = true
    d.pet.hatched = true
    d.onboarded = true
    d.pet.recoveries = 0
    d.recoveries = []
    this.judgeStartedAt = Date.now()
    this.judgeStep = 0
    this.judgeDone.clear()
    this.judgeBadges.clear()
    this.judgePbMs = 0
    this.noticeQueue = []
    this.selfWatch = null
    this.segmenter.useVoiceprint = false
    this.notice = null
    this.repairWindow = null
    useJudgeStages(true)
    this.mood = new MoodEngine(() => this.timings())
    this.pending = null
    this.active = null
    this.watch = null
    this.celebrate = null
    this.lastResetEndedAt = 0
    this.whisperUntil = 0
    this.store.save()
    this.setPhase('intro', 6000)
    diagEvent('judge_demo_start')
    this.changed()
  }

  stopJudgeDemo(): void {
    this.store.data.judgeMode = false
    this.segmenter.useVoiceprint = true
    useJudgeStages(false)
    this.store.save()
    this.toIdle()
    this.changed()
  }

  onChange(fn: (s: AuraSnapshot) => void): void {
    this.changeFns.push(fn)
  }

  snapshot(): AuraSnapshot {
    const a = this.active
    return {
      phase: this.phase,
      mood: this.mood.snapshot(),
      stage: stageFor(this.store.data.pet.recoveries, this.store.data.pet.hatched),
      pending: Boolean(this.pending),
      active: a ? { id: a.id, title: RESETS[a.id].title, progress: a.progress, message: a.message } : null,
      watching: Boolean(this.watch),
      inConversation: Boolean(this.convo),
      lastTranscript: this.lastTranscript,
      lastLabel: this.lastLabel,
      lastEmotion: this.lastEmotion,
      whisperActive: Date.now() < this.whisperUntil,
      backendStt: this.backendStt,
    }
  }

  // ── Input: speech ───────────────────────────────────────────

  private async onUtterance(u: Utterance): Promise<void> {
    this.lastUtt = u
    if (u.voiceMatch !== null) this.lastVoiceMatch = { score: u.voiceMatch, you: true }
    this.noteSpeech('self')
    if (this.phase === 'voicecheck') {
      this.recordVoiceSample(u)
      return
    }
    // Saying the pet's name to hatch doubles as a first voice sample
    if (this.phase === 'hatching' && u.selfRatio !== null) pushCapped(this.store.data.baseline.selfRatio, Math.max(u.selfRatio, 0.01))
    const b = this.store.data.baseline
    const prosody = {
      loudnessRatio: u.rms / median(b.rms, u.rms || 1),
      pitchRatio: u.pitchHz && b.pitch.length ? u.pitchHz / median(b.pitch, u.pitchHz) : 0,
    }
    pushCapped(b.rms, u.rms)
    if (u.pitchHz) pushCapped(b.pitch, u.pitchHz)

    // Without server speech-to-text, transcripts come from the WebView speech API instead (see submitText)
    if (!this.backendStt) {
      if (this.phase === 'hatching') this.hatch()
      return
    }

    const verify = this.voiceVerifyTarget()
    if (verify) this.checking = true
    const result = await api.analyze({
      audioBase64: wavBase64(u.pcm),
      durationMs: u.durationMs,
      voicedMs: u.voicedMs,
      prosody,
      verify,
      petName: this.store.data.pet.name,
    })
    this.checking = false
    if (!result) {
      diagEvent('analyze_failed')
      return
    }
    this.onResult(result, verify, { voicedMs: u.voicedMs, loudnessRatio: prosody.loudnessRatio })
  }

  /** Text path: phone test panel, or WebView speech recognition when the backend has no STT */
  async submitText(text: string, fromSpeechApi = false): Promise<void> {
    const trimmed = text.trim()
    if (!trimmed) return
    // Test hook for browsers (no speaker tags): "them: ..." plays the other person in a conversation
    if (!fromSpeechApi && /^them:/i.test(trimmed)) {
      this.hud.caption = `Someone else: "${trimmed.slice(5).trim().slice(0, 60)}" - not counted`
      this.noteSpeech('other')
      this.changed()
      const theirs = await api.analyze({
        text: trimmed.slice(5).trim(),
        durationMs: 2000,
        voicedMs: 2000,
        prosody: { loudnessRatio: 1, pitchRatio: 0 },
        petName: this.store.data.pet.name,
        speaker: 'other',
      })
      if (theirs) this.onOtherMood(theirs.classification.label, theirs.classification.intensity)
      return
    }
    if (!fromSpeechApi) this.noteSpeech('self')
    // Speech-API text comes from the phone mic: only trust it if the wearer just spoke (speaker gate)
    const utt = this.lastUtt && Date.now() - this.lastUtt.endedAt < 6000 ? this.lastUtt : null
    if (fromSpeechApi && this.glasses.connected && !utt) {
      diagEvent('speech_api_text_without_wearer_audio_ignored')
      return
    }
    const voicedMs = utt?.voicedMs ?? Math.max(1200, trimmed.split(/\s+/).length * 350)
    const loudnessRatio = utt ? utt.rms / median(this.store.data.baseline.rms, utt.rms || 1) : 1
    const verify = this.voiceVerifyTarget()
    if (verify) this.checking = true
    const result = await api.analyze({
      text: trimmed,
      durationMs: voicedMs,
      voicedMs,
      prosody: { loudnessRatio, pitchRatio: 0 },
      verify,
      petName: this.store.data.pet.name,
    })
    this.checking = false
    if (result) this.onResult(result, verify, { voicedMs, loudnessRatio })
  }

  private voiceVerifyTarget(): ResetId | undefined {
    return this.active && RESETS[this.active.id].verify === 'voice' ? this.active.id : undefined
  }

  private onResult(r: UtteranceResult, verifiedFor: ResetId | undefined, meta: { voicedMs: number; loudnessRatio: number }): void {
    const transcript = r.transcript.trim()
    if (!transcript) return
    const now = Date.now()
    const c = r.classification
    this.lastTranscript = transcript
    this.lastLabel = c.label
    this.lastEmotion = c.emotion
    this.hud.caption = `You: "${transcript.slice(0, 80)}"  -> ${c.label}${c.emotion ? ` (${c.emotion})` : ''}`

    if (this.phase === 'hatching') {
      this.hatch()
      return
    }

    // Voice commands ("Mochi, learn my voice", "start the tour") are instructions, not mood
    if (this.voiceCommand(transcript)) return

    if (c.crisis) {
      this.showCrisis()
      return
    }

    // Reset verification: a passing answer is reflection, not spiraling, so it doesn't feed the mood
    let countsForMood = true
    if (verifiedFor && this.active?.id === verifiedFor) {
      if (r.verification?.passed) {
        countsForMood = false
        this.completeReset()
      } else {
        this.active.attempts++
        this.active.message =
          this.active.attempts >= 3 ? '' : `Almost - ${r.verification?.reason || 'try once more.'}`.slice(0, 60)
        if (this.active.attempts >= 3) this.endReset('No worries. Try again later.')
      }
    }

    if (countsForMood) this.mood.add(c, now)
    if (countsForMood && this.convo && c.label !== 'clear' && c.intensity >= (this.timings().negativeIntensity ?? 0.45)) {
      this.convo.tense++
      if (c.label === 'storm') this.convo.storm++
      else this.convo.fog++
    }

    if (r.social) this.handleSocial(r.social, c.label, now)

    // Sunlight: joyful/calm moments make the pet glow (looks only, never evolution)
    const pet = this.store.data.pet
    if (c.label === 'clear') pet.sunlight = Math.min(20, pet.sunlight + 0.5 + c.intensity * 0.5)
    else if (c.label === 'storm') pet.sunlight = Math.max(0, pet.sunlight - 0.3)

    // Pace whisper: talking much faster than usual while tense
    const wps = r.words >= 4 && meta.voicedMs > 0 ? r.words / (meta.voicedMs / 1000) : 0
    if (wps) {
      const baseWps = median(this.store.data.baseline.wps, 2.6)
      const fast = wps > Math.max(3.4, baseWps * 1.3)
      const tense = meta.loudnessRatio > 1.3 || c.label === 'storm'
      if (fast && tense && this.phase === 'idle' && now - this.lastWhisperAt > this.timings().paceCooldownMs) {
        this.whisperUntil = now + 4000
        this.lastWhisperAt = now
        this.judgeMark('pace')
        diagEvent('pace_whisper', { wps: wps.toFixed(1), baseWps: baseWps.toFixed(1) })
      }
      pushCapped(this.store.data.baseline.wps, wps)
    }

    const snap = this.mood.snapshot(now)
    this.store.data.timeline.push({ t: now, stress: round2(snap.stress), low: round2(snap.low), label: c.label })
    this.store.save()
    this.evaluate(now)
    this.changed()
  }

  private onSpeechStart(): void {
    const a = this.active
    if (a && a.id === 'breathe') {
      a.breathStart = Date.now()
      a.message = `Breathe quietly with ${this.store.data.pet.name}.`
    }
  }

  // ── Input: touchpad / ring ──────────────────────────────────

  onInput(t: InputType): void {
    const now = Date.now()
    switch (this.phase) {
      case 'hatching':
        break
      case 'voicecheck':
        if (t === 'double_tap') {
          this.applyVoiceThreshold()
          this.applyVoiceprint()
          this.toIdle()
        }
        break
      case 'idle':
        // A 1s long-press opens the G2 system menu, so app gestures avoid it:
        //   tap (pet card) → swipe = start the judge tour · tap (pet card) → long-press = voice check (if delivered)
        if (t === 'long_press') {
          if (now < this.cardUntil && !this.judgeMode) this.startVoiceCheck()
          break
        }
        if ((t === 'swipe_forward' || t === 'swipe_backward') && now < this.cardUntil && !this.judgeMode) {
          this.cardUntil = 0
          this.startJudgeDemo()
          break
        }
        if (t === 'double_tap' && this.judgeMode) {
          if (stageFor(this.store.data.pet.recoveries, true) === 'zenith') this.startJudgeDemo()
          break
        }
        if ((t === 'swipe_forward' || t === 'swipe_backward') && this.judgeMode && !this.pending) {
          this.judgeSkip()
          break
        }
        if (t === 'double_tap') {
          if (now < this.cardUntil) this.cardUntil = 0
          else this.glasses.exitDialog()
        } else if (t === 'tap' && this.pending) {
          this.startReset(this.pending.kind)
        } else if (t === 'tap' || t === 'swipe_forward' || t === 'swipe_backward') {
          this.cardUntil = now < this.cardUntil ? 0 : now + 6000
        }
        break
      case 'nudged':
        if (t === 'tap') this.startReset(this.pending?.kind ?? 'storm')
        else this.dismissNudge()
        break
      case 'active':
        if (t === 'double_tap') this.endReset('Stopped. That\'s okay.')
        else if (t === 'swipe_forward' || t === 'swipe_backward') this.switchReset()
        break
      case 'bloom':
      case 'cleared':
      case 'evolving':
      case 'intro':
        if (t === 'tap' || t === 'double_tap') this.toIdle()
        break
      case 'crisis':
        if (t === 'tap' || t === 'double_tap') {
          this.quietUntil = now + 10 * 60_000
          this.toIdle()
        }
        break
    }
    this.changed()
  }

  // ── Glasses menu + voice commands ───────────────────────────

  private onMenu(id: number): void {
    if (id === MENU.voice) this.startVoiceCheck()
    else if (id === MENU.judge) this.startJudgeDemo()
    else if (id === MENU.exitJudge) this.stopJudgeDemo()
    this.changed()
  }

  /** Hands-free controls; returns true if the sentence was a command */
  private voiceCommand(text: string): boolean {
    const t = text.toLowerCase().replace(/[^a-z' ]/g, ' ')
    if (/\b(learn|remember|record|set up|setup|check) (my|the) voice\b|\bvoice (check|setup|fingerprint)\b/.test(t)) {
      this.startVoiceCheck()
      diagEvent('voice_command', 'voice_check')
      return true
    }
    if (/\b(start|begin|run|show) (the |a )?(judge )?(tour|demo)\b|\bjudge (mode|tour|demo)\b/.test(t) && !/\b(stop|exit|end)\b/.test(t)) {
      this.startJudgeDemo()
      diagEvent('voice_command', 'judge')
      return true
    }
    if (this.judgeMode && /\b(stop|exit|end) (the )?(judge )?(tour|demo|mode)\b/.test(t)) {
      this.stopJudgeDemo()
      diagEvent('voice_command', 'exit_judge')
      return true
    }
    return false
  }

  // ── Phone controls ──────────────────────────────────────────

  setPetName(name: string): void {
    this.store.data.pet.name = name.trim().slice(0, 12) || 'Mochi'
    this.store.save()
    this.changed()
  }

  /**
   * Demo shortcut: jump the recovery count so the NEXT real recovery triggers an evolution.
   * Doesn't fake a recovery itself; the reset and the calm-down still have to happen live.
   */
  setRecoveries(n: number): void {
    const pet = this.store.data.pet
    if (!pet.hatched) {
      pet.hatched = true
      this.store.data.onboarded = true
    }
    pet.recoveries = Math.max(0, Math.floor(n))
    this.lastResetEndedAt = 0 // no cooldown wait after setting up
    this.store.save()
    diagEvent('demo_set_recoveries', pet.recoveries)
    this.changed()
  }

  /** Replay the evolution moment for the current stage (no data change) */
  previewEvolution(): void {
    if (!this.store.data.pet.hatched) return
    this.celebrate = { kind: 'evolving', bounceMs: 0 }
    this.setPhase('evolving', 9000)
    this.changed()
  }

  setQuietLens(on: boolean): void {
    this.store.data.blankLens = on
    this.ambientShowUntil = Date.now() + 5000
    this.store.save()
    this.changed()
  }

  setDemoMode(on: boolean): void {
    this.store.data.demoMode = on
    this.store.save()
    this.changed()
  }

  /** Phone-side shortcut so judges/devs can open the current nudge without the touchpad */
  phoneTap(): void {
    this.onInput('tap')
  }

  // ── Social features: repair · read the room · kindness · forecast ──

  private handleSocial(soc: Social, label: MoodLabel, now: number): void {
    const d = this.store.data
    const t = this.timings()

    // Forecast data: what storms are about (topic tags only)
    if (label !== 'clear' && soc.topic) {
      d.storms.push({ t: now, topic: normTopic(soc.topic) })
      if (d.storms.length > 300) d.storms.shift()
    }

    // Repair: an apology inside the window after a sharp remark is a bounce-back
    if (soc.repair && this.repairWindow && now < this.repairWindow.until) {
      this.completeRepair(now)
      return
    }

    // The "oops" moment: something sharp said TO someone (only when someone else is around)
    const someoneAround = Boolean(this.convo) || now - this.lastOtherAt < 90_000 || d.judgeMode
    if (
      soc.harsh &&
      someoneAround &&
      this.phase === 'idle' &&
      !this.active &&
      now - this.lastRepairOfferAt > t.socialCooldownMs
    ) {
      this.makeRoomForCue()
      this.lastRepairOfferAt = now
      this.repairWindow = { since: now, until: now + 45_000 }
      this.notice = {
        kind: 'repair',
        title: 'That came out sharp.',
        body: 'Repair it? Try:\n"Sorry, that came out wrong."',
        until: now + 12_000,
      }
      diagEvent('repair_offer')
      return
    }

    // Kindness feeds Mochi (and answers a "they sound stressed" cue)
    if (soc.kind !== 'none') {
      d.kindness.push({ t: now, kind: soc.kind })
      if (d.kindness.length > 300) d.kindness.shift()
      d.pet.sunlight = Math.min(20, d.pet.sunlight + 1.5)
      const answeredCue = now < this.careWindowUntil && (soc.kind === 'care' || soc.kind === 'encourage')
      if (answeredCue) {
        this.careWindowUntil = 0
        this.notice = { kind: 'kind', title: '+ you showed up for them', body: '', until: now + 5_000 }
        this.award('first_room')
        diagEvent('room_answered', soc.kind)
      } else if (now - this.lastKindShownAt > 8_000 && this.phase === 'idle') {
        const today = kindToday(d.kindness)
        this.notice = { kind: 'kind', title: `+1 kindness (${today} today)`, body: '', until: now + 4_000 }
      }
      this.lastKindShownAt = now
      this.judgeMark('kind')
      if (this.judgeStep === 1) this.judgeStep = 2
      this.award('first_kind')
      this.checkBadges(now)
      diagEvent('kindness', soc.kind)
    }
  }

  // ── Rewards: badges, accessories, personal bests ────────────

  /**
   * Time-sensitive cues (repair, read the room) beat rewards: a reward on screen goes back to the
   * front of the queue. Returns false if another cue is already showing.
   */
  private makeRoomForCue(): boolean {
    const n = this.notice
    if (!n) return true
    if (n.kind === 'repair' || n.kind === 'room') return false
    if (n.kind === 'badge' || n.kind === 'pb' || n.kind === 'self') {
      this.noticeQueue.unshift({ kind: n.kind, title: n.title, body: n.body, ms: 4_000 })
    }
    this.notice = null
    return true
  }

  private hasBadge(id: BadgeId): boolean {
    return this.store.data.judgeMode ? this.judgeBadges.has(id) : Boolean(this.store.data.badges[id])
  }

  private award(id: BadgeId): void {
    if (this.hasBadge(id)) return
    if (this.store.data.judgeMode) this.judgeBadges.add(id)
    else {
      this.store.data.badges[id] = Date.now()
      this.store.save()
    }
    const b = BADGES[id]
    this.noticeQueue.push({
      kind: 'badge',
      title: `Badge: ${b.title}`,
      body: b.accessory ? `${b.desc}\n${this.store.data.pet.name} earned ${ACCESSORY_NAMES[b.accessory]}.` : b.desc,
      ms: 5_000,
    })
    diagEvent('badge', id)
  }

  /** Count-based badges (only for real use; judge runs are too short to count) */
  private checkBadges(now: number): void {
    const d = this.store.data
    const h = new Date(now).getHours()
    if (h >= 22 || h < 5) this.award('night_owl')
    if (d.judgeMode) return
    const repairs = d.recoveries.filter((r) => r.resetId === 'repair').length
    if (repairs >= 3) this.award('peacemaker')
    if (d.recoveries.filter((r) => r.resetId !== 'repair').length >= 10) this.award('storm_chaser')
    if (d.kindness.length >= 10) this.award('kind_soul')
    if (d.selfRecoveries >= 3) this.award('zen_master')
  }

  private personalBest(ms: number): void {
    const d = this.store.data
    const prev = d.judgeMode ? this.judgePbMs : d.pbMs
    if (prev && ms >= prev) return
    if (d.judgeMode) this.judgePbMs = ms
    else {
      d.pbMs = ms
      this.store.save()
    }
    if (prev) {
      this.noticeQueue.unshift({
        kind: 'pb',
        title: 'New personal best!',
        body: `Back in ${fmtDuration(ms)}\n(was ${fmtDuration(prev)})`,
        ms: 4_500,
      })
      diagEvent('personal_best', { ms, prev })
    }
  }

  /** The real goal: coming back before Mochi has to step in */
  private selfRecovered(now: number, since: number): void {
    const d = this.store.data
    const before = stageFor(d.pet.recoveries, true)
    d.selfRecoveries++
    d.pet.recoveries++
    d.recoveries.push({ spikeAt: since, recoveredAt: now, resetId: 'self', bounceBackMs: now - since })
    this.store.save()
    this.noticeQueue.unshift({
      kind: 'self',
      title: 'You came back on your own.',
      body: `That's the real goal.\n${d.pet.name} grew.`,
      ms: 6_000,
    })
    if (stageFor(d.pet.recoveries, true) !== before) this.celebrate = { kind: 'evolving', bounceMs: now - since }
    this.award('first_self')
    this.personalBest(now - since)
    this.checkBadges(now)
    diagEvent('self_recovery', { ms: now - since })
  }

  accessories() {
    const d = this.store.data
    return accessoriesFor(d.judgeMode ? this.judgeBadges : (Object.keys(d.badges) as BadgeId[]))
  }

  /** For the phone's trophy case */
  trophies(): { id: BadgeId; unlocked: boolean }[] {
    return (Object.keys(BADGES) as BadgeId[]).map((id) => ({ id, unlocked: this.hasBadge(id) }))
  }

  private async onOtherUtterance(u: Utterance): Promise<void> {
    if (!this.backendStt) return
    const theirs = await api.analyze({
      audioBase64: wavBase64(u.pcm),
      durationMs: u.durationMs,
      voicedMs: u.voicedMs,
      prosody: { loudnessRatio: 1, pitchRatio: 0 },
      petName: this.store.data.pet.name,
      speaker: 'other',
    })
    if (theirs) this.onOtherMood(theirs.classification.label, theirs.classification.intensity)
  }

  /** Read the room: the person you're talking to sounds stressed → a private nudge to check in */
  private onOtherMood(label: MoodLabel, intensity: number): void {
    const now = Date.now()
    if (label === 'clear' || intensity < 0.55) return
    if (this.phase !== 'idle' || now - this.lastRoomCueAt < this.timings().socialCooldownMs) return
    if (!this.makeRoomForCue()) return
    this.lastRoomCueAt = now
    this.careWindowUntil = now + 45_000
    this.notice = {
      kind: 'room',
      title: label === 'fog' ? 'They sound low.' : 'They sound stressed.',
      body: "Maybe ask how\nthey're doing.",
      until: now + 9_000,
    }
    this.judgeMark('room')
    diagEvent('room_cue', label)
    this.changed()
  }

  private completeRepair(now: number): void {
    const d = this.store.data
    const since = this.repairWindow?.since ?? now
    this.repairWindow = null
    this.notice = null
    const before = stageFor(d.pet.recoveries, true)
    d.pet.recoveries++
    d.recoveries.push({ spikeAt: since, recoveredAt: now, resetId: 'repair', bounceBackMs: now - since })
    if (d.judgeMode) this.mood = new MoodEngine(() => this.timings())
    const evolved = stageFor(d.pet.recoveries, true) !== before
    if (evolved) this.celebrate = { kind: 'evolving', bounceMs: now - since }
    this.store.save()
    this.judgeMark('repair')
    if (this.judgeStep === 2) this.judgeStep = 3
    this.award('first_repair')
    this.personalBest(now - since)
    this.checkBadges(now)
    this.bloomText = 'Nice repair.\n\nThat takes guts.\nMochi grew.'
    this.setPhase('bloom', 5000)
    diagEvent('repair_done', { ms: now - since, evolved })
  }

  /** Storm forecast: patterns from topic tags and times (needs a few days of data to say anything) */
  forecast(): { topics: Array<[string, number]>; hour: number | null; line: string } {
    const d = this.store.data
    const weekAgo = Date.now() - 7 * 86_400_000
    const recent = d.storms.filter((x) => x.t >= weekAgo)
    const counts = new Map<string, number>()
    for (const x of recent) counts.set(x.topic, (counts.get(x.topic) ?? 0) + 1)
    const topics = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5)
    // An hour counts as risky when storms happened in it on 2+ different days
    const days = new Map<number, Set<string>>()
    for (const x of recent) {
      const dt = new Date(x.t)
      const set = days.get(dt.getHours()) ?? new Set<string>()
      set.add(dt.toDateString())
      days.set(dt.getHours(), set)
    }
    const risky = [...days.entries()].filter(([, s]) => s.size >= 2).sort((a, b) => b[1].size - a[1].size)[0]
    const hour = risky ? risky[0] : null
    const top = topics[0] && topics[0][1] >= 2 ? topics[0][0] : null
    const line = top
      ? `"${cap(top)}" keeps coming up in your storms.`
      : hour !== null
        ? `Around ${fmtHour(hour)} tends to get tense.`
        : ''
    return { topics, hour, line }
  }

  private maybeForecast(now: number): void {
    const d = this.store.data
    if (d.judgeMode || this.phase !== 'idle' || this.notice || this.pending) return
    const f = this.forecast()
    if (!f.line) return
    // Once per session, a few seconds after opening
    if (!this.forecastShown && now - this.sessionStartedAt > 8_000) {
      this.forecastShown = true
      this.notice = { kind: 'forecast', title: 'Storm forecast', body: `${f.line}\nI'll keep watch.`, until: now + 8_000 }
      diagEvent('forecast', f.line)
      return
    }
    // Heads-up at the start of a risky hour, once a day
    const dt = new Date(now)
    const day = dt.toISOString().slice(0, 10)
    if (f.hour !== null && dt.getHours() === f.hour && dt.getMinutes() < 10 && d.forecastDay !== day) {
      d.forecastDay = day
      this.store.save()
      this.notice = {
        kind: 'forecast',
        title: `It's ${fmtHour(f.hour)}.`,
        body: 'This hour often gets tense.\nOne slow breath first?',
        until: now + 10_000,
      }
      diagEvent('forecast_hour', f.hour)
    }
  }

  // ── Conversation tracking ───────────────────────────────────

  private noteSpeech(who: 'self' | 'other'): void {
    const now = Date.now()
    if (who === 'self') this.lastSelfAt = now
    else this.lastOtherAt = now
    if (this.convo) {
      this.convo.lastSpeechAt = now
      return
    }
    // Both voices within the last 45s = a back-and-forth conversation
    if (this.lastSelfAt && this.lastOtherAt && Math.abs(this.lastSelfAt - this.lastOtherAt) < 45_000) {
      this.convo = { startedAt: Math.min(this.lastSelfAt, this.lastOtherAt), lastSpeechAt: now, tense: 0, storm: 0, fog: 0 }
      // A nudge already on the lens steps aside; its tension carries into the debrief
      if (this.phase === 'nudged' && this.pending) {
        if (this.pending.kind === 'fog') this.convo.fog++
        else this.convo.storm++
        this.convo.tense++
        this.pending = null
        this.setPhase('idle')
      }
      diagEvent('convo_start')
    }
  }

  // ── Voice setup ─────────────────────────────────────────────

  /**
   * The glasses tag each audio frame as the wearer or someone else, but the tag flickers. Reading three
   * sentences shows how often YOUR speech gets tagged as you; the threshold for "this utterance is
   * the wearer" is set well below that, so your voice always counts and other people's doesn't.
   */
  startVoiceCheck(): void {
    if (this.phase === 'hatching') return
    this.active = null
    this.voiceStep = 0
    this.voiceSamples = []
    this.store.data.baseline.selfRatio = []
    this.segmenter.selfThreshold = 0 // accept everything while sampling
    this.segmenter.useVoiceprint = false
    this.setPhase('voicecheck', 60_000)
    diagEvent('voice_check_start')
    this.changed()
  }

  private recordVoiceSample(u: Utterance): void {
    if (u.selfRatio !== null) pushCapped(this.store.data.baseline.selfRatio, Math.max(u.selfRatio, 0.01))
    if (u.voice) this.voiceSamples.push(u.voice)
    this.voiceStep++
    if (this.voiceStep >= VOICE_LINES.length) {
      this.applyVoiceThreshold()
      // Voice fingerprint from the three sentences
      const vp = buildVoiceprint(this.voiceSamples)
      if (vp) this.store.data.voiceprint = vp
      this.applyVoiceprint()
      this.store.save()
      this.hud.caption = vp
        ? `Voiceprint saved (${vp.samples} sentences, ~${Math.round(vp.pitch)} Hz). Only your voice counts now.`
        : `Voice tuned: your speech is tagged as you ${Math.round(median(this.store.data.baseline.selfRatio, 0) * 100)}% of the time`
      diagEvent('voice_check_done', {
        samples: this.store.data.baseline.selfRatio,
        threshold: this.segmenter.selfThreshold,
        voiceprint: vp ? { pitch: Math.round(vp.pitch), threshold: Math.round(vp.threshold * 100) } : null,
      })
      this.setPhase('idle')
    }
    this.changed()
  }

  /** Voiceprint on in normal use, off in judge mode (a judge's voice won't match the owner's) */
  private applyVoiceprint(): void {
    this.segmenter.voiceprint = this.store.data.voiceprint
    this.segmenter.useVoiceprint = !this.store.data.judgeMode
  }

  clearVoiceprint(): void {
    this.store.data.voiceprint = null
    this.applyVoiceprint()
    this.store.save()
    this.changed()
  }

  private applyVoiceThreshold(): void {
    const ratios = this.store.data.baseline.selfRatio
    // Untuned: a low default. Tuned: under half your typical share, clamped to a sane band.
    const t = ratios.length ? Math.min(0.3, Math.max(0.06, median(ratios, 0.3) * 0.45)) : 0.15
    this.segmenter.selfThreshold = t
    diag.selfThreshold = Math.round(t * 100) / 100
  }

  // ── State machine ───────────────────────────────────────────

  private hatch(): void {
    const pet = this.store.data.pet
    if (pet.hatched) return
    pet.hatched = true
    this.store.data.onboarded = true
    this.store.save()
    this.celebrate = { kind: 'evolving', bounceMs: 0 }
    this.setPhase('evolving', 8000)
    diagEvent('hatched')
  }

  private evaluate(now = Date.now()): void {
    this.lastEval = now
    const t = this.timings()
    const d = this.store.data

    // Did a reset lead to real recovery?
    if (this.watch) {
      if (this.mood.isRecovered(now)) {
        this.recordRecovery(now)
      } else if (now > this.watch.until) {
        diagEvent('recovery_window_expired', this.watch.resetId)
        this.watch = null
      }
    }

    // A waiting reset whose storm passed on its own goes away, but never while the nudge is on the
    // lens (someone may be reading it) and never in judge mode (the guided run waits for the tap)
    if (this.pending && this.phase !== 'nudged' && !this.judgeMode && this.mood.isRecovered(now)) {
      this.pending = null
    }

    // Calmed down on your own: a storm that clears with no reset in between
    if (!d.judgeMode) {
      const w = this.mood.snapshot(now).weather
      if (!this.selfWatch && (w === 'stormy' || w === 'foggy') && !this.active && !this.watch) {
        this.selfWatch = { since: now, assisted: false }
      }
      if (this.selfWatch && (this.active || this.watch)) this.selfWatch.assisted = true
      if (this.selfWatch && this.mood.isRecovered(now)) {
        const sw = this.selfWatch
        this.selfWatch = null
        if (!sw.assisted && now - sw.since > 8_000 && this.phase === 'idle') this.selfRecovered(now, sw.since)
      }
    }

    // Conversation ended (everyone quiet): offer the debrief if it got tense
    if (this.convo && now - this.convo.lastSpeechAt > t.convoGapMs) {
      const c = this.convo
      this.convo = null
      diagEvent('convo_end', { tense: c.tense, minutes: Math.round((now - c.startedAt) / 60000) })
      if (
        c.tense >= t.debriefMinTense &&
        this.phase === 'idle' &&
        !this.pending &&
        !this.watch &&
        now > this.quietUntil
      ) {
        this.pending = { kind: c.fog > c.storm ? 'fog' : 'storm', since: c.startedAt }
        this.debrief = true
        this.nudgeShownAt = now
        this.setPhase('nudged')
        this.judgeMark('convo')
        diagEvent('debrief', this.pending.kind)
      }
    }

    // New spike → nudge (held while a conversation is going on)
    if (
      !this.convo &&
      !this.repairWindow &&
      this.phase === 'idle' &&
      !this.pending &&
      !this.watch &&
      now - this.lastResetEndedAt > t.cooldownMs &&
      now > this.quietUntil
    ) {
      const spike = this.mood.spike(now)
      if (spike) {
        this.pending = spike
        this.debrief = false
        this.nudgeShownAt = now
        this.setPhase('nudged')
        diagEvent('nudge', spike.kind)
      }
    }

    // Celebrations wait until nothing else is on screen
    if (this.celebrate && this.phase === 'idle') {
      this.setPhase(this.celebrate.kind, this.celebrate.kind === 'evolving' ? 9000 : 6000)
    }
  }

  private recordRecovery(now: number): void {
    const w = this.watch!
    const d = this.store.data
    const before = stageFor(d.pet.recoveries, true)
    const bounceMs = now - w.spikeAt
    d.pet.recoveries++
    d.resetStats[w.resetId].recovered++
    d.recoveries.push({ spikeAt: w.spikeAt, recoveredAt: now, resetId: w.resetId, bounceBackMs: bounceMs })
    this.watch = null
    // Judge mode: each round starts under a clear sky, so the next vent isn't diluted by this calm-down
    if (d.judgeMode) this.mood = new MoodEngine(() => this.timings())
    this.store.save()
    const evolved = stageFor(d.pet.recoveries, true) !== before
    this.celebrate = { kind: evolved ? 'evolving' : 'cleared', bounceMs }
    this.judgeMark('storm')
    if (this.judgeStep === 0 || this.judgeStep === 3) this.judgeStep++
    this.selfWatch = null
    this.personalBest(bounceMs)
    this.checkBadges(now)
    diagEvent('recovered', { bounceMs, evolved })
  }

  private startReset(kind: 'storm' | 'fog', exclude: ResetId[] = []): void {
    const now = Date.now()
    // Judge mode keeps to the quick spoken resets (no 30s breathing, no sensor calibration)
    const judgeSkip: ResetId[] = this.judgeMode ? ['breathe', 'look_up'] : []
    const id = pickReset(kind, this.store.data.resetStats, {
      imuAvailable: this.head.available,
      exclude: [...exclude, ...judgeSkip],
    })
    this.store.data.resetStats[id].offered++
    this.store.save()
    if (this.selfWatch) this.selfWatch.assisted = true
    if (RESETS[id].verify === 'imu') this.head.setBaseline()
    this.active = {
      id,
      kind,
      startedAt: now,
      attempts: 0,
      tried: [...exclude, id],
      message: '',
      progress: 0,
      breathStart: now,
      lookAccumMs: 0,
      lastTick: now,
    }
    this.setPhase('active')
    diagEvent('reset_start', id)
  }

  private switchReset(): void {
    const a = this.active
    if (!a) return
    const tried = a.tried
    const remaining = (Object.keys(RESETS) as ResetId[]).filter(
      (id) =>
        !tried.includes(id) &&
        RESETS[id].fits.includes(a.kind) &&
        !(this.judgeMode && (id === 'breathe' || id === 'look_up')),
    )
    this.startReset(a.kind, remaining.length ? tried : [a.id])
  }

  private completeReset(): void {
    const a = this.active
    if (!a) return
    const now = Date.now()
    this.store.data.resetStats[a.id].completed++
    this.watch = {
      spikeAt: this.pending?.since ?? a.startedAt,
      resetId: a.id,
      until: now + this.timings().recoveryWatchMs,
    }
    this.pending = null
    this.active = null
    this.lastResetEndedAt = now
    this.store.save()
    this.setPhase('bloom', 6000)
    diagEvent('reset_complete', a.id)
  }

  private endReset(message: string): void {
    this.active = null
    this.pending = null
    this.lastResetEndedAt = Date.now()
    this.hud.caption = message
    this.toIdle()
  }

  private dismissNudge(): void {
    this.pending = null
    this.lastResetEndedAt = Date.now()
    this.toIdle()
  }

  private showCrisis(): void {
    this.active = null
    this.pending = null
    this.setPhase('crisis')
    diagEvent('crisis_screen')
  }

  private toIdle(): void {
    this.bloomText = ''
    if (this.phase === 'cleared' || this.phase === 'evolving') this.celebrate = null
    this.setPhase('idle')
  }

  private setPhase(p: Phase, durationMs = 0): void {
    if (p === 'idle') this.ambientShowUntil = Date.now() + 5000
    this.phase = p
    this.phaseUntil = durationMs ? Date.now() + durationMs : 0
    if (p !== 'idle') this.cardUntil = 0
  }

  // ── Clock ───────────────────────────────────────────────────

  private tick(): void {
    const now = Date.now()
    this.frame++

    if (this.phaseUntil && now > this.phaseUntil) {
      this.phaseUntil = 0
      if (this.phase === 'voicecheck') {
        this.applyVoiceThreshold()
        this.applyVoiceprint()
      }
      if (['bloom', 'cleared', 'evolving', 'voicecheck', 'intro'].includes(this.phase)) this.toIdle()
    }
    if (this.phase === 'nudged' && now - this.nudgeShownAt > this.timings().nudgeVisibleMs) {
      this.setPhase('idle') // still pending: tap from ambient starts it
    }
    if (this.phase === 'active' && this.active) this.tickReset(now)
    if (this.notice && now > this.notice.until) this.notice = null
    if (!this.notice && this.phase === 'idle' && !this.celebrate && this.noticeQueue.length) {
      const q = this.noticeQueue.shift()!
      this.notice = { kind: q.kind, title: q.title, body: q.body, until: now + q.ms }
    }
    if (this.repairWindow && now > this.repairWindow.until) this.repairWindow = null
    if (now - this.lastEval > 2000) {
      this.evaluate(now)
      this.maybeForecast(now)
    }

    void this.hud.render(this.view(now))
    if (this.frame % 4 === 0) this.changed()
  }

  private tickReset(now: number): void {
    const a = this.active!
    const def = RESETS[a.id]
    const dt = now - a.lastTick
    a.lastTick = now

    if (now - a.startedAt > def.timeoutMs) {
      this.endReset('No worries. I\'m here when you need me.')
      return
    }
    if (def.verify === 'imu') {
      if (this.head.tiltDeg() >= LOOK_UP.tiltDeg) a.lookAccumMs += dt
      a.progress = a.lookAccumMs / LOOK_UP.holdMs
      if (a.progress >= 1) this.completeReset()
    } else if (def.verify === 'breath') {
      const total = (BREATH.inMs + BREATH.outMs) * BREATH.cycles
      a.progress = (now - a.breathStart) / total
      if (a.progress >= 1) this.completeReset()
    }
  }

  // ── Lens view ───────────────────────────────────────────────

  private view(now: number): HudFrame {
    const d = this.store.data
    const pet = d.pet
    const snap = this.mood.snapshot(now)
    const stage = stageFor(pet.recoveries, pet.hatched)
    const glow = pet.sunlight >= 3
    const accessories = this.accessories()
    const base = (o: Partial<Omit<SpriteSpec, 'w' | 'h'>> = {}): Omit<SpriteSpec, 'w' | 'h'> => ({
      accessories,
      stage,
      face: faceFor(snap.weather),
      weather: snap.weather,
      scale: 1,
      effect: 'none',
      glow,
      frame: 0,
      ...o,
    })
    const next = nextStage(pet.recoveries)
    const toNext = next ? `${next.at - pet.recoveries} more to ${next.label}` : 'Fully evolved'

    switch (this.phase) {
      case 'hatching': {
        const wobble = Math.floor(this.frame / 3) % 4 === 0 ? 1.04 : 1
        return wideFrame(base({ stage: 'egg', weather: 'none', scale: wobble, frame: 0 }), `An egg is waiting.\nSay "Hi ${pet.name}" out loud to hatch it.`)
      }
      case 'nudged': {
        const body = this.debrief
          ? this.pending?.kind === 'fog'
            ? 'That one was heavy.\n\nTap when you\'re free\nfor 30 seconds.'
            : 'That got tense.\n\nTap when you\'re free\nfor 30 seconds.'
          : this.pending?.kind === 'fog'
            ? 'Feeling heavy?\n\nTap when you have\n30 seconds.'
            : 'Storm brewing.\n\nTap when you have\n30 seconds.'
        return cardFrame(base({ face: this.pending?.kind === 'fog' ? 'sad' : 'worried' }), body, 'swipe: not now')
      }
      case 'active': {
        const a = this.active!
        const def = RESETS[a.id]
        const prompt = def.prompt.replace('{name}', pet.name)
        let status = this.checking ? 'Checking...' : a.message || 'Listening...'
        let sprite = base({ face: 'neutral' })
        if (def.verify === 'imu') {
          const left = Math.max(0, Math.ceil((LOOK_UP.holdMs - a.lookAccumMs) / 1000))
          status = this.head.available ? `${bar(a.progress)} ${left}s` : 'Waiting for head movement...'
        } else if (def.verify === 'breath') {
          const cycle = BREATH.inMs + BREATH.outMs
          const t = (now - a.breathStart) % cycle
          const inhale = t < BREATH.inMs
          const k = inhale ? t / BREATH.inMs : 1 - (t - BREATH.inMs) / BREATH.outMs
          const scale = Math.round((0.8 + 0.4 * easeInOut(k)) * 20) / 20
          const n = Math.min(BREATH.cycles, Math.floor((now - a.breathStart) / cycle) + 1)
          status = a.message || `${inhale ? 'Breathe in...' : 'Breathe out...'}  ${n}/${BREATH.cycles}`
          sprite = base({ face: 'calm', weather: 'none', scale })
        }
        return cardFrame(sprite, `${def.title}\n\n${prompt}\n\n${status}`, 'swipe: another   2x tap: stop')
      }
      case 'bloom':
        return cardFrame(
          base({ face: 'happy', weather: 'none', effect: 'bloom', frame: Math.floor(this.frame / 2) }),
          this.bloomText || "You came back.\n\nStorm -> bloom.\nI'll keep watch with you.",
          '',
        )
      case 'cleared': {
        const mins = Math.max(1, Math.round((this.celebrate?.bounceMs ?? 0) / 60000))
        return cardFrame(
          base({ face: 'happy', weather: 'clear', effect: 'bloom', frame: Math.floor(this.frame / 2) }),
          `Clear skies.\n\n+1 recovery (${pet.recoveries})\nBounced back in ${mins} min`,
          toNext,
        )
      }
      case 'evolving': {
        const hatchOnly = pet.recoveries === 0
        const caption = hatchOnly
          ? `${pet.name} hatched!\nIt grows every time you bounce back from stress.`
          : stage === 'zenith'
            ? d.judgeMode
              ? `ZENITH! ${pet.name} is fully grown.\nYou bounced back ${pet.recoveries} times.`
              : `ZENITH. ${pet.name} is fully grown.\n${zenithLine(d.recoveries.map((r) => r.bounceBackMs))}`
            : `${pet.name} evolved into a ${stageLabel(stage).toUpperCase()}!\n${pet.recoveries} recoveries. ${toNext}.`
        return wideFrame(base({ face: 'happy', weather: 'none', effect: 'evolve', frame: Math.floor(this.frame / 2) }), caption)
      }
      case 'intro':
        return wideFrame(
          base({ face: 'happy', weather: 'none', effect: 'bloom', frame: Math.floor(this.frame / 2) }),
          "Hi, I'm Mochi.\nI help you bounce back from stress. Let's grow me to Zenith.",
        )
      case 'voicecheck': {
        const i = Math.min(this.voiceStep, VOICE_LINES.length - 1)
        return cardFrame(
          base({ face: 'calm', weather: 'none' }),
          `Voice check  ${this.voiceStep + 1}/${VOICE_LINES.length}\n\nRead aloud, normally:\n"${VOICE_LINES[i]}"`,
          'quiet room helps   2x tap: cancel',
        )
      }
      case 'crisis':
        return textFrame(
          `You matter.\n\nThat sounded really heavy. Please reach\nout to someone you trust and let them\nknow how you're feeling.\n\ntap to close`,
        )
      case 'idle':
      default: {
        const n = this.notice
        if (n && now < n.until) {
          if (n.kind === 'kind') {
            return ambientFrame(base({ face: 'happy', effect: 'bloom', frame: Math.floor(this.frame / 2) }), n.title, true)
          }
          const face = n.kind === 'repair' ? 'worried' : n.kind === 'room' ? 'calm' : n.kind === 'forecast' ? 'neutral' : 'happy'
          const hint =
            n.kind === 'repair' ? 'just say it to them' : n.kind === 'room' ? 'only you can see this' : n.kind === 'badge' ? 'new badge' : ''
          if (n.kind === 'badge' || n.kind === 'self' || n.kind === 'pb') {
            return cardFrame(base({ face, effect: 'bloom', frame: Math.floor(this.frame / 2), glow: true }), `${n.title}\n\n${n.body}`, hint)
          }
          return cardFrame(base({ face }), `${n.title}\n\n${n.body}`, hint)
        }
        if (d.judgeMode) return this.judgeView(base, stage, snap.weather)
        if (now < this.cardUntil) {
          const body = `${pet.name}  -  ${stageLabel(stage)}\nSky: ${snap.weather}\n\nRecoveries: ${pet.recoveries}\n${toNext}`
          return cardFrame(base(), body, this.pending ? 'tap: start a reset' : 'swipe: judge tour  ·  say "learn my voice"')
        }
        const whisper = now < this.whisperUntil
        // Quiet lens: while you work, the lens is empty. It reappears briefly when the sky changes.
        if (snap.weather !== this.lastWeather) {
          this.lastWeather = snap.weather
          this.ambientShowUntil = now + 6000
        }
        const quiet = d.blankLens && !whisper && !this.pending && this.speechReady && now > this.ambientShowUntil
        if (quiet) return ambientFrame(base({ hidden: true }), ' ', false)
        const line = whisper
          ? 'slow down...'
          : !this.speechReady
            ? `${pet.name}: can't understand words yet (setup on phone)`
            : `${pet.name}: ${snap.weather}${this.pending ? '   (tap: reset)' : ''}`
        return ambientFrame(base(), line, whisper || Boolean(this.pending))
      }
    }
  }

  private judgeMark(f: JudgeFeature): void {
    if (this.store.data.judgeMode) this.judgeDone.add(f)
  }

  judgeSkip(): void {
    if (!this.judgeMode) return
    this.judgeStep = Math.min(4, this.judgeStep + 1)
    this.notice = null
    this.repairWindow = null
    diagEvent('judge_skip', this.judgeStep)
    this.changed()
  }

  /** For the phone's judge checklist */
  judgeProgress(): { step: number; done: JudgeFeature[] } {
    return { step: this.judgeStep, done: [...this.judgeDone] }
  }

  private judgeSummary(): string {
    const topics = [...new Set(this.store.data.storms.filter((x) => x.t >= this.judgeStartedAt).map((x) => x.topic))].slice(0, 3)
    this.judgeMark('forecast')
    const about = topics.slice(0, 2).map((t) => t.slice(0, 10)).join(', ')
    const extras = [
      this.judgeDone.has('repair') ? 'repair' : '',
      this.judgeDone.has('kind') ? 'kindness' : '',
      this.judgeDone.has('room') ? 'room' : '',
    ].filter(Boolean)
    const worn = this.accessories()
    const lines = ["ZENITH! That's AuraPet."]
    if (about) lines.push(`Storms: ${about}`)
    if (extras.length) lines.push(`Did: ${extras.join(', ')}`)
    if (worn.length) lines.push(`Earned: ${worn.join(', ')}`)
    return lines.join('\n')
  }

  /** Judge mode idle screen: always tells the wearer exactly what to say next */
  private judgeView(
    base: (o?: Partial<Omit<SpriteSpec, 'w' | 'h'>>) => Omit<SpriteSpec, 'w' | 'h'>,
    stage: StageId,
    weather: Weather,
  ): HudFrame {
    const n = this.store.data.pet.recoveries
    const left = Math.max(0, 3 - n)
    if (stage === 'zenith') {
      return cardFrame(
        base({ face: 'happy', weather: 'none', glow: true }),
        this.judgeSummary(),
        '2x tap: try again',
      )
    }
    const hint = `${stageLabel(stage)} · ${left} to Zenith`
    if (this.watch) {
      return cardFrame(base({ face: 'happy', weather: 'none' }), 'Now say something calm,\nlike "Okay. I\'ve got this."', hint)
    }
    if (this.pending) return cardFrame(base({ face: 'worried' }), 'Tap to start a reset.', hint)
    if (this.convo) {
      return cardFrame(base({ face: 'calm' }), "I'm listening.\nI'll wait until you're\ndone talking.", hint)
    }
    if (weather === 'stormy' && (this.judgeStep === 0 || this.judgeStep >= 4)) {
      return cardFrame(base(), 'Keep going...\ntell me more.', hint)
    }
    const step = this.judgeStep
    const tour: Array<[string, string]> = [
      ['1/4  Tell me about the last\ntime work stressed you out.', hint],
      ['2/4  Thank someone nearby:\n"Thanks for showing me this."', 'swipe: skip'],
      ['3/4  Snap at someone\n(jokingly): "Whatever,\ndo it yourself."', 'swipe: skip'],
      ['4/4  Chat with the person\nnext to you about a\nstressful deadline.', 'alone? swipe: skip'],
      ['One more: what stresses\nyou about deadlines?', hint],
    ]
    const [text, h] = tour[Math.min(step, tour.length - 1)]
    return cardFrame(base(), text, h)
  }

  private changed(): void {
    const s = this.snapshot()
    this.changeFns.forEach((fn) => fn(s))
  }
}

function normTopic(t: string): string {
  const w = t.trim().toLowerCase()
  return w.length > 4 && w.endsWith('s') && !w.endsWith('ss') ? w.slice(0, -1) : w
}

function kindToday(list: Array<{ t: number }>): number {
  const start = new Date()
  start.setHours(0, 0, 0, 0)
  return list.filter((k) => k.t >= start.getTime()).length
}

function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

function fmtHour(h: number): string {
  return `${h % 12 === 0 ? 12 : h % 12}${h < 12 ? 'am' : 'pm'}`
}

/** The end goal: not "be happy", but "come back faster" */
function zenithLine(bounces: number[]): string {
  if (bounces.length < 2) return 'You came back from stress again and again.'
  const mins = (ms: number) => Math.max(1, Math.round(ms / 60000))
  const first = bounces.slice(0, 3)
  const last = bounces.slice(-3)
  const avg = (a: number[]) => a.reduce((x, y) => x + y, 0) / a.length
  return `You bounce back in ${mins(avg(last))} min now (it used to take ${mins(avg(first))}).`
}

function faceFor(w: Weather): Face {
  return w === 'stormy' ? 'worried' : w === 'foggy' ? 'sad' : w === 'cloudy' ? 'neutral' : 'happy'
}

function easeInOut(k: number): number {
  return k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2
}

function pushCapped(arr: number[], v: number): void {
  if (!Number.isFinite(v) || v <= 0) return
  arr.push(v)
  if (arr.length > MAX_BASELINE) arr.shift()
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}
