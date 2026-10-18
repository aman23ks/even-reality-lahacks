/**
 * src/api.ts — Backend client for Compassion Coach
 */

import type { ResetId, UtteranceResult } from './types'

/**
 * Where the backend lives:
 *  - packaged .ehpk for Even Hub: VITE_BACKEND_URL baked in by `npm run package:prod <url>`
 *  - dev (Vite on :5173/:5174): same host, port 3001, so a changed LAN IP doesn't break the phone link
 *  - page served by the backend itself (e.g. the hosted mirror): same origin
 */
function backendUrl(): string {
  const baked = import.meta.env.VITE_BACKEND_URL as string | undefined
  if (baked) return baked.replace(/\/$/, '')
  if (typeof window === 'undefined' || !window.location.hostname) return 'http://localhost:3001'
  const { protocol, hostname, port, origin } = window.location
  if (port === '5173' || port === '5174') return `${protocol}//${hostname}:3001`
  if (protocol.startsWith('http')) return origin
  return 'http://localhost:3001'
}

export const API_BASE_URL = backendUrl()

/** Optional shared key so a public backend URL can't be used to spend the API credits */
const APP_KEY = (import.meta.env.VITE_APP_KEY as string | undefined) ?? ''

export interface Prosody {
  /** utterance loudness relative to this user's usual loudness (1 = typical) */
  loudnessRatio: number
  /** median pitch relative to this user's usual pitch (1 = typical), 0 if unknown */
  pitchRatio: number
}

export interface Health {
  status: string
  stt: string | null
  llm: string | null
}

export interface UtteranceRequest {
  audioBase64?: string
  text?: string
  durationMs: number
  voicedMs: number
  prosody: Prosody
  verify?: ResetId
  petName: string
  /** 'other' = the person you're talking to: only their mood comes back */
  speaker?: 'self' | 'other'
}

async function post<T>(path: string, body: unknown, timeoutMs = 15000): Promise<T | null> {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), timeoutMs)
  try {
    const res = await fetch(`${API_BASE_URL}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(APP_KEY ? { 'x-aurapet-key': APP_KEY } : {}) },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    })
    if (!res.ok) return null
    return (await res.json()) as T
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
}

export const api = {
  async health(): Promise<Health | null> {
    try {
      const res = await fetch(`${API_BASE_URL}/api/health`)
      return res.ok ? ((await res.json()) as Health) : null
    } catch {
      return null
    }
  },

  /** Transcribe (if audio) + classify mood (+ verify a reset if requested) */
  analyze(req: UtteranceRequest): Promise<UtteranceResult | null> {
    return post<UtteranceResult>('/api/utterance', req)
  },

  /** Push the current lens frame so the laptop mirror can show it */
  mirror(frame: unknown): void {
    void post('/api/mirror', frame, 4000)
  },
}
