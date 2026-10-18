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

export class VoiceAnalyzer {
  private bridge?: EvenAppBridge
  private isListening = false
  private audioContext?: AudioContext
  private mediaStream?: MediaStream
  private analyserNode?: AnalyserNode
  private listeners: EmotionListener[] = []
  private transcriptionListeners: TranscriptionListener[] = []
  private recognition?: any

  // Voice Fingerprint (User's unique voice signature)
  private fingerprint: VoiceFingerprint = {
    isEnrolled: false,
    medianPitchHz: 165,
    pitchVariance: 25,
    spectralCentroid: 1200,
    sampleCount: 0,
  }

  // Calibration buffer
  private isCalibrating = false
  private calibrationSamples: { pitch: number; centroid: number }[] = []

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

  /** Start continuous listening on G2 glasses or browser fallback */
  async startListening(): Promise<boolean> {
    if (this.isListening) return true
    console.log('[VoiceAnalyzer] Starting continuous voice analysis...')

    let startedOnGlasses = false
    if (this.bridge) {
      try {
        // Open glasses microphone via Even SDK
        const ok = await this.bridge.audioControl(true, AudioInputSource.Glasses)
        if (ok) {
          console.log('[VoiceAnalyzer] Glasses microphone opened successfully!')
          startedOnGlasses = true
        }
      } catch (err) {
        console.warn('[VoiceAnalyzer] Could not start glasses mic, trying phone/web mic:', err)
      }
    }

    // Also start Web Audio analyzer for local processing / fallback
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

    // Convert raw Uint8Array (16-bit PCM little endian) to Float32Array
    const sampleCount = Math.floor(pcmData.length / 2)
    if (sampleCount < 64) return

    const floatSamples = new Float32Array(sampleCount)
    const dataView = new DataView(pcmData.buffer, pcmData.byteOffset, pcmData.byteLength)

    for (let i = 0; i < sampleCount; i++) {
      const int16 = dataView.getInt16(i * 2, true)
      floatSamples[i] = int16 / 32768.0
    }

    // Run acoustic analysis on PCM samples
    const sampleRate = 16000 // Standard G2 sample rate
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
    const sourceNode = this.audioContext.createMediaStreamSource(this.mediaStream)
    this.analyserNode = this.audioContext.createAnalyser()
    this.analyserNode.fftSize = 1024
    this.analyserNode.smoothingTimeConstant = 0.8
    sourceNode.connect(this.analyserNode)

    const buffer = new Float32Array(this.analyserNode.fftSize)

    const pollAudio = () => {
      if (!this.isListening || !this.analyserNode) return
      this.analyserNode.getFloatTimeDomainData(buffer)
      this.processAudioFrame(buffer, this.audioContext?.sampleRate || 44100, AudioSpeakerRole.Self)
      requestAnimationFrame(pollAudio)
    }

    requestAnimationFrame(pollAudio)
  }

