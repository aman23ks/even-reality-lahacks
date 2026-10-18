/**
 * src/audio/voiceAnalyzer.ts — Voice Fingerprinting & Emotion Analysis Engine
 * 
 * Works with:
 * 1. Even G2 Glasses Mic (bridge.audioControl + audioEvent raw PCM)
 * 2. Phone / Browser Mic (Web Audio API fallback)
 */

import type { EmotionType, EmotionReading, VoiceFingerprint, SpeechTranscriptionRecord } from '../types/pet'
import { AudioSpeakerRole, AudioInputSource, type EvenAppBridge } from '@evenrealities/even_hub_sdk'

export type EmotionListener = (reading: EmotionReading) => void
export type TranscriptionListener = (record: SpeechTranscriptionRecord) => void

export interface AcousticFrame {
  pitch: number
  rms: number
  centroid: number
  rolloff: number
  zcr: number
  timestamp: number
  speakerRole?: AudioSpeakerRole
}

export interface DiarizedSpeakerResult {
  speakerId: string
  speakerLabel: string
  isWearer: boolean
  confidence: number
  acousticDistance: number
}

export class VoiceAnalyzer {
  private bridge?: EvenAppBridge
  private isListening = false
  private audioContext?: AudioContext
  private mediaStream?: MediaStream
  private analyserNode?: AnalyserNode
  private listeners: EmotionListener[] = []
  private transcriptionListeners: TranscriptionListener[] = []
  private recognition?: any

  // Rolling buffer of acoustic frames for utterance diarization (last 6 seconds)
  private recentAcousticFrames: AcousticFrame[] = []
  private activeDiarizedSpeaker: DiarizedSpeakerResult = {
    speakerId: 'speaker_wearer',
    speakerLabel: 'You (Wearer)',
    isWearer: true,
    confidence: 0.95,
    acousticDistance: 0.05,
  }

  // Voice Fingerprint (User's unique voice signature)
  private fingerprint: VoiceFingerprint = {
    isEnrolled: false,
    medianPitchHz: 165,
    pitchVariance: 22,
    spectralCentroid: 1200,
    spectralRolloff: 2400,
    nearFieldRmsThreshold: 0.032,
    diarizationMode: 'strict',
    sampleCount: 0,
  }

  // Calibration buffer
  private isCalibrating = false
  private calibrationSamples: { pitch: number; centroid: number; rolloff: number; rms: number }[] = []

  // Smoothing window for stable emotion detection
  private recentEmotions: EmotionType[] = []
  private lastReading?: EmotionReading

  constructor(bridge?: EvenAppBridge) {
    this.bridge = bridge
    this.loadFingerprintFromStorage()
  }

  /** Set or update the EvenAppBridge */
  setBridge(bridge: EvenAppBridge): void {
    this.bridge = bridge
  }

  /** Set diarization strictness */
  setDiarizationMode(mode: 'strict' | 'adaptive' | 'permissive'): void {
    this.fingerprint.diarizationMode = mode
    this.saveFingerprintToStorage()
    console.log('[VoiceAnalyzer] Diarization mode set to:', mode)
  }

  getDiarizationMode(): 'strict' | 'adaptive' | 'permissive' {
    return this.fingerprint.diarizationMode || 'adaptive'
  }

  getActiveDiarizedSpeaker(): DiarizedSpeakerResult {
    return { ...this.activeDiarizedSpeaker }
  }

  /** Start continuous listening on G2 glasses or browser fallback */
  async startListening(): Promise<boolean> {
    if (this.isListening) return true
    console.log('[VoiceAnalyzer] Starting continuous voice analysis with Speaker Diarization...')

    let startedOnGlasses = false
    if (this.bridge) {
      try {
        const ok = await this.bridge.audioControl(true, AudioInputSource.Glasses)
        if (ok) {
          console.log('[VoiceAnalyzer] Glasses microphone opened successfully!')
          startedOnGlasses = true
        }
      } catch (err) {
        console.warn('[VoiceAnalyzer] Could not start glasses mic, trying phone/web mic:', err)
      }
    }

    try {
      await this.startWebAudioCapture()
      this.setupSpeechRecognition()
      this.isListening = true
      return true
    } catch (err) {
      console.warn('[VoiceAnalyzer] Web Audio capture failed:', err)
      this.isListening = startedOnGlasses
      return startedOnGlasses
    }
  }

