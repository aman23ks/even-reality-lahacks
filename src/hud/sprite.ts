/**
 * src/hud/sprite.ts — Procedural pixel-art pet for the G2's 4-level greyscale display.
 *
 * Drawn at 1/3 resolution, quantized to 4 grey levels, then upscaled with nearest-neighbour so it
 * looks like crisp pixel art. Same function renders the lens image and the phone/laptop mirror.
 */

import type { StageId, Weather } from '../types'

export type Face = 'happy' | 'neutral' | 'worried' | 'sad' | 'calm'
export type Effect = 'none' | 'bloom' | 'evolve'
/** Earned by badges; worn on the lens */
export type Accessory = 'patch' | 'flower' | 'glasses' | 'scarf'

export interface SpriteSpec {
  w: number
  h: number
  stage: StageId
  face: Face
  weather: Weather | 'none'
  /** body scale, used by the breathing pacer (1 = normal) */
  scale: number
  effect: Effect
  glow: boolean
  /** animation frame counter */
  frame: number
  /** draw nothing (quiet lens) */
  hidden?: boolean
  accessories?: Accessory[]
}

export function spriteKey(s: SpriteSpec): string {
  return [s.w, s.h, s.stage, s.face, s.weather, s.scale.toFixed(2), s.effect, s.glow, s.frame % 4, s.hidden ? 1 : 0, (s.accessories ?? []).join(',')].join('|')
}

const PX = 3 // logical pixel size

export interface SpriteOutput {
  canvas: HTMLCanvasElement
  gray: Uint8Array // w*h bytes, 0..255
}

export function drawSprite(spec: SpriteSpec): SpriteOutput {
  const W = Math.round(spec.w / PX)
  const H = Math.round(spec.h / PX)
  const lo = document.createElement('canvas')
  lo.width = W
  lo.height = H
  const c = lo.getContext('2d')!
  c.fillStyle = '#000'
  c.fillRect(0, 0, W, H)

  if (spec.hidden) return finish(lo, c, spec)

  const unit = Math.min(W, H)
  const cx = W / 2
  const cy = H * 0.6
  const baseR: Record<StageId, number> = { egg: 0.22, sprout: 0.2, wisp: 0.24, guardian: 0.27, zenith: 0.29 }
  const wide = spec.w > spec.h ? 1.3 : 1 // hatch/evolution screens: make the moment bigger
  const r = unit * baseR[spec.stage] * spec.scale * wide

  if (spec.effect === 'evolve') drawRays(c, cx, cy, unit, spec.frame)
  if (spec.glow) dottedRing(c, cx, cy, r * 1.35, spec.frame)
  if (spec.stage === 'egg') {
    drawEgg(c, cx, cy, unit * wide * spec.scale)
  } else {
    drawAccessoriesBehind(c, spec.stage, cx, cy, r)
    blob(c, cx, cy, r)
    drawAccessoriesFront(c, spec.stage, cx, cy, r)
    drawFace(c, spec.face, cx, cy, r)
    for (const a of spec.accessories ?? []) drawAccessory(c, a, cx, cy, r)
  }
  drawWeather(c, spec.weather, W, H, cx, cy, r, spec.frame)
  if (spec.effect === 'bloom') drawBloom(c, cx, cy, r, unit, spec.frame)
  return finish(lo, c, spec)
}

function finish(lo: HTMLCanvasElement, c: CanvasRenderingContext2D, spec: SpriteSpec): SpriteOutput {
  const W = lo.width
  const H = lo.height
  // Quantize to the G2's 4 grey levels
  const img = c.getImageData(0, 0, W, H)
  for (let i = 0; i < img.data.length; i += 4) {
    const lum = img.data[i] * 0.3 + img.data[i + 1] * 0.59 + img.data[i + 2] * 0.11
    const q = lum < 40 ? 0 : lum < 110 ? 85 : lum < 190 ? 170 : 255
    img.data[i] = img.data[i + 1] = img.data[i + 2] = q
    img.data[i + 3] = 255
  }
  c.putImageData(img, 0, 0)

  const out = document.createElement('canvas')
  out.width = spec.w
  out.height = spec.h
  const o = out.getContext('2d')!
  o.imageSmoothingEnabled = false
  o.drawImage(lo, 0, 0, spec.w, spec.h)

  const full = o.getImageData(0, 0, spec.w, spec.h).data
  const gray = new Uint8Array(spec.w * spec.h)
  for (let i = 0; i < gray.length; i++) gray[i] = full[i * 4]
  return { canvas: out, gray }
}

