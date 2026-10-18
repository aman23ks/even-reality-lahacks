/**
 * src/hud/frames.ts — Every lens screen, as pure data.
 *
 * A HudFrame is one image container (the pet) + up to two text containers. `layout` identifies the
 * container geometry: same layout → in-place updates (no flicker); new layout → page rebuild.
 * Text is ASCII-only to be safe with the G2 font.
 */

import type { SpriteSpec } from './sprite'

export const LENS = { W: 576, H: 288 }

export interface HudText {
  id: number
  name: string
  x: number
  y: number
  w: number
  h: number
  content: string
  color: number // 0..4 brightness
  capture: boolean
}

export interface HudImage {
  id: number
  name: string
  x: number
  y: number
  sprite: SpriteSpec
}

export interface HudFrame {
  layout: string
  image?: HudImage
  texts: HudText[]
}

const IMG = { id: 1, name: 'pet' }
const INFO = { id: 2, name: 'info' }
const HINT = { id: 3, name: 'hint' }

type SpriteBase = Omit<SpriteSpec, 'w' | 'h'>

/** Tiny pet in the corner + one word. The lens stays almost empty. */
export function ambientFrame(sprite: SpriteBase, line: string, bright: boolean): HudFrame {
  return {
    layout: 'ambient',
    image: { ...IMG, x: 8, y: 8, sprite: { ...sprite, w: 72, h: 72 } },
    texts: [{ ...INFO, x: 88, y: 20, w: 420, h: 56, content: line, color: bright ? 4 : 2, capture: true }],
  }
}

/** Pet on the left, text on the right */
export function cardFrame(sprite: SpriteBase, body: string, hint: string): HudFrame {
  return {
    layout: 'card',
    image: { ...IMG, x: 16, y: 64, sprite: { ...sprite, w: 144, h: 144 } },
    texts: [
      { ...INFO, x: 180, y: 40, w: 380, h: 190, content: body, color: 4, capture: true },
      { ...HINT, x: 180, y: 236, w: 380, h: 44, content: hint, color: 2, capture: false },
    ],
  }
}

/** Big centered pet with a caption underneath (hatch, evolution) */
export function wideFrame(sprite: SpriteBase, caption: string): HudFrame {
  return {
    layout: 'wide',
    image: { ...IMG, x: 144, y: 6, sprite: { ...sprite, w: 288, h: 144 } },
    texts: [{ ...INFO, x: 24, y: 160, w: 528, h: 120, content: caption, color: 4, capture: true }],
  }
}

/** Text only (safety screen) */
export function textFrame(content: string): HudFrame {
  return {
    layout: 'text',
    texts: [{ ...INFO, x: 24, y: 24, w: 528, h: 240, content, color: 4, capture: true }],
  }
}

export function bar(progress: number, width = 14): string {
  const n = Math.round(Math.max(0, Math.min(1, progress)) * width)
  return '[' + '#'.repeat(n) + '-'.repeat(width - n) + ']'
}