  /** Stop continuous listening */
  async stopListening(): Promise<void> {
    this.isListening = false
    if (this.bridge) {
      try {
        await this.bridge.audioControl(false)
      } catch (err) {
        console.error('[VoiceAnalyzer] Error stopping glasses mic:', err)
      }
    }
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((track) => track.stop())
    }
    if (this.audioContext && this.audioContext.state !== 'closed') {
      await this.audioContext.close()
    }
    console.log('[VoiceAnalyzer] Audio listening stopped.')
  }

  /** Ingest raw PCM chunk from Even SDK's audioEvent */
  handleSdkAudioEvent(pcmData: Uint8Array, speakerRole?: AudioSpeakerRole): void {
    if (!this.isListening) return

    const sampleCount = Math.floor(pcmData.length / 2)
    if (sampleCount < 64) return

    const floatSamples = new Float32Array(sampleCount)
    const dataView = new DataView(pcmData.buffer, pcmData.byteOffset, pcmData.byteLength)

    for (let i = 0; i < sampleCount; i++) {
      const int16 = dataView.getInt16(i * 2, true)
      floatSamples[i] = int16 / 32768.0
    }

    const sampleRate = 16000
    this.processAudioFrame(floatSamples, sampleRate, speakerRole)
  }

  /** Setup Web Audio API for browser/phone companion preview */
  private async startWebAudioCapture(): Promise<void> {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      console.warn('[VoiceAnalyzer] getUserMedia not available in this environment')
      return
    }

    this.mediaStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
    })

    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    this.audioContext = new AudioContextClass()

    // Resume AudioContext if suspended by browser autoplay policy
    if (this.audioContext.state === 'suspended') {
      try {
        await this.audioContext.resume()
      } catch {
        // Will resume on gesture below
      }
    }

    const resumeOnGesture = () => {
      if (this.audioContext && this.audioContext.state === 'suspended') {
        this.audioContext.resume().then(() => {
          console.log('[VoiceAnalyzer] AudioContext resumed by user gesture!')
        })
      }
    }
    window.addEventListener('click', resumeOnGesture)
    window.addEventListener('touchstart', resumeOnGesture)

    const sourceNode = this.audioContext.createMediaStreamSource(this.mediaStream)
    this.analyserNode = this.audioContext.createAnalyser()
    this.analyserNode.fftSize = 1024
    this.analyserNode.smoothingTimeConstant = 0.8
    sourceNode.connect(this.analyserNode)

    const buffer = new Float32Array(this.analyserNode.fftSize)

    const pollAudio = () => {
      if (!this.isListening || !this.analyserNode) return
      this.analyserNode.getFloatTimeDomainData(buffer)
      // When analyzing companion/phone microphone, do not hardcode Role.Self: let diarization compute it!
      this.processAudioFrame(buffer, this.audioContext?.sampleRate || 44100, undefined)
      requestAnimationFrame(pollAudio)
    }

    requestAnimationFrame(pollAudio)
  }

  /** Core Audio Processing: Pitch, RMS, Spectral Centroid, Rolloff, ZCR, Diarization */
  private processAudioFrame(samples: Float32Array, sampleRate: number, speakerRole?: AudioSpeakerRole): void {
    // 1. RMS Energy (Volume & Near-field Proximity)
    let sumSquares = 0
    for (let i = 0; i < samples.length; i++) {
      sumSquares += samples[i] * samples[i]
    }
    const rms = Math.sqrt(sumSquares / samples.length)

    // Silence gate: skip if too quiet (0.005 captures soft spoken voice and laptop mics without dropping speech)
    if (rms < 0.005) {
      return
    }

    // 2. Pitch Detection (Autocorrelation with Normalized Threshold & Parabolic Interpolation)
    const pitch = this.detectPitchAutocorrelation(samples, sampleRate)

    // 3. Spectral Centroid (Timbre Brightness)
    const centroid = this.calculateSpectralCentroid(samples, sampleRate)

    // 4. Spectral Rolloff (85% energy boundary)
    const rolloff = this.calculateSpectralRolloff(samples, sampleRate, 0.85)

    // 5. Zero Crossing Rate (ZCR)
    const zcr = this.calculateZeroCrossingRate(samples)

    const frame: AcousticFrame = {
      pitch,
      rms,
      centroid,
      rolloff,
      zcr,
      timestamp: Date.now(),
      speakerRole,
    }

    // Keep rolling 8-second window for utterance diarization & STT alignment
    this.recentAcousticFrames.push(frame)
    const cutoff = Date.now() - 8000
    while (this.recentAcousticFrames.length > 0 && this.recentAcousticFrames[0].timestamp < cutoff) {
      this.recentAcousticFrames.shift()
    }

    // Handle Voice Calibration / Enrollment
    if (this.isCalibrating) {
      if (pitch >= 65 && pitch <= 450) {
        this.calibrationSamples.push({ pitch, centroid, rolloff, rms })
      }
      return
    }

    // Only process further if this frame contains voiced speech
    if (pitch < 65 || pitch > 450) {
      return
    }

    // 6. Online Speaker Diarization across a smooth temporal window (~last 15-20 frames / 350ms)
    // Multi-frame windowing prevents single-consonant flicker and false rejections
    const windowFrames = this.recentAcousticFrames.slice(-20)
    const diarization = this.diarizeAcousticWindow(windowFrames)
    this.activeDiarizedSpeaker = diarization

    // If Diarizer determined this is an external speaker, do not apply to pet emotions!
    if (!diarization.isWearer) {
      return
    }

    // 7. Emotion Classification based on vocal prosody
    const reading = this.classifyEmotion(pitch, rms, centroid, diarization.confidence, diarization)
    this.lastReading = reading

    // Notify listeners
    this.listeners.forEach((fn) => {
      try {
        fn(reading)
      } catch (e) {
        console.error('[VoiceAnalyzer] Listener error:', e)
      }
    })
  }

  /** Run Speaker Diarization across a collection of acoustic frames */
  diarizeAcousticWindow(frames: AcousticFrame[]): DiarizedSpeakerResult {
    if (frames.length === 0) {
      return this.activeDiarizedSpeaker
    }

    // If hardware glasses explicitly tagged the speaker
    const hasExplicitOther = frames.some((f) => f.speakerRole === AudioSpeakerRole.Other)
    if (hasExplicitOther) {
      return {
        speakerId: 'speaker_ambient_1',
        speakerLabel: 'Speaker 2 (Ambient - Ignored)',
        isWearer: false,
        confidence: 0.96,
        acousticDistance: 0.95,
      }
    }

    const hasExplicitSelf = frames.some((f) => f.speakerRole === AudioSpeakerRole.Self)
    if (hasExplicitSelf) {
      return {
        speakerId: 'speaker_wearer',
        speakerLabel: 'You (Wearer - Glasses Mic)',
        isWearer: true,
        confidence: 0.98,
        acousticDistance: 0.05,
      }
    }

    // Filter to voiced speech frames (0.005 allows laptop and normal conversational mic levels)
    const voicedFrames = frames.filter((f) => f.pitch >= 65 && f.pitch <= 420 && f.rms >= 0.005)

    // Target baseline: either enrolled primary speaker or unenrolled state
    const isEnrolled = this.fingerprint.isEnrolled
    if (!isEnrolled) {
      return {
        speakerId: 'speaker_uncalibrated',
        speakerLabel: 'Unenrolled Speaker (Click "Save My Voice")',
        isWearer: true, // Allow initial testing, but prominently prompt enrollment
        confidence: 0.70,
        acousticDistance: 0.30,
      }
    }

    // If no voiced frames in this specific window, maintain current state
    if (voicedFrames.length === 0) {
      return this.activeDiarizedSpeaker
    }

    const targetPitch = this.fingerprint.medianPitchHz
    const targetCentroid = this.fingerprint.spectralCentroid || 1200
    const mode = this.fingerprint.diarizationMode || 'adaptive'

    // Emotion-aware pitch tolerance:
    // When expressing Joy, Curiosity, or Anxiety, speech pitch naturally swings up by +40-75 Hz.
    // When feeling Calm or Sadness, pitch gently dips by -20-40 Hz.
    let pitchDeltaMax = 65
    let pitchMinRatio = 0.60
    let pitchMaxRatio = 1.65
    let centroidDeltaMax = 750
    let requiredMatchRatio = 0.38

    if (mode === 'strict') {
      pitchDeltaMax = 42
      pitchMinRatio = 0.72
      pitchMaxRatio = 1.38
      centroidDeltaMax = 500
      requiredMatchRatio = 0.48
    } else if (mode === 'permissive') {
      pitchDeltaMax = 95
      pitchMinRatio = 0.50
      pitchMaxRatio = 1.90
      centroidDeltaMax = 1100
      requiredMatchRatio = 0.28
    }

    // Evaluate each voiced frame against the wearer's acoustic profile
    let wearerMatchCount = 0
    let totalCentroid = 0
    const pitches: number[] = []

    for (const f of voicedFrames) {
      pitches.push(f.pitch)
      totalCentroid += f.centroid

      const pitchDiff = Math.abs(f.pitch - targetPitch)
      const withinPitchBand = (f.pitch >= targetPitch * pitchMinRatio && f.pitch <= targetPitch * pitchMaxRatio) || pitchDiff <= pitchDeltaMax
      const centroidDiff = Math.abs(f.centroid - targetCentroid)
      const withinCentroidBand = centroidDiff <= centroidDeltaMax

      if (withinPitchBand && (withinCentroidBand || f.rms >= 0.024)) {
        wearerMatchCount++
      }
    }

    pitches.sort((a, b) => a - b)
    const medianUtterancePitch = pitches[Math.floor(pitches.length / 2)]
    const avgUtteranceCentroid = totalCentroid / voicedFrames.length
    const matchRatio = wearerMatchCount / voicedFrames.length

    const isWearer = matchRatio >= requiredMatchRatio
    const confidence = isWearer
      ? Math.min(0.99, Math.max(0.75, Number((0.65 + matchRatio * 0.35).toFixed(2))))
      : Math.min(0.98, Math.max(0.70, Number((0.65 + (1 - matchRatio) * 0.35).toFixed(2))))

    const pitchDist = Math.abs(medianUtterancePitch - targetPitch) / Math.max(30, targetPitch * 0.35)
    const centroidDist = Math.abs(avgUtteranceCentroid - targetCentroid) / 750
    const acousticDistance = Number((pitchDist * 0.7 + centroidDist * 0.3).toFixed(2))

    if (isWearer) {
      return {
        speakerId: 'speaker_wearer',
        speakerLabel: 'You (Primary Saved Voice)',
        isWearer: true,
        confidence,
        acousticDistance: Number((1 - matchRatio).toFixed(2)),
      }
    } else {
      // Differentiate external speakers based on vocal register
      let label = 'Speaker 2 (Ambient Voice - Ignored)'
      if (medianUtterancePitch > targetPitch + 40) {
        label = 'Speaker 2 (Higher Pitch External - Ignored)'
      } else if (medianUtterancePitch < targetPitch - 40) {
        label = 'Speaker 2 (Deeper Pitch External - Ignored)'
      } else {
        label = 'Speaker 2 (External Speaker - Ignored)'
      }

      return {
        speakerId: 'speaker_ambient_1',
        speakerLabel: label,
        isWearer: false,
        confidence,
        acousticDistance: Number(acousticDistance),
      }
    }
  }

  /** Fast autocorrelation pitch detection with Normalized Correlation & Parabolic Interpolation */
  private detectPitchAutocorrelation(samples: Float32Array, sampleRate: number): number {
    const minPeriod = Math.floor(sampleRate / 450) // 450 Hz max
    const maxPeriod = Math.floor(sampleRate / 70)  // 70 Hz min
    const n = samples.length

    let energy = 0
    for (let i = 0; i < n; i++) {
      energy += samples[i] * samples[i]
    }
    if (energy < 0.0001) return 0

    let bestCorr = 0
    let bestPeriod = -1

    for (let period = minPeriod; period <= maxPeriod; period++) {
      let corr = 0
      for (let i = 0; i < n - period; i++) {
        corr += samples[i] * samples[i + period]
      }
      if (corr > bestCorr) {
        bestCorr = corr
        bestPeriod = period
      }
    }

    // Normalized correlation threshold to reject noise/unvoiced frames
    const normalizedCorr = bestCorr / energy
    if (normalizedCorr < 0.20 || bestPeriod <= 0) {
      return 0 // Unvoiced or noise
    }

    // Parabolic interpolation around peak for sub-sample accuracy
    let peakPeriod: number = bestPeriod
    if (bestPeriod > minPeriod && bestPeriod < maxPeriod) {
      let corrPrev = 0
      let corrNext = 0
      for (let i = 0; i < n - (bestPeriod - 1); i++) corrPrev += samples[i] * samples[i + bestPeriod - 1]
      for (let i = 0; i < n - (bestPeriod + 1); i++) corrNext += samples[i] * samples[i + bestPeriod + 1]
      const denom = 2 * (2 * bestCorr - corrPrev - corrNext)
      if (Math.abs(denom) > 1e-6) {
        const delta = (corrNext - corrPrev) / denom
        if (Math.abs(delta) < 1) {
          peakPeriod = bestPeriod + delta
        }
      }
    }

    return sampleRate / peakPeriod
  }

  /** Spectral rolloff: frequency below which cutoffPercentage of total spectral energy lies */
  private calculateSpectralRolloff(samples: Float32Array, sampleRate: number, cutoffPercentage = 0.85): number {
    const len = Math.min(samples.length, 512)
    let totalEnergy = 0
    const magnitudes = new Float32Array(len)

    for (let i = 0; i < len; i++) {
      const mag = Math.abs(samples[i])
      magnitudes[i] = mag
      totalEnergy += mag
    }

    if (totalEnergy === 0) return 2400

    const threshold = totalEnergy * cutoffPercentage
    let cumulative = 0

    for (let i = 0; i < len; i++) {
      cumulative += magnitudes[i]
      if (cumulative >= threshold) {
        return (i * sampleRate) / (len * 2)
      }
    }
    return 2400
  }

  /** Zero Crossing Rate (ZCR): useful for separating voiced speech vs unvoiced/ambient noise */
  private calculateZeroCrossingRate(samples: Float32Array): number {
    let crossings = 0
    for (let i = 1; i < samples.length; i++) {
      if ((samples[i] >= 0 && samples[i - 1] < 0) || (samples[i] < 0 && samples[i - 1] >= 0)) {
        crossings++
      }
    }
    return crossings / samples.length
  }

  /** Spectral centroid for voice timbre */
  private calculateSpectralCentroid(samples: Float32Array, sampleRate: number): number {
    let weightedSum = 0
    let sum = 0
    const len = Math.min(samples.length, 512)
    for (let i = 1; i < len; i++) {
      const freq = (i * sampleRate) / (len * 2)
      const mag = Math.abs(samples[i])
      weightedSum += freq * mag
      sum += mag
    }
    return sum > 0 ? weightedSum / sum : 1200
  }

  /** Classify emotion from vocal features relative to user's baseline */
  private classifyEmotion(
    pitch: number,
    rms: number,
    centroid: number,
    userConfidence: number,
    diarization?: DiarizedSpeakerResult
  ): EmotionReading {
    const basePitch = this.fingerprint.isEnrolled ? this.fingerprint.medianPitchHz : 160
    const pitchDelta = pitch - basePitch

    const scores: Record<EmotionType, number> = {
      joy: 0.1,
      calm: 0.2,
      anxiety: 0.1,
      sadness: 0.1,
      frustration: 0.1,
      curiosity: 0.1,
    }

    // Heuristics:
    // - Joy: high pitch delta (> +25Hz), high energy, bright centroid
    if (pitchDelta > 20 && rms > 0.08) {
      scores.joy += 0.6 + Math.min(0.3, pitchDelta / 60)
    }

    // - Calm: stable pitch near baseline (+- 15Hz), gentle energy (< 0.07), soft centroid
    if (Math.abs(pitchDelta) <= 18 && rms <= 0.09) {
      scores.calm += 0.65
    }

    // - Anxiety: high pitch, rapid pitch jitter, elevated centroid (> 1500)
    if (pitchDelta > 15 && centroid > 1400) {
      scores.anxiety += 0.55
    }

    // - Frustration: very high rms (> 0.12), sharp attack, high tension
    if (rms > 0.11 && pitchDelta > 10) {
      scores.frustration += 0.6
    }

    // - Sadness: low pitch (< -15Hz), low volume/energy, low centroid
    if (pitchDelta < -12 && rms < 0.06) {
      scores.sadness += 0.6
    }

    // - Curiosity: slight rising intonation (+10 to +25Hz) with moderate energy
    if (pitchDelta >= 8 && pitchDelta <= 24 && rms >= 0.05 && rms <= 0.1) {
      scores.curiosity += 0.5
    }

    // Find primary emotion
    let primary: EmotionType = 'calm'
    let highest = -1
    for (const [emo, val] of Object.entries(scores) as [EmotionType, number][]) {
      if (val > highest) {
        highest = val
        primary = emo
      }
    }

    // Smooth emotion transitions
    this.recentEmotions.push(primary)
    if (this.recentEmotions.length > 5) this.recentEmotions.shift()

    // Mode of recent emotions for stability
    const counts: Record<string, number> = {}
    for (const e of this.recentEmotions) counts[e] = (counts[e] || 0) + 1
    let smoothedPrimary = primary
    let maxCount = 0
    for (const [e, count] of Object.entries(counts)) {
      if (count > maxCount) {
        maxCount = count
        smoothedPrimary = e as EmotionType
      }
    }

    return {
      primary: smoothedPrimary,
      confidence: Math.min(0.98, Math.max(0.4, highest)),
      scores,
      pitchHz: Math.round(pitch),
      energyRms: Number(rms.toFixed(3)),
      tempoBpm: 120,
      timestamp: Date.now(),
      isUserVoice: diarization ? diarization.isWearer : true,
      userVoiceConfidence: Number(userConfidence.toFixed(2)),
      speakerId: diarization?.speakerId,
      speakerLabel: diarization?.speakerLabel,
      diarizationConfidence: diarization?.confidence,
    }
  }

  /** Start 3-5 second voice calibration */
  startCalibration(): void {
    this.isCalibrating = true
    this.calibrationSamples = []
    console.log('[VoiceAnalyzer] Calibrating voice fingerprint for speaker diarization. Speak naturally...')
  }

  /** Guided Voice Enrollment: counts down durationSec seconds while user speaks sample phrase */
  async enrollVoice(durationSec = 4, onProgress?: (secRemaining: number, currentPitch?: number) => void): Promise<VoiceFingerprint> {
    await this.startListening()
    this.startCalibration()

    let remaining = durationSec
    if (onProgress) onProgress(remaining, this.lastReading?.pitchHz)

    return new Promise((resolve) => {
      const interval = setInterval(() => {
        remaining--
        const latestPitch = this.calibrationSamples.length > 0
          ? this.calibrationSamples[this.calibrationSamples.length - 1].pitch
          : this.lastReading?.pitchHz
        if (onProgress) onProgress(remaining, latestPitch ? Math.round(latestPitch) : undefined)

        if (remaining <= 0) {
          clearInterval(interval)
          const result = this.finishCalibration()
          resolve(result)
        }
      }, 1000)
    })
  }

  /** Clear saved primary speaker voice profile and return to unenrolled state */
  clearEnrolledVoice(): void {
    this.fingerprint = {
      isEnrolled: false,
      medianPitchHz: 165,
      pitchVariance: 22,
      spectralCentroid: 1200,
      spectralRolloff: 2400,
      nearFieldRmsThreshold: 0.024,
      diarizationMode: 'adaptive',
      sampleCount: 0,
    }
    try {
      localStorage.removeItem('aurapet_voice_fingerprint')
    } catch {}
    this.activeDiarizedSpeaker = {
      speakerId: 'speaker_uncalibrated',
      speakerLabel: 'Unenrolled Speaker (Click "Save My Voice")',
      isWearer: true,
      confidence: 0.70,
      acousticDistance: 0.30,
    }
    console.log('[VoiceAnalyzer] Enrolled primary voice profile cleared.')
  }

  /** Instant 1-click lock to current speaker acoustics */
  quickLockWearerVoice(pitch?: number, centroid?: number): VoiceFingerprint {
    const lockedPitch = pitch || (this.lastReading?.pitchHz ?? 165)
    const lockedCentroid = centroid || (this.lastReading ? 1200 : 1200)
    this.fingerprint = {
      isEnrolled: true,
      enrolledAt: Date.now(),
      medianPitchHz: Math.round(lockedPitch),
      pitchVariance: 24,
      spectralCentroid: Math.round(lockedCentroid),
      spectralRolloff: 2400,
      nearFieldRmsThreshold: 0.024,
      diarizationMode: this.fingerprint.diarizationMode || 'adaptive',
      sampleCount: 20,
    }
    this.activeDiarizedSpeaker = {
      speakerId: 'speaker_wearer',
      speakerLabel: 'You (Primary Saved Voice)',
      isWearer: true,
      confidence: 0.98,
      acousticDistance: 0.05,
    }
    this.saveFingerprintToStorage()
    console.log('[VoiceAnalyzer] Instant Wearer Voice Locked:', this.fingerprint)
    return this.fingerprint
  }

  /** Finish voice calibration and save fingerprint */
  finishCalibration(): VoiceFingerprint {
    this.isCalibrating = false
    let samples = this.calibrationSamples

    // If no samples were collected during calibration (e.g. mic was silent), check recent frames
    if (samples.length === 0 && this.recentAcousticFrames.length > 0) {
      samples = this.recentAcousticFrames.map(f => ({
        pitch: f.pitch,
        centroid: f.centroid,
        rolloff: f.rolloff,
        rms: f.rms
      }))
    }

    if (samples.length > 0) {
      const pitches = samples.map((s) => s.pitch).sort((a, b) => a - b)
      const centroids = samples.map((s) => s.centroid)
      const rolloffs = samples.map((s) => s.rolloff)
      const rmsValues = samples.map((s) => s.rms)

      const medianPitch = pitches[Math.floor(pitches.length / 2)]
      const avgCentroid = centroids.reduce((a, b) => a + b, 0) / centroids.length
      const avgRolloff = rolloffs.reduce((a, b) => a + b, 0) / rolloffs.length
      const avgRms = rmsValues.reduce((a, b) => a + b, 0) / rmsValues.length

      const variance = Math.sqrt(
        pitches.reduce((acc, p) => acc + Math.pow(p - medianPitch, 2), 0) / pitches.length
      )

      this.fingerprint = {
        isEnrolled: true,
        enrolledAt: Date.now(),
        medianPitchHz: Math.round(medianPitch),
        pitchVariance: Math.max(18, Math.min(45, Math.round(variance))) || 25,
        spectralCentroid: Math.round(avgCentroid) || 1200,
        spectralRolloff: Math.round(avgRolloff) || 2400,
        nearFieldRmsThreshold: Number((avgRms * 0.55).toFixed(3)) || 0.024,
        diarizationMode: this.fingerprint.diarizationMode || 'adaptive',
        minPitchHz: Math.round(pitches[0]),
        maxPitchHz: Math.round(pitches[pitches.length - 1]),
        sampleCount: samples.length,
      }
    } else {
      // Fallback: enroll with current reading or baseline
      const fallbackPitch = this.lastReading?.pitchHz ?? 165
      this.fingerprint = {
        isEnrolled: true,
        enrolledAt: Date.now(),
        medianPitchHz: fallbackPitch,
        pitchVariance: 25,
        spectralCentroid: 1200,
        spectralRolloff: 2400,
        nearFieldRmsThreshold: 0.024,
        diarizationMode: this.fingerprint.diarizationMode || 'adaptive',
        sampleCount: 1,
      }
    }

    this.activeDiarizedSpeaker = {
      speakerId: 'speaker_wearer',
      speakerLabel: 'You (Primary Saved Voice)',
      isWearer: true,
      confidence: 0.98,
      acousticDistance: 0.05,
    }

    this.saveFingerprintToStorage()
    console.log('[VoiceAnalyzer] Enrolled user voice profile for Diarization:', this.fingerprint)
    return this.fingerprint
  }

  getFingerprint(): VoiceFingerprint {
    return { ...this.fingerprint }
  }

  getLastReading(): EmotionReading | undefined {
    return this.lastReading
  }

  onEmotion(listener: EmotionListener): () => void {
    this.listeners.push(listener)
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener)
    }
  }

  onTranscription(listener: TranscriptionListener): () => void {
    this.transcriptionListeners.push(listener)
    return () => {
      this.transcriptionListeners = this.transcriptionListeners.filter((l) => l !== listener)
    }
  }

  /** Continuous Ambient Speech Recognition with Biometric Speaker Diarization */
  private setupSpeechRecognition(): void {
    const windowObj = window as any
    const SpeechRecognitionClass = windowObj.SpeechRecognition || windowObj.webkitSpeechRecognition
    if (!SpeechRecognitionClass) {
      console.warn('[VoiceAnalyzer] SpeechRecognition API not supported in this browser/WebView')
      return
    }

    try {
      this.recognition = new SpeechRecognitionClass()
      this.recognition.continuous = true
      this.recognition.interimResults = false
      this.recognition.lang = 'en-US'

      this.recognition.onresult = (event: any) => {
        const lastIndex = event.results.length - 1
        const result = event.results[lastIndex]
        if (!result || !result.isFinal) return

        const transcript = result[0]?.transcript?.trim()
        if (!transcript) return

        // 1. Gather recent acoustic frames over the speech segment window (last 6.5 seconds)
        // Web Speech API emits isFinal ~1.5-2.5s after speech ends, so looking back 6.5s captures full utterance
        const speechWindowCutoff = Date.now() - 6500
        const speechFrames = this.recentAcousticFrames.filter((f) => f.timestamp >= speechWindowCutoff)

        // 2. Run Speaker Diarization on the utterance
        const diarization = this.diarizeAcousticWindow(speechFrames)
        this.activeDiarizedSpeaker = diarization

        // 3. Score semantic text emotions
        const textAnalysis = this.analyzeTextEmotions(transcript)
        const reading = this.lastReading

        // Combine vocal prosody + semantic text scores
        const combinedScores: Record<EmotionType, number> = {
          joy: Number(((reading ? reading.scores.joy * 0.35 : 0.1) + textAnalysis.scores.joy * 0.65).toFixed(2)),
          calm: Number(((reading ? reading.scores.calm * 0.35 : 0.2) + textAnalysis.scores.calm * 0.65).toFixed(2)),
          anxiety: Number(((reading ? reading.scores.anxiety * 0.35 : 0.1) + textAnalysis.scores.anxiety * 0.65).toFixed(2)),
          sadness: Number(((reading ? reading.scores.sadness * 0.35 : 0.1) + textAnalysis.scores.sadness * 0.65).toFixed(2)),
          frustration: Number(((reading ? reading.scores.frustration * 0.35 : 0.1) + textAnalysis.scores.frustration * 0.65).toFixed(2)),
          curiosity: Number(((reading ? reading.scores.curiosity * 0.35 : 0.1) + textAnalysis.scores.curiosity * 0.65).toFixed(2)),
        }

        let primaryEmotion: EmotionType = textAnalysis.primary
        let maxScore = -1
        for (const [emo, sc] of Object.entries(combinedScores) as [EmotionType, number][]) {
          if (sc > maxScore) {
            maxScore = sc
            primaryEmotion = emo
          }
        }

        const avgPitch = speechFrames.length > 0
          ? Math.round(speechFrames.reduce((acc, f) => acc + f.pitch, 0) / speechFrames.length)
          : (reading?.pitchHz ?? this.fingerprint.medianPitchHz)

        const record: SpeechTranscriptionRecord = {
          id: `tx_${Date.now()}`,
          text: transcript,
          timestamp: Date.now(),
          primaryEmotion,
          confidence: Math.min(0.98, Math.max(0.5, maxScore)),
          emotionScores: combinedScores,
          pitchHz: avgPitch,
          isWearerVoice: diarization.isWearer,
          wearerConfidence: diarization.confidence,
          speakerId: diarization.speakerId,
          speakerLabel: diarization.speakerLabel,
          diarizationConfidence: diarization.confidence,
        }

        if (!diarization.isWearer) {
          console.warn(`[Speaker Diarizer] Ambient voice rejected (${diarization.speakerLabel}): "${transcript}"`)
        } else {
          console.log(`[Speaker Diarizer] Wearer verified speech: "${transcript}" -> Emotion: ${primaryEmotion}`)
        }

        // Notify transcription listeners (UI will show speaker tags, and app will filter out non-wearer)
        for (const listener of this.transcriptionListeners) {
          try {
            listener(record)
          } catch (e) {
            console.error('[VoiceAnalyzer] Transcription listener error:', e)
          }
        }
      }

      this.recognition.onerror = (e: any) => {
        if (e.error !== 'no-speech' && e.error !== 'aborted') {
          console.warn('[VoiceAnalyzer] SpeechRecognition error:', e.error)
        }
      }

      this.recognition.onend = () => {
        // Continuous listening throughout daily life
        if (this.isListening) {
          try {
            this.recognition.start()
          } catch {
            // Already active
          }
        }
      }

      this.recognition.start()
      console.log('[VoiceAnalyzer] Ambient speech-to-text recognition active!')
    } catch (err) {
      console.warn('[VoiceAnalyzer] SpeechRecognition init failed:', err)
    }
  }

  /** NLP Semantic Emotion Classifier: Gives scores to emotions based on user conversation */
  private analyzeTextEmotions(text: string): { primary: EmotionType; scores: Record<EmotionType, number> } {
    const lower = text.toLowerCase()

    const scores: Record<EmotionType, number> = {
      joy: 0.1,
      calm: 0.2,
      anxiety: 0.1,
      sadness: 0.1,
      frustration: 0.1,
      curiosity: 0.1,
    }

    const joyKeywords = ['excited', 'great', 'awesome', 'love', 'happy', 'glad', 'amazing', 'yes', 'fun', 'nice', 'wonderful', 'celebrate', 'proud', 'good', 'win', 'cool', 'beautiful', 'yay']
    const calmKeywords = ['breathe', 'calm', 'peaceful', 'quiet', 'relax', 'ok', 'smooth', 'balance', 'fine', 'alright', 'gentle', 'steady', 'chill', 'easy', 'rest', 'soothing']
    const anxietyKeywords = ['worried', 'stress', 'anxious', 'nervous', 'deadline', 'fast', 'rush', 'panic', 'afraid', 'scared', 'pressure', 'overwhelm', 'late', 'hurry', 'omg', 'tense']
    const sadnessKeywords = ['sad', 'tired', 'exhausted', 'miss', 'heavy', 'gloomy', 'down', 'hurt', 'cry', 'fail', 'hopeless', 'lonely', 'bad', 'sigh', 'sorry', 'depressed']
    const frustrationKeywords = ['angry', 'mad', 'annoyed', 'hate', 'irritated', 'stuck', 'ugh', 'damn', 'stupid', 'broken', 'why', 'furious', 'bug', 'mess', 'error', 'hate this']
    const curiosityKeywords = ['wonder', 'learn', 'why', 'how', 'interesting', 'what if', 'explore', 'check', 'investigate', 'try', 'idea', 'build', 'create', 'hackathon', 'curious']

    for (const word of joyKeywords) {
      if (lower.includes(word)) scores.joy += 0.4
    }
    for (const word of calmKeywords) {
      if (lower.includes(word)) scores.calm += 0.4
    }
    for (const word of anxietyKeywords) {
      if (lower.includes(word)) scores.anxiety += 0.45
    }
    for (const word of sadnessKeywords) {
      if (lower.includes(word)) scores.sadness += 0.45
    }
    for (const word of frustrationKeywords) {
      if (lower.includes(word)) scores.frustration += 0.45
    }
    for (const word of curiosityKeywords) {
      if (lower.includes(word)) scores.curiosity += 0.4
    }

    let primary: EmotionType = 'calm'
    let highest = -1
    for (const [emo, val] of Object.entries(scores) as [EmotionType, number][]) {
      if (val > highest) {
        highest = val
        primary = emo
      }
    }

    return { primary, scores }
  }

  private saveFingerprintToStorage(): void {
    try {
      localStorage.setItem('aurapet_voice_fingerprint', JSON.stringify(this.fingerprint))
    } catch {
      // ignore in SSR or constrained storage
    }
  }

  private loadFingerprintFromStorage(): void {
    try {
      const saved = localStorage.getItem('aurapet_voice_fingerprint')
      if (saved) {
        this.fingerprint = JSON.parse(saved)
      }
    } catch {
      // fallback default
    }
  }
}
