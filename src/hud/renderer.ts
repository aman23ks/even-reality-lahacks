/**
 * src/hud/renderer.ts — Sends HudFrames to the G2 and to the mirror (phone + laptop big screen).
 *
 * Single-flight: while a BLE update is in progress only the newest frame is kept, so animations
 * never build a backlog. Same layout → textContainerUpgrade / updateImageRawData only.
 */

import {
  CreateStartUpPageContainer,
  ImageContainerProperty,
  RebuildPageContainer,
  TextContainerProperty,
  TextContainerUpgrade,
  ImageRawDataUpdate,
  MenuContainerProperty,
  MenuItemProperty,
} from '@evenrealities/even_hub_sdk'
import type { Glasses } from '../platform/glasses'
import { api } from '../api'
import { diag, diagEvent } from '../diagnostics'
import type { HudFrame } from './frames'
import { drawSprite, pngBytes, spriteKey, type SpriteOutput } from './sprite'

export interface MirrorFrame {
  frame: HudFrame
  imageDataUrl?: string
  caption?: string
  at: number
  /** true when this instance is driving real glasses; the server prefers these over browser previews */
  fromGlasses?: boolean
}

export class HudRenderer {
  private pending: HudFrame | null = null
  private busy = false
  private startupDone = false
  private layout = ''
  private texts = new Map<number, string>()
  private imageKey = ''
  private mirrorFns: Array<(m: MirrorFrame) => void> = []
  private lastMirrorPost = 0
  private mirrorTimer?: ReturnType<typeof setTimeout>
  caption = ''
  /** Compassion Coach's entries in the G2 long-press menu (omitting them on rebuild would clear the menu) */
  menuItems: Array<{ itemID: number; itemName: string }> = []

  private menu(): MenuContainerProperty | undefined {
    return this.menuItems.length ? new MenuContainerProperty({ menuItems: this.menuItems.map((m) => new MenuItemProperty(m)) }) : undefined
  }

  constructor(private glasses: Glasses) {
    glasses.onLifecycle((s) => {
      // Coming back to the lens (after the exit dialog or another app): the host may have torn our
      // page down, so recreate it from scratch rather than updating containers that no longer exist
      if (s === 'foreground') {
        this.startupDone = false
        this.invalidate()
      }
    })
  }

  /** Called with every rendered frame (phone mirror) */
  onMirror(fn: (m: MirrorFrame) => void): void {
    this.mirrorFns.push(fn)
  }

  /** Force a full rebuild on the next frame (e.g. after returning to foreground) */
  invalidate(): void {
    this.lastSig = ''
    this.layout = ''
    this.texts.clear()
    this.imageKey = ''
  }

  get startupCreated(): boolean {
    return this.startupDone
  }

  private lastSig = ''

  render(frame: HudFrame): Promise<void> {
    const sig = JSON.stringify(frame.texts) + (frame.image ? spriteKey(frame.image.sprite) + frame.image.x : '') + this.caption
    if (sig === this.lastSig) return Promise.resolve()
    this.lastSig = sig
    this.pending = frame
    if (this.busy) return Promise.resolve()
    return this.loop()
  }

  private async loop(): Promise<void> {
    this.busy = true
    try {
      while (this.pending) {
        const frame = this.pending
        this.pending = null
        await this.draw(frame)
      }
    } finally {
      this.busy = false
    }
  }