  /** Core Audio Processing: Pitch, RMS, Spectral Centroid, Voiceprint & Emotion */
  private processAudioFrame(samples: Float32Array, sampleRate: number, speakerRole?: AudioSpeakerRole): void {
    // 1. Calculate RMS energy (volume)
    let sumSquares = 0
    for (let i = 0; i < samples.length; i++) {
      sumSquares += samples[i] * samples[i]
    }
    const rms = Math.sqrt(sumSquares / samples.length)

    // Silence gate: skip if too quiet to avoid detecting background hum
    if (rms < 0.02) {
      return
    }

    // 2. Pitch Detection (Autocorrelation)
    const pitch = this.detectPitchAutocorrelation(samples, sampleRate)
    if (pitch < 60 || pitch > 450) {
      return // Outside human speech range
    }

    // 3. Spectral Centroid
    const centroid = this.calculateSpectralCentroid(samples, sampleRate)

    // Handle Voice Calibration / Enrollment
    if (this.isCalibrating) {
      this.calibrationSamples.push({ pitch, centroid })
      return
    }

    // 4. Voice Fingerprinting: Check if it's the enrolled user's voice
    let userConfidence = 0.85
    let isUserVoice = true

    if (speakerRole === AudioSpeakerRole.Other) {
      isUserVoice = false
      userConfidence = 0.15
    } else if (this.fingerprint.isEnrolled) {
      const pitchDiff = Math.abs(pitch - this.fingerprint.medianPitchHz)
      const maxDiff = this.fingerprint.pitchVariance * 2.5
      const pitchScore = Math.max(0, 1 - pitchDiff / (maxDiff || 40))

      const centroidDiff = Math.abs(centroid - this.fingerprint.spectralCentroid)
      const centroidScore = Math.max(0, 1 - centroidDiff / 1000)

      userConfidence = pitchScore * 0.7 + centroidScore * 0.3
      isUserVoice = userConfidence > 0.45
    }

    // If it's another person talking, skip updating pet mood
    if (!isUserVoice) {
      return
    }

    // 5. Emotion Classification based on vocal prosody
    const reading = this.classifyEmotion(pitch, rms, centroid, userConfidence)
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

  /** Fast autocorrelation pitch detection */
  private detectPitchAutocorrelation(samples: Float32Array, sampleRate: number): number {
    const minPeriod = Math.floor(sampleRate / 450) // 450 Hz max
    const maxPeriod = Math.floor(sampleRate / 70)  // 70 Hz min
    const n = samples.length

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

    if (bestPeriod > 0) {
      return sampleRate / bestPeriod
    }
    return 0
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
  private classifyEmotion(pitch: number, rms: number, centroid: number, userConfidence: number): EmotionReading {
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
      isUserVoice: true,
      userVoiceConfidence: Number(userConfidence.toFixed(2)),
    }
  }

  /** Start 5-second voice calibration */
  startCalibration(): void {
    this.isCalibrating = true
    this.calibrationSamples = []
    console.log('[VoiceAnalyzer] Calibrating voice fingerprint. Speak naturally for 5 seconds...')
  }

  /** Finish voice calibration and save fingerprint */
  finishCalibration(): VoiceFingerprint {
    this.isCalibrating = false
    if (this.calibrationSamples.length > 0) {
      const pitches = this.calibrationSamples.map((s) => s.pitch).sort((a, b) => a - b)
      const centroids = this.calibrationSamples.map((s) => s.centroid)

      const medianPitch = pitches[Math.floor(pitches.length / 2)]
      const avgCentroid = centroids.reduce((a, b) => a + b, 0) / centroids.length

      // Variance
      const variance = Math.sqrt(
        pitches.reduce((acc, p) => acc + Math.pow(p - medianPitch, 2), 0) / pitches.length
      )

      this.fingerprint = {
        isEnrolled: true,
        enrolledAt: Date.now(),
        medianPitchHz: Math.round(medianPitch),
        pitchVariance: Math.round(variance) || 25,
        spectralCentroid: Math.round(avgCentroid) || 1200,
        sampleCount: this.calibrationSamples.length,
      }

      this.saveFingerprintToStorage()
      console.log('[VoiceAnalyzer] Enrolled user voice profile:', this.fingerprint)
    }
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

  /** Continuous Ambient Speech Recognition with Biometric Wearer Filtering */
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

        // Check if voice biometric matches wearer
        const reading = this.lastReading
        const isWearer = reading ? reading.isUserVoice : true
        const wearerConf = reading ? reading.userVoiceConfidence : 0.88

        if (!isWearer) {
          console.log('[VoiceAnalyzer] Ambient speaker speech ignored:', transcript)
          return
        }

        // Score emotions based on what the wearer said
        const textAnalysis = this.analyzeTextEmotions(transcript)

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

        const record: SpeechTranscriptionRecord = {
          id: `tx_${Date.now()}`,
          text: transcript,
          timestamp: Date.now(),
          primaryEmotion,
          confidence: Math.min(0.98, Math.max(0.5, maxScore)),
          emotionScores: combinedScores,
          pitchHz: reading?.pitchHz ?? this.fingerprint.medianPitchHz,
          isWearerVoice: true,
          wearerConfidence: wearerConf,
        }

        console.log('[VoiceAnalyzer] Wearer spoke:', `"${transcript}"`, '-> Emotion:', primaryEmotion, `(${Math.round(maxScore * 100)}%)`)

        // Notify transcription listeners
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
