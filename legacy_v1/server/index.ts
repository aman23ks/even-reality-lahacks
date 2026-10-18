/**
 * server/index.ts — AuraPet Express Backend Server
 * 
 * Handles:
 *   - Voice fingerprinting profile persistence & comparison
 *   - Vocal emotion & prosody analysis
 *   - AI Wellness Coaching suggestions (OpenAI / Groq / intelligent algorithmic fallback)
 *   - VoidPet gamification & breeding sync
 */

import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import fs from 'node:fs'
import path from 'node:path'

dotenv.config()

const app = express()
const PORT = process.env.PORT || 3001

app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}))

app.use(express.json({ limit: '15mb' }))

// In-memory state store (persists across user sessions during dev)
let userVoiceProfile: {
  enrolled: boolean
  medianPitchHz: number
  pitchVariance: number
  spectralCentroid: number
  enrolledAt: number
} = {
  enrolled: false,
  medianPitchHz: 160,
  pitchVariance: 25,
  spectralCentroid: 1200,
  enrolledAt: 0,
}

// ── Health Check ──────────────────────────────────────────────
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'AuraPet G2 Server',
    timestamp: new Date().toISOString(),
    voiceProfileEnrolled: userVoiceProfile.enrolled,
    hasOpenAiKey: Boolean(process.env.OPENAI_API_KEY),
    hasGroqKey: Boolean(process.env.GROQ_API_KEY),
  })
})

// ── Voice Fingerprinting Endpoints ────────────────────────────

/** Save or update enrolled user voice fingerprint */
app.post('/api/voice/enroll', (req, res) => {
  try {
    const { medianPitchHz, pitchVariance, spectralCentroid } = req.body
    if (!medianPitchHz) {
      res.status(400).json({ error: 'Missing medianPitchHz' })
      return
    }

    userVoiceProfile = {
      enrolled: true,
      medianPitchHz: Number(medianPitchHz),
      pitchVariance: Number(pitchVariance) || 25,
      spectralCentroid: Number(spectralCentroid) || 1200,
      enrolledAt: Date.now(),
    }

    console.log('[VoiceProfile] Enrolled user fingerprint:', userVoiceProfile)
    res.json({ success: true, profile: userVoiceProfile })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Enrollment error'
    res.status(500).json({ error: msg })
  }
})

/** Get enrolled voice fingerprint */
app.get('/api/voice/profile', (_req, res) => {
  res.json({ success: true, profile: userVoiceProfile })
})

// ── Audio & Emotion Analysis ──────────────────────────────────

/**
 * Analyzes voice features and returns emotional reading + micro-steps
 */
app.post('/api/audio/analyze', async (req, res) => {
  try {
    const { pitchHz, energyRms, centroid, rawAudioBase64 } = req.body

    const pitch = Number(pitchHz) || userVoiceProfile.medianPitchHz
    const rms = Number(energyRms) || 0.05
    const specCentroid = Number(centroid) || 1200

    // Voice fingerprint similarity test
    let userVoiceConfidence = 0.88
    if (userVoiceProfile.enrolled) {
      const pitchDiff = Math.abs(pitch - userVoiceProfile.medianPitchHz)
      const allowed = userVoiceProfile.pitchVariance * 2.5
      userVoiceConfidence = Math.max(0.1, 1 - pitchDiff / (allowed || 40))
    }

    const isUserVoice = userVoiceConfidence >= 0.45

    // Emotion scoring
    const pitchDelta = pitch - userVoiceProfile.medianPitchHz
    let primaryEmotion: 'joy' | 'calm' | 'anxiety' | 'sadness' | 'frustration' | 'curiosity' = 'calm'

    if (pitchDelta > 20 && rms > 0.08) {
      primaryEmotion = 'joy'
    } else if (rms > 0.12 && pitchDelta > 8) {
      primaryEmotion = 'frustration'
    } else if (pitchDelta > 15 && specCentroid > 1400) {
      primaryEmotion = 'anxiety'
    } else if (pitchDelta < -15 && rms < 0.06) {
      primaryEmotion = 'sadness'
    } else if (pitchDelta >= 8 && pitchDelta <= 24) {
      primaryEmotion = 'curiosity'
    } else {
      primaryEmotion = 'calm'
    }

    // Generate actionable wellness suggestions based on detected emotion
    const suggestions = getEmotionSuggestions(primaryEmotion)

    res.json({
      success: true,
      emotion: {
        primary: primaryEmotion,
        confidence: 0.88,
        pitchHz: pitch,
        energyRms: rms,
        isUserVoice,
        userVoiceConfidence,
      },
      suggestions,
    })
  } catch (err) {
    console.error('[Analyze] Error:', err)
    res.status(500).json({ error: 'Failed to analyze audio' })
  }
})