  private async draw(frame: HudFrame): Promise<void> {
    const key = frame.image ? spriteKey(frame.image.sprite) : ''
    const sprite = frame.image ? drawSprite(frame.image.sprite) : null
    this.publishMirror(frame, sprite)

    const bridge = this.glasses.bridge
    // Always draw: the host can report "background" while Compassion Coach is still on the lens (inputs keep
    // arriving), and if we truly aren't on screen the host simply ignores the update.
    if (!bridge) return

    try {
      if (!this.startupDone || frame.layout !== this.layout) {
        const textObject = frame.texts.map(
          (t) =>
            new TextContainerProperty({
              xPosition: t.x,
              yPosition: t.y,
              width: t.w,
              height: t.h,
              borderWidth: 0,
              borderColor: 0,
              paddingLength: 4,
              containerID: t.id,
              containerName: t.name,
              content: t.content,
              isEventCapture: t.capture ? 1 : 0,
              textColor: t.color,
            }),
        )
        const imageObject = frame.image
          ? [
              new ImageContainerProperty({
                xPosition: frame.image.x,
                yPosition: frame.image.y,
                width: frame.image.sprite.w,
                height: frame.image.sprite.h,
                containerID: frame.image.id,
                containerName: frame.image.name,
              }),
            ]
          : undefined
        const containerTotalNum = textObject.length + (imageObject?.length ?? 0)

        if (!this.startupDone) {
          const res = await bridge.createStartUpPageContainer(
            new CreateStartUpPageContainer({ containerTotalNum, textObject, imageObject, menuObject: this.menu() }),
          )
          diag.startupPageResult = Number(res)
          diagEvent('startup_page', res)
          // Non-zero usually means another instance/page already exists; fall back to rebuild
          if (Number(res) !== 0) {
            await bridge.rebuildPageContainer(new RebuildPageContainer({ containerTotalNum, textObject, imageObject, menuObject: this.menu() }))
          }
          this.startupDone = true
        } else {
          const ok = await bridge.rebuildPageContainer(
            new RebuildPageContainer({ containerTotalNum, textObject, imageObject, menuObject: this.menu() }),
          )
          if (!ok) {
            diagEvent('rebuild_failed', frame.layout)
            this.startupDone = false // next frame recreates the page
          }
        }
        this.layout = frame.layout
        this.texts = new Map(frame.texts.map((t) => [t.id, `${t.color}|${t.content}`]))
        this.imageKey = ''
      } else {
        for (const t of frame.texts) {
          const sig = `${t.color}|${t.content}`
          if (this.texts.get(t.id) === sig) continue
          await bridge.textContainerUpgrade(
            new TextContainerUpgrade({ containerID: t.id, containerName: t.name, content: t.content, textColor: t.color }),
          )
          this.texts.set(t.id, sig)
        }
      }

      if (frame.image && sprite && key !== this.imageKey) {
        await this.sendImage(frame.image.id, frame.image.name, sprite)
        this.imageKey = key
      }
    } catch (e) {
      diagEvent('hud_error', String(e))
    }
  }

  /**
   * The host converts images to 4-bit grey itself. We send PNG bytes first; if the host rejects them
   * we switch to raw 8-bit grey bytes for the rest of the session.
   */
  private async sendImage(id: number, name: string, sprite: SpriteOutput): Promise<void> {
    const bridge = this.glasses.bridge!
    const attempt = async (mode: string) => {
      const imageData = mode === 'png' ? await pngBytes(sprite.canvas) : Array.from(sprite.gray)
      const res = await bridge.updateImageRawData(
        new ImageRawDataUpdate({ containerID: id, containerName: name, imageData }),
      )
      diag.lastImageResult = String(res)
      return String(res)
    }
    const res = await attempt(diag.imageMode)
    if (res !== 'success' && res !== 'sendFailed') {
      const other = diag.imageMode === 'png' ? 'raw' : 'png'
      const retry = await attempt(other)
      if (retry === 'success') {
        diag.imageMode = other
        diagEvent('image_mode', other)
      }
    }
  }

  private publishMirror(frame: HudFrame, sprite: SpriteOutput | null): void {
    const m: MirrorFrame = {
      frame,
      imageDataUrl: sprite?.canvas.toDataURL('image/png'),
      caption: this.caption,
      at: Date.now(),
      fromGlasses: this.glasses.connected,
    }
    this.mirrorFns.forEach((fn) => fn(m))
    // Throttle network mirror during animations
    const now = Date.now()
    clearTimeout(this.mirrorTimer)
    if (now - this.lastMirrorPost > 250) {
      this.lastMirrorPost = now
      api.mirror(m)
    } else {
      this.mirrorTimer = setTimeout(() => {
        this.lastMirrorPost = Date.now()
        api.mirror(m)
      }, 300)
    }
  }
}
