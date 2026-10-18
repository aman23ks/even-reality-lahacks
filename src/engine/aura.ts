/**
 * src/engine/aura.ts — AuraPet's brain.
 *
 *   listen → detect a sustained spiral → nudge → one verified reset → bloom → watch for real recovery → grow
 *
 * Plus: "slow down" pace whisper, crisis safety screen, hatching, and the lens view for every phase.
 */

import { DEMO_TIMINGS, NORMAL_TIMINGS, type Timings } from '../config'
import type { Glasses } from '../platform/glasses'
import type { Segmenter, Utterance } from '../audio/segmenter'
import { wavBase64 } from '../audio/segmenter'
import type { HudRenderer } from '../hud/renderer'
import { ambientFrame, bar, cardFrame, textFrame, wideFrame, type HudFrame } from '../hud/frames'
import type { Face, SpriteSpec } from '../hud/sprite'
import { api } from '../api'
import type { InputType, MoodLabel, ResetId, StageId, UtteranceResult, Weather } from '../types'
import { MoodEngine, type MoodSnapshot } from './mood'
import { BREATH, LOOK_UP, RESETS, pickReset } from './resets'
import { Store, median, nextStage, stageFor, stageLabel } from './store'
import type { HeadTracker } from './imu'
import { diag, diagEvent } from '../diagnostics'

export type Phase = 'hatching' | 'idle' | 'nudged' | 'active' | 'bloom' | 'cleared' | 'evolving' | 'crisis' | 'voicecheck'

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
}

const MAX_BASELINE = 40

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
    this.applyVoiceThreshold()

    glasses.onInput((t) => this.onInput(t))
    segmenter.onUtterance((u) => void this.onUtterance(u))
    segmenter.onSpeechStart(() => this.onSpeechStart())
    segmenter.onOtherSpeaker(() => {
      this.hud.caption = 'Someone else is talking - ignored'
      this.changed()
    })
    setInterval(() => this.tick(), 250)
  }

  timings(): Timings {
    return this.store.data.demoMode ? DEMO_TIMINGS : NORMAL_TIMINGS
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
          this.toIdle()
        }
        break
      case 'idle':
        if (t === 'long_press') {
          this.startVoiceCheck()
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
    this.store.data.baseline.selfRatio = []
    this.segmenter.selfThreshold = 0 // accept everything while sampling
    this.setPhase('voicecheck', 60_000)
    diagEvent('voice_check_start')
    this.changed()
  }

  private recordVoiceSample(u: Utterance): void {
    if (u.selfRatio !== null) pushCapped(this.store.data.baseline.selfRatio, Math.max(u.selfRatio, 0.01))
    this.voiceStep++
    if (this.voiceStep >= VOICE_LINES.length) {
      this.applyVoiceThreshold()
      this.store.save()
      this.hud.caption = `Voice tuned: your speech is tagged as you ${Math.round(median(this.store.data.baseline.selfRatio, 0) * 100)}% of the time`
      diagEvent('voice_check_done', { samples: this.store.data.baseline.selfRatio, threshold: this.segmenter.selfThreshold })
      this.setPhase('idle')
    }
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

    // Did a reset lead to real recovery?
    if (this.watch) {
      if (this.mood.isRecovered(now)) {
        this.recordRecovery(now)
      } else if (now > this.watch.until) {
        diagEvent('recovery_window_expired', this.watch.resetId)
        this.watch = null
      }
    }

    // Pending spike that resolved on its own
    if (this.pending && this.mood.isRecovered(now)) {
      this.pending = null
      if (this.phase === 'nudged') this.toIdle()
    }

    // New spike → nudge
    if (
      this.phase === 'idle' &&
      !this.pending &&
      !this.watch &&
      now - this.lastResetEndedAt > t.cooldownMs &&
      now > this.quietUntil
    ) {
      const spike = this.mood.spike(now)
      if (spike) {
        this.pending = spike
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
    this.store.save()
    const evolved = stageFor(d.pet.recoveries, true) !== before
    this.celebrate = { kind: evolved ? 'evolving' : 'cleared', bounceMs }
    diagEvent('recovered', { bounceMs, evolved })
  }

  private startReset(kind: 'storm' | 'fog', exclude: ResetId[] = []): void {
    const now = Date.now()
    const id = pickReset(kind, this.store.data.resetStats, { imuAvailable: this.head.available, exclude })
    this.store.data.resetStats[id].offered++
    this.store.save()
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
      (id) => !tried.includes(id) && RESETS[id].fits.includes(a.kind),
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
      if (this.phase === 'voicecheck') this.applyVoiceThreshold()
      if (this.phase === 'bloom' || this.phase === 'cleared' || this.phase === 'evolving' || this.phase === 'voicecheck') this.toIdle()
    }
    if (this.phase === 'nudged' && now - this.nudgeShownAt > this.timings().nudgeVisibleMs) {
      this.setPhase('idle') // still pending: tap from ambient starts it
    }
    if (this.phase === 'active' && this.active) this.tickReset(now)
    if (now - this.lastEval > 2000) this.evaluate(now)

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
    const base = (o: Partial<Omit<SpriteSpec, 'w' | 'h'>> = {}): Omit<SpriteSpec, 'w' | 'h'> => ({
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
        const body =
          this.pending?.kind === 'fog'
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
          "You came back.\n\nStorm -> bloom.\nI'll keep watch with you.",
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
            ? `ZENITH. ${pet.name} is fully grown.\n${zenithLine(d.recoveries.map((r) => r.bounceBackMs))}`
            : `${pet.name} evolved into a ${stageLabel(stage).toUpperCase()}!\n${pet.recoveries} recoveries. ${toNext}.`
        return wideFrame(base({ face: 'happy', weather: 'none', effect: 'evolve', frame: Math.floor(this.frame / 2) }), caption)
      }
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
        if (now < this.cardUntil) {
          const body = `${pet.name}  -  ${stageLabel(stage)}\nSky: ${snap.weather}\n\nRecoveries: ${pet.recoveries}\n${toNext}`
          return cardFrame(base(), body, this.pending ? 'tap: start a reset' : 'tap: close')
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

  private changed(): void {
    const s = this.snapshot()
    this.changeFns.forEach((fn) => fn(s))
  }
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