// ── AI Wellness Coach Endpoint ────────────────────────────────

app.post('/api/coach/suggestion', async (req, res) => {
  try {
    const { emotion, petName, petLevel } = req.body

    // If an OpenAI or Groq key is present, try LLM for personalized dynamic quote
    const apiKey = process.env.OPENAI_API_KEY || process.env.GROQ_API_KEY
    if (apiKey) {
      try {
        const prompt = `You are ${petName || 'Solispark'}, a friendly VoidPet companion for Even Reality G2 smart glasses (576x288 px green screen). The wearer is feeling "${emotion}". In under 65 characters, give 1 sweet micro-action they can do right now to feel better or earn points.`
        
        const openAiUrl = process.env.OPENAI_API_KEY 
          ? 'https://api.openai.com/v1/chat/completions' 
          : 'https://api.groq.com/openai/v1/chat/completions'
        const model = process.env.OPENAI_API_KEY ? 'gpt-4o-mini' : 'llama-3.1-8b-instant'

        const response = await fetch(openAiUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model,
            messages: [{ role: 'user', content: prompt }],
            max_tokens: 45,
            temperature: 0.7,
          }),
        })

        if (response.ok) {
          const data = await response.json()
          const aiText = data.choices?.[0]?.message?.content?.trim()
          if (aiText) {
            res.json({ suggestion: aiText.replace(/["']/g, '') })
            return
          }
        }
      } catch (e) {
        console.warn('[Coach] LLM call failed, falling back to instant heuristics:', e)
      }
    }

    // Default fast heuristic suggestions
    const fallbacks: Record<string, string> = {
      anxiety: 'Inhale 4s, exhale 6s. You are completely safe.',
      frustration: 'Roll your shoulders back and unclamp teeth.',
      sadness: 'Think of 1 cozy thing you love today. +40 XP!',
      joy: 'Your aura is glowing! Share a smile with someone.',
      calm: 'Lovely peace! Keep breathing in this tranquil zone.',
      curiosity: 'Notice three unique textures or colors nearby.',
    }

    res.json({
      suggestion: fallbacks[emotion] || 'Breathe gently and let your pet evolve.',
    })
  } catch (err) {
    res.status(500).json({ error: 'Coaching error' })
  }
})

// ── Device Diagnostics ────────────────────────────────────────
// Phone posts a capability snapshot every 3s; appended to diag.log for inspection
app.post('/api/diag', (req, res) => {
  const line = JSON.stringify({ receivedAt: new Date().toISOString(), ...req.body })
  fs.appendFile(path.join(process.cwd(), 'diag.log'), line + '\n', () => {})
  res.json({ ok: true })
})

function getEmotionSuggestions(emotion: string) {
  switch (emotion) {
    case 'anxiety':
      return [
        { title: '🌬️ 4-7-8 Breath', step: 'Exhale fully, inhale 4s, hold 7s, exhale 8s.', points: 50 },
        { title: '🧘 Grounding', step: 'Feel both feet flat on the floor.', points: 30 },
      ]
    case 'frustration':
      return [
        { title: '💧 Sip of Water', step: 'Take a cooling sip of water and pause.', points: 40 },
        { title: '💆 Jaw Release', step: 'Let your tongue rest gently on the roof of mouth.', points: 35 },
      ]
    case 'sadness':
      return [
        { title: '☀️ Gratitude Prompt', step: 'Say 1 thing you appreciate out loud.', points: 45 },
        { title: '👀 Soft Gaze', step: 'Look out at the distance for 15 seconds.', points: 30 },
      ]
    case 'joy':
      return [
        { title: '✨ Vibe Resonance', step: 'Give a teammate a quick high five or shoutout!', points: 60 },
        { title: '🔥 Essence Boost', step: 'Smile to synthesize Joy Essence for breeding.', points: 40 },
      ]
    default:
      return [
        { title: '☯ Mindful Moment', step: 'Notice your natural breathing rhythm.', points: 35 },
      ]
  }
}

app.listen(PORT, () => {
  console.log(`
╔═══════════════════════════════════════════════════╗
║  AuraPet G2 Server — VoidPet & Voice Emotion      ║
║  Running on http://localhost:${PORT}                ║
║                                                   ║
║  LAN Access for G2 / Phone WebView:               ║
║  http://192.168.13.91:${PORT}                       ║
╚═══════════════════════════════════════════════════╝
  `)
})
