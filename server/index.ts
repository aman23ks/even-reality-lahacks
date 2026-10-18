/**
 * server/index.ts — AuraPet backend
 *
 *   POST /api/utterance   audio (WAV base64) or text → transcript + mood label (+ reset verification)
 *   POST /api/mirror      latest lens frame from the phone
 *   GET  /api/mirror/stream   Server-Sent Events for the laptop "big screen" mirror
 *   POST /api/diag        device diagnostics (appended to diag.log)
 *
 * Privacy: audio and transcripts are processed in memory and never written to disk.
 * Providers: Claude (ANTHROPIC_API_KEY) for mood labels + reset checks; Groq or OpenAI for speech-to-text
 * (and mood labels if Claude isn't set). With no keys, falls back to keyword heuristics.
 */

import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import fs from 'node:fs'
import path from 'node:path'
import Anthropic from '@anthropic-ai/sdk'

dotenv.config()

const app = express()
const PORT = Number(process.env.PORT) || 3001

app.set('trust proxy', 1) // behind Render's proxy: req.ip is the real client
app.use(cors({ origin: '*' }))
app.use(express.json({ limit: '15mb' }))

// Hosted deploys also serve the built web app, so https://<host>/mirror.html is the projector view
const DIST = path.join(process.cwd(), 'dist')
if (fs.existsSync(DIST)) app.use(express.static(DIST))

// ── Abuse guard for the paid endpoint ─────────────────────────
// Optional shared key (APP_KEY on the server, VITE_APP_KEY baked into the app) + per-IP rate limit,
// so a public URL can't be used to run up the speech/LLM bill.
const APP_KEY = process.env.APP_KEY || ''
const hits = new Map<string, number[]>()
function guard(req: express.Request, res: express.Response, next: express.NextFunction): void {
  // The web app served by this same server (e.g. https://<host>/ for browser demos) is allowed without
  // the key; everything else (the .ehpk on phones) must send it. Rate limiting applies to both.
  const sameOrigin = req.header('origin') === `${req.protocol}://${req.header('host')}`
  if (APP_KEY && !sameOrigin && req.header('x-aurapet-key') !== APP_KEY) {
    res.status(401).json({ error: 'bad app key' })
    return
  }
  const now = Date.now()
  const key = req.ip ?? 'unknown'
  const recent = (hits.get(key) ?? []).filter((t) => now - t < 60_000)
  if (recent.length >= 60) {
    res.status(429).json({ error: 'slow down' })
    return
  }
  recent.push(now)
  hits.set(key, recent)
  next()
}

type Label = 'storm' | 'fog' | 'clear'
type ResetId = 'name_it' | 'in_control' | 'good_thing' | 'look_up' | 'breathe'

interface Provider {
  name: string
  base: string
  key: string
  sttModel: string
  llmModel: string
}

/** OpenAI-compatible provider (Groq or OpenAI): used for speech-to-text, and for mood labels when Claude isn't set */
function provider(): Provider | null {
  if (process.env.GROQ_API_KEY) {
    return {
      name: 'groq',
      base: 'https://api.groq.com/openai/v1',
      key: process.env.GROQ_API_KEY,
      sttModel: process.env.GROQ_STT_MODEL || 'whisper-large-v3-turbo',
      llmModel: process.env.GROQ_LLM_MODEL || 'qwen/qwen3.8-27b',
    }
  }
  if (process.env.OPENAI_API_KEY) {
    return {
      name: 'openai',
      base: 'https://api.openai.com/v1',
      key: process.env.OPENAI_API_KEY,
      sttModel: process.env.OPENAI_STT_MODEL || 'whisper-1',
      llmModel: process.env.OPENAI_LLM_MODEL || 'gpt-4o-mini',
    }
  }
  return null
}

// Routing (measured on this key: Groq qwen3.8-27b ~160ms, Claude Haiku ~850ms, Claude Opus ~2s per call):
//   every sentence → fast Groq/OpenAI model (live mood must feel instant)
//   reset answers  → Claude (needs judgment: "did they actually name a feeling?"); rare, so latency is fine
// Either side falls back to the other, then to keyword heuristics.
const CLAUDE_MODEL = process.env.ANTHROPIC_MODEL || 'claude-haiku-4-5'
const claude = process.env.ANTHROPIC_API_KEY ? new Anthropic({ timeout: 10_000, maxRetries: 1 }) : null

function liveName(): string | null {
  const p = provider()
  if (p) return `${p.name}:${p.llmModel}`
  return claude ? `anthropic:${CLAUDE_MODEL}` : null
}

