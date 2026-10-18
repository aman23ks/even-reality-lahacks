/**
 * src/api.ts — Backend API Client for AuraPet
 */

// Follow the host that served the page so a changed LAN IP doesn't break the phone → backend link
export const API_BASE_URL =
  typeof window !== 'undefined' && window.location.hostname
    ? `${window.location.protocol}//${window.location.hostname}:3001`
    : import.meta.env.VITE_API_URL || 'http://localhost:3001'

export interface ApiResponse<T = unknown> {
  success: boolean
  data?: T
  error?: string
}

export class ApiClient {
  private baseUrl: string

  constructor(baseUrl?: string) {
    this.baseUrl = baseUrl ?? API_BASE_URL
  }

  /** Health check */
  async healthCheck(): Promise<ApiResponse<{ status: string; voiceProfileEnrolled: boolean }>> {
    return this.get('/api/health')
  }

  /** Enroll user voice fingerprint */
  async enrollVoice(profile: {
    medianPitchHz: number
    pitchVariance: number
    spectralCentroid: number
  }): Promise<ApiResponse<{ success: boolean; profile: any }>> {
    return this.post('/api/voice/enroll', profile)
  }

  /** Get enrolled voice profile */
  async getVoiceProfile(): Promise<ApiResponse<{ success: boolean; profile: any }>> {
    return this.get('/api/voice/profile')
  }

  /** Send extracted acoustic features to server for emotion analysis */
  async analyzeAudioFeatures(features: {
    pitchHz: number
    energyRms: number
    centroid: number
  }): Promise<ApiResponse<{
    emotion: {
      primary: string
      confidence: number
      isUserVoice: boolean
      userVoiceConfidence: number
    }
    suggestions: Array<{ title: string; step: string; points: number }>
  }>> {
    return this.post('/api/audio/analyze', features)
  }

  /** Get personalized micro-action from AI coach */
  async getCoachSuggestion(
    emotion: string,
    petName: string,
    petLevel: number
  ): Promise<ApiResponse<{ suggestion: string }>> {
    return this.post('/api/coach/suggestion', { emotion, petName, petLevel })
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
      const message = err instanceof Error ? err.message : 'Network error'
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
      const message = err instanceof Error ? err.message : 'Network error'
      return { success: false, error: message }
    }
  }
}
