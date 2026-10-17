/**
 * api.ts — Backend API Client
 * 
 * Provides a typed client for calling your Express backend.
 * The backend handles API keys, external service calls, and
 * any server-side logic your app needs.
 * 
 * IMPORTANT: The phone WebView cannot use `localhost` — it must
 * use your laptop's LAN IP address. Set VITE_API_URL in .env
 * to something like http://192.168.1.42:3001
 */

// Vite injects env vars prefixed with VITE_ at build time
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001'

/** Generic API response wrapper */
export interface ApiResponse<T = unknown> {
  success: boolean
  data?: T
  error?: string
}

/**
 * ApiClient — calls your Express backend from the WebView.
 * 
 * Usage:
 *   const api = new ApiClient()
 *   const health = await api.healthCheck()
 *   const result = await api.processText('Hello from G2!')
 */
export class ApiClient {
  private baseUrl: string

  constructor(baseUrl?: string) {
    this.baseUrl = baseUrl ?? API_BASE_URL
  }

  /** Check if the backend is reachable */
  async healthCheck(): Promise<ApiResponse<{ status: string; timestamp: string }>> {
    return this.get('/api/health')
  }

  /** 
   * Send text to the backend for processing.
   * This is a template endpoint — customize it for your use case.
   * Examples: send to an LLM, translate, summarize, etc.
   */
  async processText(text: string): Promise<ApiResponse<{ result: string }>> {
    return this.post('/api/process', { text })
  }

  /**
   * Send audio data to the backend for processing.
   * The G2 has a microphone — use this for speech-to-text, etc.
   */
  async processAudio(audioData: string): Promise<ApiResponse<{ transcription: string }>> {
    return this.post('/api/audio', { audioData })
  }

  // ── Generic HTTP methods ──────────────────────────────────

  private async get<T>(path: string): Promise<ApiResponse<T>> {
    try {
      const response = await fetch(`${this.baseUrl}${path}`)
      if (!response.ok) {
        return { success: false, error: `HTTP ${response.status}: ${response.statusText}` }
      }
      const data = await response.json()
      return { success: true, data }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      console.error(`[ApiClient] GET ${path} failed:`, message)
      return { success: false, error: message }
    }
  }

  private async post<T>(path: string, body: unknown): Promise<ApiResponse<T>> {
    try {
      const response = await fetch(`${this.baseUrl}${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!response.ok) {
        return { success: false, error: `HTTP ${response.status}: ${response.statusText}` }
      }
      const data = await response.json()
      return { success: true, data }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      console.error(`[ApiClient] POST ${path} failed:`, message)
      return { success: false, error: message }
    }
  }
}