function verifyName(): string | null {
  if (claude) return `anthropic:${CLAUDE_MODEL}`
  return liveName()
}

function llmName(): string | null {
  return liveName()
}

// ── Health ────────────────────────────────────────────────────

app.get('/api/health', (_req, res) => {
  const p = provider()
  res.json({ status: 'ok', stt: p ? `${p.name}:${p.sttModel}` : null, llm: llmName(), verify: verifyName() })
})

// ── Utterance analysis ───────────────────────────────────────

const VERIFY_CRITERIA: Partial<Record<ResetId, string>> = {
  name_it:
    "The speaker names or describes a feeling they have right now (e.g. \"I'm stressed\", \"I feel overwhelmed because...\"). Complaining without naming any feeling does not count.",
  in_control: 'The speaker states one concrete thing they can do, choose, or control next (an action or plan).',
  good_thing: 'The speaker mentions something positive, good, or that they appreciate, however small.',
}

const CRISIS_RE =
  /\b(kill myself|end my life|suicid\w*|want to die|wanna die|don'?t want to (be here|live|exist)|hurt myself|self[- ]?harm|no reason to live|better off without me)\b/i

// Whisper tends to invent these on silence / noise
const HALLUCINATIONS = new Set(['you', 'thank you', 'thanks for watching', 'thank you for watching', 'bye', 'okay', 'so', 'uh', 'um', 'hmm'])

app.post('/api/utterance', guard, async (req, res) => {
  const started = Date.now()
  try {
    const { audioBase64, text, prosody, verify, speaker } = req.body as {
      audioBase64?: string
      text?: string
      prosody?: { loudnessRatio?: number; pitchRatio?: number }
      verify?: ResetId
      speaker?: 'self' | 'other'
    }
    const p = provider()

    let transcript = (text ?? '').trim()
    if (!transcript && audioBase64) {
      if (!p) {
        res.json(emptyResult())
        return
      }
      transcript = await transcribe(p, audioBase64)
    }
    const norm = transcript.toLowerCase().replace(/[^a-z' ]/g, '').trim()
    if (!norm || HALLUCINATIONS.has(norm)) {
      res.json(emptyResult())
      return
    }

    const criterion = verify ? VERIFY_CRITERIA[verify] : undefined
    const prompt = buildPrompt(prosody ?? {}, criterion)
    const fast = p ? () => classifyOpenAiCompat(p, prompt, transcript, criterion) : null
    const smart = claude ? () => classifyClaude(prompt, transcript, criterion) : null
    const [first, second] = criterion ? [smart ?? fast, fast] : [fast ?? smart, smart]
    const llm = first
      ? first().catch((e) => {
          if (!second || second === first) throw e
          console.warn('[classify] primary failed, trying the other provider:', String(e))
          return second()
        })
      : null
    let result = llm
      ? await llm.catch((e) => {
          console.warn('[classify] LLM failed, using heuristics:', String(e))
          return null
        })
      : null
    if (!result) result = classifyHeuristic(transcript, prosody ?? {}, verify)

    // Belt and braces: never miss an explicit crisis phrase
    if (CRISIS_RE.test(transcript)) result.classification.crisis = true

    const words = transcript.split(/\s+/).filter(Boolean).length
    console.log(
      `[utterance] ${Date.now() - started}ms ${result.source} label=${result.classification.label}` +
        ` i=${result.classification.intensity.toFixed(2)}${verify ? ` verify(${verify})=${result.verification?.passed}` : ''}`,
    )
    // The other person's words never leave the server: only their mood label goes back
    if (speaker === 'other') {
      res.json({ transcript: '', words, classification: result.classification, source: result.source })
      return
    }
    res.json({ transcript, words, ...result })
  } catch (err) {
    console.error('[utterance] error', err)
    res.status(500).json({ error: 'analysis failed' })
  }
})

function emptyResult() {
  return {
    transcript: '',
    words: 0,
    classification: { label: 'clear', intensity: 0, emotion: '', crisis: false },
    source: 'heuristic',
  }
}

async function transcribe(p: Provider, audioBase64: string): Promise<string> {
  const form = new FormData()
  form.append('file', new Blob([Buffer.from(audioBase64, 'base64')], { type: 'audio/wav' }), 'utterance.wav')
  form.append('model', p.sttModel)
  form.append('language', 'en')
  form.append('response_format', 'json')
  form.append('temperature', '0')
  const r = await fetch(`${p.base}/audio/transcriptions`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${p.key}` },
    body: form,
  })
  if (!r.ok) throw new Error(`STT ${r.status}: ${(await r.text()).slice(0, 200)}`)
  const data = (await r.json()) as { text?: string }
  return (data.text ?? '').trim()
}

type Kind = 'thanks' | 'compliment' | 'encourage' | 'care' | 'none'

interface Social {
  /** the wearer said something sharp, dismissive or hurtful TO another person */
  harsh: boolean
  /** an apology / repair attempt ("sorry, that came out wrong") */
  repair: boolean
  /** a kind act toward someone */
  kind: Kind
  /** what the feeling is about, 1-2 generic words ("deadlines", "manager"); "" if none */
  topic: string
}

interface Analysis {
  classification: { label: Label; intensity: number; emotion: string; crisis: boolean }
  verification?: { passed: boolean; reason: string }
  social: Social
  source: 'llm' | 'heuristic'
}

function buildPrompt(prosody: { loudnessRatio?: number; pitchRatio?: number }, criterion?: string): string {
  const hints: string[] = []
  if (prosody.loudnessRatio && prosody.loudnessRatio > 1.3) hints.push('louder than usual')
  if (prosody.loudnessRatio && prosody.loudnessRatio < 0.75) hints.push('quieter than usual')
  if (prosody.pitchRatio && prosody.pitchRatio > 1.15) hints.push('higher pitch than usual')
  if (prosody.pitchRatio && prosody.pitchRatio > 0 && prosody.pitchRatio < 0.9) hints.push('lower pitch than usual')

  return `You read one short utterance spoken by the wearer of smart glasses, for a wellbeing companion that helps them recover from stress. Reply with JSON only:
{"label":"storm|fog|clear","intensity":0.0-1.0,"emotion":"1-2 words","crisis":false,"verify_passed":true|false,"verify_reason":"under 40 chars","harsh":false,"repair":false,"kind":"thanks|compliment|encourage|care|none","topic":"1-2 words"}
- storm: anxious, stressed, frustrated, angry, overwhelmed, panicked (high-energy negative)
- fog: sad, tired, discouraged, lonely, hopeless, flat (low-energy negative)
- clear: calm, neutral, content, happy, curious, focused. Ordinary task talk is clear with low intensity.
- intensity: how strongly the feeling comes through (0.2 mild, 0.5 clear, 0.8+ strong).
- crisis: true ONLY for self-harm, suicidal thoughts, or wanting to die / not exist.
- harsh: true only if the speaker says something sharp, dismissive, blaming or hurtful TO another person ("whatever, do it yourself", "that's a stupid idea"). Complaining about things ("this laptop is useless") is NOT harsh.
- repair: true if the speaker apologises or walks something back ("sorry, that came out wrong", "I didn't mean that", "my bad").
- kind: thanks (thanking someone), compliment (praising someone), encourage (cheering someone on), care (asking how someone is / offering help), otherwise none.
- topic: what the feeling is about in 1-2 generic lowercase words ("deadlines", "manager", "laptop", "money"); "" for small talk.
- Voice cues (${hints.join(', ') || 'none'}) are tiebreakers only; the words matter most.
- ${
    criterion
      ? `verify_passed: does the utterance satisfy this exercise? ${criterion} verify_reason: if it fails, a kind one-line coaching hint.`
      : 'No exercise is active: set verify_passed to false and verify_reason to "".'
  }`
}

const CLASSIFY_SCHEMA = {
  type: 'object',
  properties: {
    label: { type: 'string', enum: ['storm', 'fog', 'clear'] },
    intensity: { type: 'number' },
    emotion: { type: 'string' },
    crisis: { type: 'boolean' },
    verify_passed: { type: 'boolean' },
    verify_reason: { type: 'string' },
    harsh: { type: 'boolean' },
    repair: { type: 'boolean' },
    kind: { type: 'string', enum: ['thanks', 'compliment', 'encourage', 'care', 'none'] },
    topic: { type: 'string' },
  },
  required: ['label', 'intensity', 'emotion', 'crisis', 'verify_passed', 'verify_reason', 'harsh', 'repair', 'kind', 'topic'],
  additionalProperties: false,
}

async function classifyClaude(system: string, transcript: string, criterion?: string): Promise<Analysis> {
  const isHaiku = CLAUDE_MODEL.includes('haiku')
  const msg = await claude!.beta.messages.create({
    model: CLAUDE_MODEL,
    max_tokens: 2048,
    // Policy declines are re-run on Anthropic's recommended fallback model instead of failing
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    // Short, real-time classification: low effort keeps latency down (Haiku doesn't take effort)
    output_config: isHaiku
      ? { format: { type: 'json_schema', schema: CLASSIFY_SCHEMA } }
      : { effort: 'low', format: { type: 'json_schema', schema: CLASSIFY_SCHEMA } },
    system,
    messages: [{ role: 'user', content: transcript }],
  })
  if (msg.stop_reason === 'refusal') throw new Error(`Claude declined (${msg.stop_details?.category ?? 'unknown'})`)
  const text = msg.content.find((b) => b.type === 'text')
  if (!text || text.type !== 'text') throw new Error(`no text block (stop_reason=${msg.stop_reason})`)
  return toAnalysis(JSON.parse(text.text), criterion)
}

async function classifyOpenAiCompat(p: Provider, system: string, transcript: string, criterion?: string): Promise<Analysis> {
  const r = await fetch(`${p.base}/chat/completions`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${p.key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: p.llmModel,
      temperature: 0,
      max_tokens: 400,
      response_format: { type: 'json_object' },
      ...(p.llmModel.startsWith('openai/gpt-oss') ? { reasoning_effort: 'low' } : {}),
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: transcript },
      ],
    }),
  })
  if (!r.ok) throw new Error(`LLM ${r.status}: ${(await r.text()).slice(0, 200)}`)
  const data = (await r.json()) as { choices?: Array<{ message?: { content?: string } }> }
  return toAnalysis(JSON.parse(data.choices?.[0]?.message?.content ?? '{}'), criterion)
}

function toAnalysis(j: any, criterion?: string): Analysis {
  const label: Label = ['storm', 'fog', 'clear'].includes(j.label) ? j.label : 'clear'
  return {
    classification: {
      label,
      intensity: clamp01(Number(j.intensity)),
      emotion: String(j.emotion ?? '').slice(0, 24),
      crisis: j.crisis === true,
    },
    verification: criterion
      ? { passed: j.verify_passed === true, reason: String(j.verify_reason ?? '').slice(0, 60) }
      : undefined,
    social: {
      harsh: j.harsh === true,
      repair: j.repair === true,
      kind: ['thanks', 'compliment', 'encourage', 'care'].includes(j.kind) ? j.kind : 'none',
      topic: String(j.topic ?? '').toLowerCase().replace(/[^a-z ]/g, '').trim().slice(0, 20),
    },
    source: 'llm',
  }
}

// ── Heuristic fallback (no API key / provider down) ───────────

const LEX: Record<Label, string[]> = {
  storm: ['stress', 'anxious', 'anxiety', 'nervous', 'panic', 'overwhelm', 'pressure', 'deadline', 'behind', 'angry', 'mad', 'furious', 'annoy', 'irritat', 'frustrat', 'hate', 'ugh', 'damn', 'impossible', 'worried', 'scared', 'afraid', 'tense', 'rush', 'nothing works', 'broken', 'stupid', 'sick of', 'fed up'],
  fog: ['sad', 'tired', 'exhausted', 'drained', 'lonely', 'alone', 'hopeless', 'pointless', 'down', 'depress', 'cry', 'miss', 'empty', 'numb', 'give up', "can't do", 'failure', 'useless', 'heavy', 'sigh'],
  clear: ['good', 'great', 'happy', 'glad', 'calm', 'relax', 'fine', 'okay', 'nice', 'love', 'awesome', 'excited', 'better', 'thank', 'grateful', 'fun', 'cool', 'peace', 'proud', 'curious', 'interesting'],
}

function classifyHeuristic(
  transcript: string,
  prosody: { loudnessRatio?: number },
  verify?: ResetId,
): Analysis {
  const t = transcript.toLowerCase()
  const hits = (l: Label) => LEX[l].filter((w) => t.includes(w)).length
  const storm = hits('storm') + (prosody.loudnessRatio && prosody.loudnessRatio > 1.35 ? 0.5 : 0)
  const fog = hits('fog')
  const clear = hits('clear')
  let label: Label = 'clear'
  let n = clear
  if (storm > n && storm >= fog) {
    label = 'storm'
    n = storm
  } else if (fog > n) {
    label = 'fog'
    n = fog
  }
  const intensity = n === 0 ? 0.2 : Math.min(0.95, 0.45 + n * 0.18)

  let verification: Analysis['verification']
  if (verify === 'name_it') {
    const passed = /\b(i'?m|i am|i feel|feeling|i'?ve been|i was)\b/.test(t) && (hits('storm') + hits('fog') + hits('clear') > 0 || /\bfeel/.test(t))
    verification = { passed, reason: passed ? '' : 'name the feeling: "I feel..."' }
  } else if (verify === 'in_control') {
    const passed = /\b(i can|i will|i'?ll|i could|i'?m going to|gonna|next i|let me|i should|my plan|i need to)\b/.test(t)
    verification = { passed, reason: passed ? '' : 'say "I can..." + one action' }
  } else if (verify === 'good_thing') {
    const passed = hits('clear') > 0 || /\b(liked|enjoyed|went well|managed|finished|smile|laugh)\b/.test(t)
    verification = { passed, reason: passed ? '' : 'one small good thing counts' }
  }

  return {
    classification: { label, intensity, emotion: '', crisis: false },
    verification,
    social: heuristicSocial(t),
    source: 'heuristic',
  }
}

function heuristicSocial(t: string): Social {
  const kind: Kind = /\b(thank|thanks|appreciate)\b/.test(t)
    ? 'thanks'
    : /\b(great job|well done|you're amazing|nice work|love your)\b/.test(t)
      ? 'compliment'
      : /\b(you got this|you can do it|keep going)\b/.test(t)
        ? 'encourage'
        : /\b(are you ok|how are you|can i help|need help)\b/.test(t)
          ? 'care'
          : 'none'
  const topics = ['deadline', 'manager', 'boss', 'laptop', 'meeting', 'money', 'client', 'exam', 'demo', 'code']
  const topic = topics.find((w) => t.includes(w)) ?? ''
  return {
    harsh: /\b(whatever|do it yourself|shut up|stupid idea|your fault|not my problem)\b/.test(t),
    repair: /\b(sorry|my bad|didn't mean|came out wrong|apologi[sz]e)\b/.test(t),
    kind,
    topic: topic ? (topic === 'deadline' ? 'deadlines' : topic) : '',
  }
}

function clamp01(n: number): number {
  return Number.isFinite(n) ? Math.max(0, Math.min(1, n)) : 0
}

// ── Lens mirror (laptop big screen) ───────────────────────────

let latestMirror: unknown = null
let lastGlassesFrameAt = 0
const mirrorClients = new Set<express.Response>()

app.post('/api/mirror', (req, res) => {
  // Several copies of the app may be open (phone WebViews, laptop tabs); the one on real glasses wins
  if (req.body?.fromGlasses) lastGlassesFrameAt = Date.now()
  else if (Date.now() - lastGlassesFrameAt < 15000) {
    res.json({ ok: true, ignored: true })
    return
  }
  latestMirror = req.body
  const payload = `data: ${JSON.stringify(latestMirror)}\n\n`
  for (const c of mirrorClients) c.write(payload)
  res.json({ ok: true })
})

app.get('/api/mirror/stream', (req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
  })
  if (latestMirror) res.write(`data: ${JSON.stringify(latestMirror)}\n\n`)
  mirrorClients.add(res)
  const ping = setInterval(() => res.write(': ping\n\n'), 15000)
  req.on('close', () => {
    clearInterval(ping)
    mirrorClients.delete(res)
  })
})

// ── Device diagnostics ────────────────────────────────────────

// Kept in memory too, so `npm run monitor -- <deployed-url>` can watch a hosted backend
const diagRing: Array<{ seq: number; line: string }> = []
let diagSeq = 0

app.post('/api/diag', (req, res) => {
  const line = JSON.stringify({ receivedAt: new Date().toISOString(), ...req.body })
  diagRing.push({ seq: ++diagSeq, line })
  if (diagRing.length > 400) diagRing.shift()
  fs.appendFile(path.join(process.cwd(), 'diag.log'), line + '\n', () => {})
  res.json({ ok: true })
})

app.get('/api/diag/recent', (req, res) => {
  const after = Number(req.query.after) || 0
  const items = diagRing.filter((d) => d.seq > after)
  res.json({ seq: diagSeq, lines: items.map((d) => d.line) })
})

app.listen(PORT, '0.0.0.0', () => {
  const p = provider()
  console.log(`AuraPet server on http://0.0.0.0:${PORT}`)
  console.log(`Live mood labels: ${liveName() ?? 'keyword heuristics (no AI key)'}`)
  console.log(`Reset checks:     ${verifyName() ?? 'keyword heuristics (no AI key)'}`)
  console.log(`Speech-to-text: ${p ? `${p.name}:${p.sttModel}` : 'phone on-device speech recognition (no Groq/OpenAI key)'}`)
})