// ── primitives ────────────────────────────────────────────────

const BODY = '#aaa'
const LINE = '#fff'
const DIM = '#555'

function ellipse(c: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number, fill?: string, stroke?: string, lw = 1): void {
  c.beginPath()
  c.ellipse(x, y, Math.max(0.5, rx), Math.max(0.5, ry), 0, 0, Math.PI * 2)
  if (fill) {
    c.fillStyle = fill
    c.fill()
  }
  if (stroke) {
    c.strokeStyle = stroke
    c.lineWidth = lw
    c.stroke()
  }
}

function poly(c: CanvasRenderingContext2D, pts: Array<[number, number]>, fill?: string, stroke?: string): void {
  c.beginPath()
  c.moveTo(pts[0][0], pts[0][1])
  for (const p of pts.slice(1)) c.lineTo(p[0], p[1])
  c.closePath()
  if (fill) {
    c.fillStyle = fill
    c.fill()
  }
  if (stroke) {
    c.strokeStyle = stroke
    c.lineWidth = 1
    c.stroke()
  }
}

function line(c: CanvasRenderingContext2D, pts: Array<[number, number]>, color = LINE, lw = 1): void {
  c.beginPath()
  c.moveTo(pts[0][0], pts[0][1])
  for (const p of pts.slice(1)) c.lineTo(p[0], p[1])
  c.strokeStyle = color
  c.lineWidth = lw
  c.stroke()
}

function arc(c: CanvasRenderingContext2D, x: number, y: number, r: number, a0: number, a1: number, color = LINE, lw = 1): void {
  c.beginPath()
  c.arc(x, y, r, a0, a1)
  c.strokeStyle = color
  c.lineWidth = lw
  c.stroke()
}

// ── body parts ────────────────────────────────────────────────

function blob(c: CanvasRenderingContext2D, cx: number, cy: number, r: number): void {
  ellipse(c, cx, cy, r * 1.05, r * 0.92, BODY, LINE, 1.2)
  // little feet
  ellipse(c, cx - r * 0.45, cy + r * 0.88, r * 0.22, r * 0.12, BODY, LINE)
  ellipse(c, cx + r * 0.45, cy + r * 0.88, r * 0.22, r * 0.12, BODY, LINE)
  // cheek highlight
  ellipse(c, cx - r * 0.5, cy - r * 0.45, r * 0.12, r * 0.08, LINE)
}

function drawEgg(c: CanvasRenderingContext2D, cx: number, cy: number, unit: number): void {
  const rx = unit * 0.2
  const ry = unit * 0.27
  ellipse(c, cx, cy - unit * 0.04, rx, ry, BODY, LINE, 1.2)
  line(c, [
    [cx - rx * 0.9, cy - unit * 0.02],
    [cx - rx * 0.45, cy - unit * 0.08],
    [cx, cy],
    [cx + rx * 0.45, cy - unit * 0.08],
    [cx + rx * 0.9, cy - unit * 0.02],
  ])
  ellipse(c, cx - rx * 0.4, cy - ry * 0.5, rx * 0.15, rx * 0.12, DIM)
  ellipse(c, cx + rx * 0.35, cy + ry * 0.35, rx * 0.12, rx * 0.1, DIM)
}

