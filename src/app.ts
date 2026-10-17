/**
 * app.ts — Main Application Logic
 * 
 * This is the heart of your Even Reality G2 app. It ties together:
 *   - SDK bridge initialization (waitForEvenAppBridge)
 *   - Display rendering (DisplayManager)
 *   - Input event handling (EventManager)
 *   - Backend API calls (ApiClient)
 *   - State management (StateManager)
 * 
 * ┌─────────────────────────────────────────────────────────────┐
 * │  MODIFY THIS FILE to build your hackathon project!          │
 * │                                                             │
 * │  The template shows a simple tap-counter with backend call. │
 * │  Replace the screens and event handlers with your idea.     │
 * └─────────────────────────────────────────────────────────────┘
 */

import { waitForEvenAppBridge } from '@evenrealities/even_hub_sdk'
import { DisplayManager } from './display'
import { EventManager } from './events'
import { ApiClient } from './api'
import { StateManager } from './state'
import type { AppState } from './state'

export class EvenG2App {
  private display!: DisplayManager
  private events!: EventManager
  private api: ApiClient
  private state: StateManager

  constructor() {
    this.api = new ApiClient()
    this.state = new StateManager()
  }

  /** Initialize the SDK bridge and start the app */
  async start(): Promise<void> {
    console.log('[App] Waiting for Even App Bridge...')

    // ──────────────────────────────────────────────────────────
    // CRITICAL: Always await this before calling any SDK method.
    // In the simulator it resolves immediately.
    // On real hardware it waits for the WebView bridge.
    // ──────────────────────────────────────────────────────────
    const bridge = await waitForEvenAppBridge()
    console.log('[App] Bridge ready!')

    // Initialize managers
    this.display = new DisplayManager(bridge)
    this.events = new EventManager(bridge)

    // Set up event handlers
    this.setupEventHandlers()

    // Listen for state changes to re-render
    this.state.onChange((newState) => this.render(newState))

    // Render the initial home screen
    await this.renderHomeScreen()

    // Optionally check backend health
    this.checkBackend()
  }

  // ── Event Handlers ──────────────────────────────────────────

  private setupEventHandlers(): void {
    // Single tap → depends on current screen
    this.events.on('tap', async (event) => {
      console.log('[App] Tap on container:', event.containerId)
      const screen = this.state.get().currentScreen

      switch (screen) {
        case 'home':
          await this.handleHomeTap()
          break
        case 'result':
          // Tap on result screen → go back to home
          this.state.update({ currentScreen: 'home' })
          await this.renderHomeScreen()
          break
        case 'error':
          // Tap on error → go back to home
          this.state.update({ currentScreen: 'home', errorMessage: '' })
          await this.renderHomeScreen()
          break
      }
    })

    // Double tap → exit app (required by Even QA)
    this.events.on('double_tap', () => {
      const screen = this.state.get().currentScreen

      if (screen === 'home') {
        // On the root page, show exit confirmation
        this.display.exitApp(1)
      } else {
        // On sub-pages, go back
        this.state.update({ currentScreen: 'home' })
        this.renderHomeScreen()
      }
    })

    // Long press → call the backend API
    this.events.on('long_press', async () => {
      console.log('[App] Long press → calling backend')
      await this.callBackend()
    })

    // Swipe forward/backward → cycle through screens
    this.events.on('swipe_forward', async () => {
      const count = this.state.get().tapCount + 1
      this.state.update({ tapCount: count })
      await this.display.updateText(1, 'main',
        `Even Reality G2\n\nTap count: ${count}\n\nLong press → API call\nDouble tap → exit`
      )
    })

    this.events.on('swipe_backward', async () => {
      const count = Math.max(0, this.state.get().tapCount - 1)
      this.state.update({ tapCount: count })
      await this.display.updateText(1, 'main',
        `Even Reality G2\n\nTap count: ${count}\n\nLong press → API call\nDouble tap → exit`
      )
    })
  }

  // ── Screen Renderers ────────────────────────────────────────

  private async renderHomeScreen(): Promise<void> {
    const { tapCount } = this.state.get()

    const mainText = this.display.createText({
      id: 1,
      name: 'main',
      content: `Even Reality G2\n\nTap count: ${tapCount}\n\nLong press → API call\nDouble tap → exit`,
      interactive: true,
    })

    await this.display.showStartupPage([mainText])
  }

  private async renderProcessingScreen(): Promise<void> {
    const mainText = this.display.createText({
      id: 1,
      name: 'main',
      content: 'Processing...\n\nCalling backend API',
      interactive: false,
    })

    await this.display.showPage([mainText])
  }

  private async renderResultScreen(result: string): Promise<void> {
    const mainText = this.display.createText({
      id: 1,
      name: 'main',
      content: `Result:\n\n${result}\n\nTap to go back`,
      interactive: true,
    })

    await this.display.showPage([mainText])
  }

  private async renderErrorScreen(error: string): Promise<void> {
    const mainText = this.display.createText({
      id: 1,
      name: 'main',
      content: `Error:\n\n${error}\n\nTap to go back`,
      interactive: true,
    })

    await this.display.showPage([mainText])
  }

  // ── Actions ─────────────────────────────────────────────────

  private async handleHomeTap(): Promise<void> {
    const count = this.state.get().tapCount + 1
    this.state.update({ tapCount: count })

    await this.display.updateText(1, 'main',
      `Even Reality G2\n\nTap count: ${count}\n\nLong press → API call\nDouble tap → exit`
    )
  }

  private async callBackend(): Promise<void> {
    this.state.update({ currentScreen: 'processing', isProcessing: true })
    await this.renderProcessingScreen()

    try {
      const response = await this.api.processText(
        `Hello from G2! Tap count: ${this.state.get().tapCount}`
      )

      if (response.success && response.data) {
        this.state.update({
          currentScreen: 'result',
          lastResult: response.data.result,
          isProcessing: false,
        })
        await this.renderResultScreen(response.data.result)
      } else {
        throw new Error(response.error ?? 'Unknown API error')
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error'
      this.state.update({
        currentScreen: 'error',
        errorMessage: msg,
        isProcessing: false,
      })
      await this.renderErrorScreen(msg)
    }
  }

  private async checkBackend(): Promise<void> {
    try {
      const health = await this.api.healthCheck()
      console.log('[App] Backend health:', health)
    } catch {
      console.warn('[App] Backend not reachable — that\'s okay for now')
    }
  }

  // ── Render dispatcher (called on state changes) ────────────

  private async render(state: AppState): Promise<void> {
    // This is called whenever state changes.
    // For simple apps, the event handlers already call render methods directly.
    // Use this for more complex state-driven rendering if needed.
    console.log('[App] State changed:', state.currentScreen)
  }
}
