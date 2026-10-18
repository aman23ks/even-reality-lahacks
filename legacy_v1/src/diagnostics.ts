/**
 * src/diagnostics.ts — On-device capability probe for G2
 *
 * Answers the questions that decide the architecture:
 *   1. Do glasses audio frames keep arriving after FOREGROUND_EXIT?
 *   2. Does the WebView keep running JS with the phone locked / Even App backgrounded?
 *      (gaps in the heartbeat sequence = JS was suspended)
 *   3. Does SpeechRecognition exist inside the Even App WebView?
 *   4. Does the glasses mic tag frames with speakerRole self/other?
 *
 * Posts a snapshot to the backend every 3s (server writes diag.log) and shows a small overlay on the phone.
 */

import {
  waitForEvenAppBridge,
  OsEventTypeList,
  AudioInputSource,
  type EvenAppBridge,
} from '@evenrealities/even_hub_sdk'
import { API_BASE_URL } from './api'

const SYS_EVENT_NAMES: Record<number, string> = {
  [OsEventTypeList.FOREGROUND_ENTER_EVENT]: 'FOREGROUND_ENTER',
  [OsEventTypeList.FOREGROUND_EXIT_EVENT]: 'FOREGROUND_EXIT',
  [OsEventTypeList.ABNORMAL_EXIT_EVENT]: 'ABNORMAL_EXIT',
  [OsEventTypeList.SYSTEM_EXIT_EVENT]: 'SYSTEM_EXIT',
}

const diag = {
  seq: 0,
  bootAt: Date.now(),
  userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
  href: typeof location !== 'undefined' ? location.href : '',
  bridgeAttached: false,
  launchSource: null as string | null,
  device: null as unknown,
  speechRecognitionAvailable: false,
  getUserMediaAvailable: false,
  glassesMicOpened: null as boolean | null,
  audio: {
    frames: 0,
    bytes: 0,
    bySpeakerRole: {} as Record<string, number>,
    bySource: {} as Record<string, number>,
    framesSinceForegroundExit: 0,
    lastFrameAt: 0,
  },
  inForeground: true,
  visibility: typeof document !== 'undefined' ? document.visibilityState : 'unknown',
  events: [] as Array<{ t: number; kind: string; detail?: unknown }>,
}

function logEvent(kind: string, detail?: unknown): void {
  diag.events.push({ t: Date.now(), kind, detail })
  if (diag.events.length > 50) diag.events.shift()
  console.log('[Diag]', kind, detail ?? '')
}

async function getBridge(): Promise<EvenAppBridge | null> {
  const existing = (window as any).evenAppBridge
  if (existing) return existing
  try {
    return await Promise.race([
      waitForEvenAppBridge(),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), 6000)),
    ])
  } catch {
    return null
  }
}

async function attach(bridge: EvenAppBridge): Promise<void> {
  diag.bridgeAttached = true
  logEvent('bridge_attached')

  try {
    bridge.onLaunchSource((source) => {
      diag.launchSource = String(source)
      logEvent('launch_source', source)
    })
  } catch (e) {
    logEvent('launch_source_unsupported', String(e))
  }

  try {
    diag.device = await bridge.getDeviceInfo()
  } catch (e) {
    logEvent('device_info_error', String(e))
  }

  bridge.onEvenHubEvent((event) => {
    const audio = event.audioEvent
    if (audio) {
      const a = diag.audio
      a.frames++
      a.bytes += audio.audioPcm?.length ?? 0
      a.lastFrameAt = Date.now()
      const role = String(audio.speakerRole ?? 'undefined')
      const source = String(audio.source ?? 'undefined')
      a.bySpeakerRole[role] = (a.bySpeakerRole[role] ?? 0) + 1
      a.bySource[source] = (a.bySource[source] ?? 0) + 1
      if (!diag.inForeground) a.framesSinceForegroundExit++
      return
    }

    const sys = event.sysEvent
    if (sys && sys.eventType !== OsEventTypeList.IMU_DATA_REPORT) {
      const name = SYS_EVENT_NAMES[sys.eventType as number] ?? `SYS_${sys.eventType}`
      if (sys.eventType === OsEventTypeList.FOREGROUND_EXIT_EVENT) {
        diag.inForeground = false
        diag.audio.framesSinceForegroundExit = 0
      } else if (sys.eventType === OsEventTypeList.FOREGROUND_ENTER_EVENT) {
        diag.inForeground = true
      }
      logEvent(name, { exitReason: sys.systemExitReasonCode })
      void flush() // report lifecycle changes immediately
    }
  })

  // Open the glasses mic directly so this probe doesn't depend on app.ts start ordering
  try {
    diag.glassesMicOpened = await bridge.audioControl(true, AudioInputSource.Glasses)
    logEvent('glasses_mic_open', diag.glassesMicOpened)
  } catch (e) {
    diag.glassesMicOpened = false
    logEvent('glasses_mic_error', String(e))
  }
}

async function flush(): Promise<void> {
  diag.seq++
  const payload = { ...diag, sentAt: Date.now() }
  try {
    await fetch(`${API_BASE_URL}/api/diag`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      keepalive: true,
    })
  } catch {
    // backend unreachable — overlay still shows local state
  }
  renderOverlay()
}

function renderOverlay(): void {
  let el = document.getElementById('aurapet-diag')
  if (!el) {
    el = document.createElement('pre')
    el.id = 'aurapet-diag'
    el.style.cssText =
      'position:fixed;bottom:0;left:0;right:0;z-index:99999;margin:0;padding:6px 8px;' +
      'background:rgba(0,0,0,.85);color:#7CFC9A;font:10px/1.35 monospace;max-height:34vh;overflow:auto;'
    document.body.appendChild(el)
  }
  const a = diag.audio
  const ago = a.lastFrameAt ? `${((Date.now() - a.lastFrameAt) / 1000).toFixed(1)}s ago` : 'never'
  el.textContent = [
    `DIAG #${diag.seq}  bridge:${diag.bridgeAttached}  mic:${diag.glassesMicOpened}  fg:${diag.inForeground}  vis:${diag.visibility}`,
    `SpeechRecognition:${diag.speechRecognitionAvailable}  getUserMedia:${diag.getUserMediaAvailable}  launch:${diag.launchSource}`,
    `audio frames:${a.frames} last:${ago}  sinceFgExit:${a.framesSinceForegroundExit}`,
    `roles:${JSON.stringify(a.bySpeakerRole)}  sources:${JSON.stringify(a.bySource)}`,
    ...diag.events.slice(-4).map((e) => `${new Date(e.t).toLocaleTimeString()} ${e.kind}`),
  ].join('\n')
}

export async function startDiagnostics(): Promise<void> {
  const w = window as any
  diag.speechRecognitionAvailable = Boolean(w.SpeechRecognition || w.webkitSpeechRecognition)
  diag.getUserMediaAvailable = Boolean(navigator.mediaDevices?.getUserMedia)

  document.addEventListener('visibilitychange', () => {
    diag.visibility = document.visibilityState
    logEvent('visibility', document.visibilityState)
    void flush()
  })

  setInterval(() => void flush(), 3000)
  void flush()

  const bridge = await getBridge()
  if (bridge) await attach(bridge)
  else logEvent('no_bridge_found')
}