function drawAccessoriesBehind(c: CanvasRenderingContext2D, stage: StageId, cx: number, cy: number, r: number): void {
  if (stage === 'wisp') {
    // flame tail
    poly(c, [[cx + r * 0.8, cy + r * 0.2], [cx + r * 1.55, cy - r * 0.35], [cx + r * 1.2, cy + r * 0.25], [cx + r * 1.5, cy + r * 0.3], [cx + r * 0.9, cy + r * 0.6]], DIM, LINE)
  }
  if (stage === 'guardian' || stage === 'zenith') {
    const span = stage === 'zenith' ? 1.9 : 1.55
    for (const s of [-1, 1]) {
      poly(c, [
        [cx + s * r * 0.7, cy - r * 0.2],
        [cx + s * r * span, cy - r * (stage === 'zenith' ? 1.1 : 0.8)],
        [cx + s * r * (span - 0.15), cy - r * 0.1],
        [cx + s * r * (span - 0.05), cy + r * 0.2],
        [cx + s * r * 0.8, cy + r * 0.3],
      ], DIM, LINE)
    }
  }
}

function drawAccessoriesFront(c: CanvasRenderingContext2D, stage: StageId, cx: number, cy: number, r: number): void {
  const top = cy - r * 0.92
  if (stage === 'sprout') {
    line(c, [[cx, top], [cx, top - r * 0.45]], LINE, 1.2)
    ellipse(c, cx - r * 0.22, top - r * 0.45, r * 0.24, r * 0.11, BODY, LINE)
    ellipse(c, cx + r * 0.22, top - r * 0.5, r * 0.24, r * 0.11, BODY, LINE)
  }
  if (stage === 'wisp') {
    for (const s of [-1, 1]) {
      poly(c, [[cx + s * r * 0.35, top + r * 0.15], [cx + s * r * 0.65, top - r * 0.45], [cx + s * r * 0.8, top + r * 0.35]], BODY, LINE)
    }
  }
  if (stage === 'guardian' || stage === 'zenith') {
    for (const s of [-1, 1]) {
      poly(c, [[cx + s * r * 0.3, top + r * 0.12], [cx + s * r * 0.5, top - r * 0.5], [cx + s * r * 0.6, top + r * 0.2]], LINE)
    }
  }
  if (stage === 'zenith') {
    ellipse(c, cx, top - r * 0.75, r * 0.6, r * 0.14, undefined, LINE, 1.2)
    for (let i = -2; i <= 2; i++) {
      poly(c, [[cx + i * r * 0.16 - r * 0.07, top - r * 0.05], [cx + i * r * 0.16, top - r * 0.32], [cx + i * r * 0.16 + r * 0.07, top - r * 0.05]], LINE)
    }
  }
}

function drawFace(c: CanvasRenderingContext2D, face: Face, cx: number, cy: number, r: number): void {
  const ex = r * 0.38
  const ey = cy - r * 0.08
  const es = Math.max(1.2, r * 0.13)
  const black = '#000'
  switch (face) {
    case 'happy':
      for (const s of [-1, 1]) arc(c, cx + s * ex, ey + es * 0.4, es, Math.PI * 1.15, Math.PI * 1.85, black, 1.4)
      arc(c, cx, cy + r * 0.12, r * 0.28, Math.PI * 0.15, Math.PI * 0.85, black, 1.4)
      break
    case 'calm':
      for (const s of [-1, 1]) arc(c, cx + s * ex, ey - es * 0.3, es, Math.PI * 0.15, Math.PI * 0.85, black, 1.4)
      arc(c, cx, cy + r * 0.2, r * 0.16, Math.PI * 0.2, Math.PI * 0.8, black, 1.2)
      break
    case 'neutral':
      for (const s of [-1, 1]) ellipse(c, cx + s * ex, ey, es, es * 1.2, black)
      line(c, [[cx - r * 0.14, cy + r * 0.32], [cx + r * 0.14, cy + r * 0.32]], black, 1.2)
      break
    case 'worried':
      for (const s of [-1, 1]) {
        ellipse(c, cx + s * ex, ey + es * 0.3, es, es * 1.2, black)
        line(c, [[cx + s * ex * 0.55, ey - es * 2.2], [cx + s * ex * 1.5, ey - es * 1.4]], black, 1.3)
      }
      line(c, [[cx - r * 0.25, cy + r * 0.38], [cx - r * 0.08, cy + r * 0.3], [cx + r * 0.08, cy + r * 0.38], [cx + r * 0.25, cy + r * 0.3]], black, 1.2)
      break
    case 'sad':
      for (const s of [-1, 1]) {
        ellipse(c, cx + s * ex, ey + es * 0.5, es * 0.9, es, black)
        line(c, [[cx + s * ex * 0.5, ey - es * 1.3], [cx + s * ex * 1.5, ey - es * 2.0]], black, 1.2)
      }
      arc(c, cx, cy + r * 0.55, r * 0.22, Math.PI * 1.2, Math.PI * 1.8, black, 1.3)
      ellipse(c, cx + ex + es * 0.3, ey + es * 2.6, es * 0.5, es * 0.8, LINE)
      break
  }
}

