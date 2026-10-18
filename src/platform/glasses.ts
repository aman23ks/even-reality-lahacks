/**
 * src/platform/glasses.ts — Single owner of the Even Hub bridge.
 *
 * One onEvenHubEvent subscription, parsed into typed callbacks:
 *   input (tap / double tap / swipe / long press, from temple or ring)
 *   audio (PCM + speakerRole), imu (x,y,z), lifecycle (foreground enter/exit, exits)
 */

import {
  waitForEvenAppBridge,
  OsEventTypeList,
  AudioInputSource,
  ImuReportPace,
  type EvenAppBridge,
} from '@evenrealities/even_hub_sdk'
import type { InputType } from '../types'
import { diag, diagEvent } from '../diagnostics'

export type Lifecycle = 'foreground' | 'background' | 'exit'

export interface AudioFrame {
  pcm: Uint8Array
  role: 'self' | 'other' | 'unknown'
  source: string
}

type Fn<T> = (v: T) => void

export class Glasses {
  bridge: EvenAppBridge | null = null
  inForeground = true

  private inputFns: Fn<InputType>[] = []
  private audioFns: Fn<AudioFrame>[] = []
  private imuFns: Fn<{ x: number; y: number; z: number }>[] = []
  private lifecycleFns: Fn<Lifecycle>[] = []
  private lastInput = { type: '', at: 0 }

  async connect(timeoutMs = 4000): Promise<boolean> {
    // The SDK returns a bridge object even in a plain browser; only the Even App WebView has the host channel
    if (!(window as any).flutter_inappwebview) {
      diagEvent('not_in_even_app')
      return false
    }
    const existing = (window as any).evenAppBridge as EvenAppBridge | undefined
    let bridge: EvenAppBridge | null = existing ?? null
    if (!bridge) {
      bridge = await Promise.race([
        waitForEvenAppBridge().catch(() => null),
        new Promise<null>((resolve) => setTimeout(() => resolve(null), timeoutMs)),
      ])
    }
    if (!bridge) {
      diagEvent('no_bridge')
      return false
    }
    this.bridge = bridge
    diag.bridgeAttached = true
    diagEvent('bridge_attached')
    bridge.onEvenHubEvent((event) => this.handle(event))
    try {
      bridge.onLaunchSource((src) => {
        diag.launchSource = String(src)
      })
    } catch {
      // older hosts
    }
    return true
  }

  get connected(): boolean {
    return this.bridge !== null
  }

  onInput(fn: Fn<InputType>): void {
    this.inputFns.push(fn)
  }
  onAudio(fn: Fn<AudioFrame>): void {
    this.audioFns.push(fn)
  }
  onImu(fn: Fn<{ x: number; y: number; z: number }>): void {
    this.imuFns.push(fn)
  }
  onLifecycle(fn: Fn<Lifecycle>): void {
    this.lifecycleFns.push(fn)
  }

  async openMic(source: 'glasses' | 'phone'): Promise<boolean> {
    if (!this.bridge) return false
    try {
      const ok = await this.bridge.audioControl(
        true,
        source === 'glasses' ? AudioInputSource.Glasses : AudioInputSource.Phone,
      )
      diagEvent(`mic_open_${source}`, ok)
      return Boolean(ok)
    } catch (e) {
      diagEvent(`mic_open_${source}_error`, String(e))
      return false
    }
  }

  async closeMic(): Promise<void> {
    try {
      await this.bridge?.audioControl(false)
    } catch {
      // ignore
    }
  }

  async startImu(): Promise<boolean> {
    if (!this.bridge) return false
    try {
      const ok = await this.bridge.imuControl(true, ImuReportPace.P200)
      diagEvent('imu_open', ok)
      return Boolean(ok)
    } catch (e) {
      diagEvent('imu_open_error', String(e))
      return false
    }
  }

  exitDialog(): void {
    this.bridge?.shutDownPageContainer(1)
  }

