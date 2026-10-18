/**
 * src/mirror.ts — Laptop "big screen" mirror of the wearer's lens, for judges.
 * Open http://<laptop-ip>:5173/mirror.html on the projector while the glasses run the app.
 */

import { API_BASE_URL } from './api'
import { drawMirror } from './hud/mirrorCanvas'
import type { MirrorFrame } from './hud/renderer'

const canvas = document.getElementById('lens') as HTMLCanvasElement
const caption = document.getElementById('caption')!
const status = document.getElementById('status')!
drawMirror(canvas, null)

function connect(): void {
  const es = new EventSource(`${API_BASE_URL}/api/mirror/stream`)
  es.onopen = () => {
    status.textContent = 'live'
    status.className = 'live'
  }
  es.onmessage = (e) => {
    const m = JSON.parse(e.data) as MirrorFrame
    drawMirror(canvas, m)
    caption.textContent = m.caption || ''
  }
  es.onerror = () => {
    status.textContent = 'reconnecting...'
    status.className = ''
  }
}

connect()