/** Badge rewards, drawn on top of the body */
function drawAccessory(c: CanvasRenderingContext2D, a: Accessory, cx: number, cy: number, r: number): void {
  const ex = r * 0.38
  const ey = cy - r * 0.08
  const es = Math.max(1.2, r * 0.13)
  switch (a) {
    case 'glasses': // read the room
      for (const s of [-1, 1]) ellipse(c, cx + s * ex, ey, es * 2, es * 1.8, undefined, LINE, 1.1)
      line(c, [[cx - ex + es * 2, ey], [cx + ex - es * 2, ey]], LINE, 1)
      break
    case 'flower': { // kindness
      // Two blossoms sitting on the top edge of the head, so they read against the dark background
      const pr = Math.max(1.2, r * 0.15)
      for (const [fx, fy] of [[cx - r * 0.42, cy - r * 0.98], [cx + r * 0.05, cy - r * 1.05]] as Array<[number, number]>) {
        for (let k = 0; k < 5; k++) {
          const ang = (k / 5) * Math.PI * 2 - Math.PI / 2
          ellipse(c, fx + Math.cos(ang) * pr * 1.15, fy + Math.sin(ang) * pr * 1.15, pr * 0.85, pr * 0.85, LINE)
        }
        ellipse(c, fx, fy, pr * 0.7, pr * 0.7, '#000')
      }
      break
    }
    case 'patch': { // repair: a little heart plaster
      const hx = cx + r * 0.58
      const hy = cy + r * 0.32
      const hr = Math.max(1, r * 0.12)
      ellipse(c, hx - hr * 0.8, hy, hr, hr, LINE)
      ellipse(c, hx + hr * 0.8, hy, hr, hr, LINE)
      poly(c, [[hx - hr * 1.75, hy + hr * 0.3], [hx + hr * 1.75, hy + hr * 0.3], [hx, hy + hr * 2.1]], LINE)
      break
    }
    case 'scarf': { // calmed down on your own
      const sy = cy + r * 0.52
      poly(c, [[cx - r * 0.82, sy - r * 0.1], [cx + r * 0.82, sy - r * 0.1], [cx + r * 0.78, sy + r * 0.14], [cx - r * 0.78, sy + r * 0.14]], LINE)
      poly(c, [[cx + r * 0.35, sy + r * 0.1], [cx + r * 0.6, sy + r * 0.1], [cx + r * 0.66, sy + r * 0.62], [cx + r * 0.42, sy + r * 0.58]], LINE)
      break
    }
  }
}

function cloud(c: CanvasRenderingContext2D, x: number, y: number, s: number, fill: string): void {
  ellipse(c, x - s * 0.5, y, s * 0.55, s * 0.4, fill, LINE)
  ellipse(c, x + s * 0.5, y, s * 0.55, s * 0.4, fill, LINE)
  ellipse(c, x, y - s * 0.3, s * 0.65, s * 0.5, fill, LINE)
  ellipse(c, x, y + s * 0.05, s * 0.9, s * 0.32, fill)
}