  private handle(event: any): void {
    const audio = event.audioEvent
    if (audio) {
      const role = (String(audio.speakerRole ?? 'unknown') as AudioFrame['role']) || 'unknown'
      const frame: AudioFrame = { pcm: toBytes(audio.audioPcm), role, source: String(audio.source ?? '') }
      diag.audio.frames++
      diag.audio.bytes += frame.pcm.length
      diag.audio.lastFrameAt = Date.now()
      diag.audio.byRole[role] = (diag.audio.byRole[role] ?? 0) + 1
      diag.audio.bySource[frame.source] = (diag.audio.bySource[frame.source] ?? 0) + 1
      if (!this.inForeground) diag.audio.framesInBackground++
      for (const fn of this.audioFns) fn(frame)
      return
    }

    const sys = event.sysEvent
    if (sys) {
      const type = sys.eventType as number | undefined
      if (type === OsEventTypeList.IMU_DATA_REPORT) {
        const d = sys.imuData
        if (d && typeof d.x === 'number') {
          diag.imuFrames++
          diag.imuTrace.push([Date.now(), round3(d.x), round3(d.y ?? 0), round3(d.z ?? 0)])
          if (diag.imuTrace.length > 120) diag.imuTrace.shift()
          for (const fn of this.imuFns) fn({ x: d.x, y: d.y ?? 0, z: d.z ?? 0 })
        }
        return
      }
      if (type === OsEventTypeList.FOREGROUND_ENTER_EVENT) return this.lifecycle('foreground')
      if (type === OsEventTypeList.FOREGROUND_EXIT_EVENT) return this.lifecycle('background')
      if (type === OsEventTypeList.ABNORMAL_EXIT_EVENT || type === OsEventTypeList.SYSTEM_EXIT_EVENT) {
        return this.lifecycle('exit')
      }
      // Ring / source-aware presses arrive as sysEvents
      const input = mapInput(type)
      if (input) this.input(input)
      return
    }

    const ui = event.textEvent ?? event.listEvent
    if (ui) {
      const input = mapInput(ui.eventType as number | undefined)
      if (input) this.input(input)
    }
  }

  private input(type: InputType): void {
    // A touchpad press means AuraPet owns the lens, whatever the last lifecycle event said
    if (!this.inForeground) {
      this.inForeground = true
      diag.inForeground = true
    }
    // The same press can be reported via both a container event and a sysEvent
    const now = Date.now()
    if (this.lastInput.type === type && now - this.lastInput.at < 250) return
    this.lastInput = { type, at: now }
    diagEvent('input', type)
    for (const fn of this.inputFns) fn(type)
  }

  private lifecycle(state: Lifecycle): void {
    this.inForeground = state === 'foreground' ? true : state === 'background' ? false : this.inForeground
    diag.inForeground = this.inForeground
    diagEvent('lifecycle', state)
    for (const fn of this.lifecycleFns) fn(state)
  }
}

function mapInput(type: number | undefined): InputType | null {
  switch (type) {
    case OsEventTypeList.CLICK_EVENT:
    case undefined: // SDK normalizes 0 to undefined
      return 'tap'
    case OsEventTypeList.DOUBLE_CLICK_EVENT:
      return 'double_tap'
    case OsEventTypeList.SCROLL_TOP_EVENT:
      return 'swipe_backward'
    case OsEventTypeList.SCROLL_BOTTOM_EVENT:
      return 'swipe_forward'
    case OsEventTypeList.LONG_PRESS_EVENT:
      return 'long_press'
    default:
      return null
  }
}

function round3(n: number): number {
  return Math.round(n * 1000) / 1000
}

function toBytes(raw: unknown): Uint8Array {
  if (raw instanceof Uint8Array) return raw
  if (Array.isArray(raw)) return Uint8Array.from(raw)
  if (typeof raw === 'string') {
    const bin = atob(raw)
    const out = new Uint8Array(bin.length)
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
    return out
  }
  if (raw instanceof ArrayBuffer) return new Uint8Array(raw)
  return new Uint8Array(0)
}

/** Key/value storage: Even App storage when available, mirrored to window.localStorage */
export class Storage {
  constructor(private glasses: Glasses) {}

  async get(key: string): Promise<string | null> {
    if (this.glasses.bridge) {
      try {
        const v = await this.glasses.bridge.getLocalStorage(key)
        if (v) return v
      } catch {
        // fall through
      }
    }
    try {
      return window.localStorage.getItem(key)
    } catch {
      return null
    }
  }

  async set(key: string, value: string): Promise<void> {
    try {
      window.localStorage.setItem(key, value)
    } catch {
      // ignore quota / privacy mode
    }
    if (this.glasses.bridge) {
      try {
        await this.glasses.bridge.setLocalStorage(key, value)
      } catch {
        // ignore
      }
    }
  }
}
