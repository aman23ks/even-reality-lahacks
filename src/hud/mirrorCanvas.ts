/**
 * src/hud/mirrorCanvas.ts — Draws a MirrorFrame (what the lens shows) onto a 576×288 canvas,
 * tinted G2 green. Used by the phone dashboard and the laptop big-screen mirror.
 */

import { LENS } from './frames'
import type { MirrorFrame } from './renderer'

const GREEN = [64, 255, 128]
const imageCache = new Map<string, HTMLImageElement>()

export function drawMirror(canvas: HTMLCanvasElement, m: MirrorFrame | null): void {
  canvas.width = LENS.W
  canvas.height = LENS.H
  const c = canvas.getContext('2d')!
  c.fillStyle = '#000'
  c.fillRect(0, 0, LENS.W, LENS.H)
  if (!m) return

  const { frame, imageDataUrl } = m
  if (frame.image && imageDataUrl) {
    const { x, y, sprite } = frame.image
    let img = imageCache.get(imageDataUrl)
    if (!img) {
      img = new Image()
      img.src = imageDataUrl
      imageCache.clear()
      imageCache.set(imageDataUrl, img)
    }
    const paint = () => {
      c.imageSmoothingEnabled = false
      c.drawImage(img!, x, y, sprite.w, sprite.h)
      tint(c, x, y, sprite.w, sprite.h)
    }
    if (img.complete) paint()
    else img.onload = () => {
      paint()
    }
  }

  for (const t of frame.texts) {
    const alpha = 0.35 + (t.color / 4) * 0.65
    c.fillStyle = `rgba(${GREEN.join(',')},${alpha})`
    c.font = '20px "JetBrains Mono", ui-monospace, Menlo, monospace'
    c.textBaseline = 'top'
    const lines = wrap(c, t.content, t.w - 8)
    lines.forEach((ln, i) => {
      const y = t.y + 4 + i * 24
      if (y + 20 <= t.y + t.h) c.fillText(ln, t.x + 4, y)
    })
  }
}

/** Grey → G2 green */
function tint(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number): void {
  const img = c.getImageData(x, y, w, h)
  for (let i = 0; i < img.data.length; i += 4) {
    const v = img.data[i] / 255
    img.data[i] = GREEN[0] * v
    img.data[i + 1] = GREEN[1] * v
    img.data[i + 2] = GREEN[2] * v
  }
  c.putImageData(img, x, y)
}

function wrap(c: CanvasRenderingContext2D, text: string, maxW: number): string[] {
  const out: string[] = []
  for (const para of text.split('\n')) {
    let line = ''
    for (const word of para.split(' ')) {
      const next = line ? `${line} ${word}` : word
      if (c.measureText(next).width > maxW && line) {
        out.push(line)
        line = word
      } else {
        line = next
      }
    }
    out.push(line)
  }
  return out
}