function drawWeather(c: CanvasRenderingContext2D, w: Weather | 'none', W: number, H: number, cx: number, cy: number, r: number, frame: number): void {
  const s = Math.min(W, H) * 0.13
  if (w === 'clear') {
    const x = W * 0.18
    const y = H * 0.2
    ellipse(c, x, y, s * 0.45, s * 0.45, LINE)
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 + (frame % 2) * 0.2
      line(c, [[x + Math.cos(a) * s * 0.65, y + Math.sin(a) * s * 0.65], [x + Math.cos(a) * s * 0.95, y + Math.sin(a) * s * 0.95]])
    }
  }
  if (w === 'cloudy') cloud(c, W * 0.78, H * 0.2, s, DIM)
  if (w === 'stormy') {
    const x = cx + r * 0.2
    const y = cy - r * 2.05
    cloud(c, x, y, s * 1.2, DIM)
    poly(c, [[x + s * 0.1, y + s * 0.3], [x - s * 0.25, y + s * 0.95], [x + s * 0.05, y + s * 0.9], [x - s * 0.15, y + s * 1.45], [x + s * 0.35, y + s * 0.7], [x + s * 0.05, y + s * 0.75]], LINE)
    for (let i = 0; i < 4; i++) {
      const dx = x - s * 0.9 + i * s * 0.55
      const dy = y + s * 0.6 + ((frame + i) % 3) * s * 0.25
      line(c, [[dx, dy], [dx - s * 0.08, dy + s * 0.22]], LINE)
    }
  }
  if (w === 'foggy') {
    for (let i = 0; i < 3; i++) {
      const y = cy - r * 0.2 + i * r * 0.5
      const off = ((frame + i) % 2) * 3
      for (let x = off; x < W; x += 7) line(c, [[x, y], [x + 4, y]], DIM, 1)
    }
  }
}

function drawBloom(c: CanvasRenderingContext2D, cx: number, cy: number, r: number, unit: number, frame: number): void {
  const spots: Array<[number, number]> = [[-1.6, -0.6], [1.6, -0.8], [-1.4, 0.7], [1.5, 0.6], [0, -1.7]]
  spots.forEach(([dx, dy], i) => {
    const x = cx + dx * r
    const y = cy + dy * r
    const pr = unit * 0.035 * (1 + ((frame + i) % 2) * 0.3)
    for (let k = 0; k < 5; k++) {
      const a = (k / 5) * Math.PI * 2
      ellipse(c, x + Math.cos(a) * pr * 1.2, y + Math.sin(a) * pr * 1.2, pr, pr, BODY)
    }
    ellipse(c, x, y, pr * 0.8, pr * 0.8, LINE)
  })
}

function drawRays(c: CanvasRenderingContext2D, cx: number, cy: number, unit: number, frame: number): void {
  const n = 12
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + frame * 0.12
    const r0 = unit * 0.38
    const r1 = unit * (0.55 + (i % 2) * 0.1)
    line(c, [[cx + Math.cos(a) * r0, cy + Math.sin(a) * r0], [cx + Math.cos(a) * r1, cy + Math.sin(a) * r1]], i % 2 ? DIM : LINE, 1)
  }
}

function dottedRing(c: CanvasRenderingContext2D, cx: number, cy: number, r: number, frame: number): void {
  const n = 18
  for (let i = 0; i < n; i++) {
    if ((i + frame) % 3 === 0) continue
    const a = (i / n) * Math.PI * 2
    ellipse(c, cx + Math.cos(a) * r, cy + Math.sin(a) * r * 0.9, 0.7, 0.7, DIM)
  }
}

/** Encode a canvas as PNG bytes (what the Even host decodes before converting to 4-bit grey) */
export async function pngBytes(canvas: HTMLCanvasElement): Promise<number[]> {
  const blob: Blob | null = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'))
  if (!blob) return []
  return Array.from(new Uint8Array(await blob.arrayBuffer()))
}
