/**
 * main.ts — Compassion Coach entry point (runs in the Even App WebView on the phone, or a desktop browser for preview)
 *
 * Boot order matters on G2: bridge → first lens page → mic + IMU (the glasses mic only streams once a page exists).
 */

import { Glasses, Storage } from './platform/glasses'
import { Store } from './engine/store'
import { Segmenter } from './audio/segmenter'
import { AudioInput } from './audio/input'
import { startSpeechFallback } from './audio/speechFallback'
import { HeadTracker } from './engine/imu'
import { HudRenderer } from './hud/renderer'
import { Aura } from './engine/aura'
import { mountPhoneUi } from './phone/ui'
import { api } from './api'
import { diag, diagEvent, startDiagnostics } from './diagnostics'

async function boot(): Promise<void> {
  startDiagnostics()

  const glasses = new Glasses()
  const store = new Store(new Storage(glasses))
  const segmenter = new Segmenter()
  const audio = new AudioInput(glasses, segmenter)
  const head = new HeadTracker(glasses)
  const hud = new HudRenderer(glasses)
  const backend = { online: false, stt: null as string | null, llm: null as string | null }

  const connected = await glasses.connect()
  await store.load()

  const aura = new Aura(glasses, store, head, hud, segmenter)
  mountPhoneUi({
    aura,
    store,
    audio,
    hud,
    glassesConnected: () => glasses.connected,
    lensActive: () => glasses.inForeground,
    backend: () => backend,
  })
  if (import.meta.env.DEV) Object.assign(window, { aura, store }) // console access while developing

  // Backend capabilities decide where transcripts come from
  let speechFallbackOn = false
  const checkBackend = async () => {
    const h = await api.health()
    backend.online = Boolean(h)
    backend.stt = h?.stt ?? null
    backend.llm = h?.llm ?? null
    diag.backend = { online: backend.online, stt: Boolean(backend.stt), llm: Boolean(backend.llm) }
    aura.backendStt = Boolean(backend.stt)
    if (backend.online && !backend.stt && !speechFallbackOn) {
      speechFallbackOn = startSpeechFallback((text) => void aura.submitText(text, true))
    }
    aura.speechReady = Boolean(backend.stt) || speechFallbackOn
  }
  await checkBackend()
  setInterval(() => void checkBackend(), 30_000)

  // Save on every way out
  glasses.onLifecycle((s) => {
    if (s !== 'foreground') void store.flush()
  })
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') void store.flush()
  })
  window.addEventListener('pagehide', () => void store.flush())

  if (connected) {
    await waitFor(() => hud.startupCreated, 5000)
    await glasses.startImu()
    await audio.start()
  } else if (store.data.onboarded) {
    // Browser preview: the mic may need a tap ("Start microphone") if autoplay policy blocks it
    await audio.start()
  }
  diagEvent('boot_done', { connected, source: audio.source })
}

function waitFor(cond: () => boolean, timeoutMs: number): Promise<void> {
  const start = Date.now()
  return new Promise((resolve) => {
    const t = setInterval(() => {
      if (cond() || Date.now() - start > timeoutMs) {
        clearInterval(t)
        resolve()
      }
    }, 100)
  })
}

boot().catch((err) => {
  diagEvent('boot_error', String(err))
  console.error(err)
})
