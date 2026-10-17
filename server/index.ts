/**
 * server/index.ts — Express Backend Server
 * 
 * This server runs on your laptop and handles:
 *   - API key management (keep secrets server-side!)
 *   - External API calls (OpenAI, Google AI, etc.)
 *   - Any compute-heavy processing
 *   - CORS headers (required for the phone WebView to reach this)
 * 
 * The phone WebView calls this server over the local network.
 * Make sure CORS is configured and the phone can reach your laptop's IP.
 */

import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'

// Load .env file
dotenv.config()

const app = express()
const PORT = process.env.PORT || 3001

// ── Middleware ─────────────────────────────────────────────────

// CORS: Allow requests from the phone WebView.
// The WebView origin varies, so we allow all origins during development.
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}))

app.use(express.json({ limit: '10mb' }))  // Large limit for audio data

// Request logging
app.use((req, _res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`)
  next()
})

// ── Routes ────────────────────────────────────────────────────

/** Health check — verify the backend is running */
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
  })
})

/**
 * Process text — template endpoint for your app logic.
 * 
 * Replace this with whatever your hackathon project needs:
 *   - Call OpenAI / Google AI for text generation
 *   - Translate text
 *   - Summarize content
 *   - Look up information
 *   - etc.
 */
app.post('/api/process', async (req, res) => {
  try {
    const { text } = req.body

    if (!text) {
      res.status(400).json({ error: 'Missing "text" in request body' })
      return
    }

    console.log('[Process] Received:', text)

    // ┌─────────────────────────────────────────────────────────┐
    // │  REPLACE THIS with your actual processing logic!        │
    // │                                                         │
    // │  Examples:                                               │
    // │    - Call OpenAI: await callOpenAI(text)                 │
    // │    - Call Google AI: await callGemini(text)              │
    // │    - Any custom logic                                   │
    // └─────────────────────────────────────────────────────────┘

    // Template: echo back the input with a timestamp
    const result = `Processed: "${text}" at ${new Date().toLocaleTimeString()}`

    res.json({ result })
  } catch (err) {
    console.error('[Process] Error:', err)
    const message = err instanceof Error ? err.message : 'Internal server error'
    res.status(500).json({ error: message })
  }
})

/**
 * Process audio — template endpoint for microphone data.
 * 
 * The G2 glasses have a microphone. The Even SDK can capture audio
 * and send it as base64 data. Use this endpoint for:
 *   - Speech-to-text (Whisper, Google STT, etc.)
 *   - Voice commands
 *   - Audio analysis
 */
app.post('/api/audio', async (req, res) => {
  try {
    const { audioData } = req.body

    if (!audioData) {
      res.status(400).json({ error: 'Missing "audioData" in request body' })
      return
    }

    console.log('[Audio] Received audio data, length:', audioData.length)

    // ┌─────────────────────────────────────────────────────────┐
    // │  REPLACE THIS with your speech-to-text logic!           │
    // │                                                         │
    // │  Example with OpenAI Whisper:                            │
    // │    const transcription = await openai.audio.            │
    // │      transcriptions.create({                            │
    // │        file: audioBuffer,                               │
    // │        model: 'whisper-1',                              │
    // │      })                                                 │
    // └─────────────────────────────────────────────────────────┘

    // Template: return a placeholder
    const transcription = '[Audio processing not yet implemented]'

    res.json({ transcription })
  } catch (err) {
    console.error('[Audio] Error:', err)
    const message = err instanceof Error ? err.message : 'Internal server error'
    res.status(500).json({ error: message })
  }
})

// ── Example: OpenAI Integration (uncomment and add your key) ──
/*
import OpenAI from 'openai'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

async function callOpenAI(prompt: string): Promise<string> {
  const completion = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      { role: 'system', content: 'You are a helpful assistant for smart glasses. Keep responses very brief (under 100 chars) since the display is small (576x288 px).' },
      { role: 'user', content: prompt },
    ],
    max_tokens: 100,
  })
  return completion.choices[0]?.message?.content ?? 'No response'
}
*/

// ── Start Server ──────────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`
╔═══════════════════════════════════════════════════╗
║  Even Reality G2 — Backend Server                 ║
║  Running on http://localhost:${PORT}                ║
║                                                   ║
║  For the phone WebView, use your LAN IP:          ║
║  http://<your-lan-ip>:${PORT}                       ║
╚═══════════════════════════════════════════════════╝
  `)
})
