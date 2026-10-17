/**
 * state.ts — Application State Manager
 * 
 * Simple state management for navigating between pages/screens
 * on the G2 glasses. The display is small (576×288) so apps
 * typically have a few distinct screens they navigate between.
 */

/** Define your app's possible screens here */
export type AppScreen = 'home' | 'detail' | 'processing' | 'result' | 'error'

/** Application state */
export interface AppState {
  currentScreen: AppScreen
  tapCount: number
  lastResult: string
  isProcessing: boolean
  errorMessage: string
}

/**
 * StateManager — reactive state container.
 * 
 * Usage:
 *   const state = new StateManager()
 *   state.onChange((newState) => { /* update display */ })
 *   state.update({ tapCount: state.get().tapCount + 1 })
 */
export class StateManager {
  private state: AppState
  private listeners: Array<(state: AppState) => void> = []

  constructor(initial?: Partial<AppState>) {
    this.state = {
      currentScreen: 'home',
      tapCount: 0,
      lastResult: '',
      isProcessing: false,
      errorMessage: '',
      ...initial,
    }
  }

  /** Get the current state (readonly snapshot) */
  get(): Readonly<AppState> {
    return { ...this.state }
  }

  /** Update state and notify listeners */
  update(partial: Partial<AppState>): void {
    this.state = { ...this.state, ...partial }
    this.notify()
  }

  /** Subscribe to state changes */
  onChange(listener: (state: AppState) => void): () => void {
    this.listeners.push(listener)
    // Return unsubscribe function
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener)
    }
  }

  private notify(): void {
    const snapshot = this.get()
    for (const listener of this.listeners) {
      try {
        listener(snapshot)
      } catch (err) {
        console.error('[StateManager] Listener error:', err)
      }
    }
  }
}
