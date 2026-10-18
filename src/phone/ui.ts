/**
 * src/phone/ui.ts — Phone companion: onboarding, live lens mirror, today's inner weather,
 * bounce-back trend, what calms you, evolution, settings, test panel and diagnostics.
 */

import type { Aura, AuraSnapshot } from '../engine/aura'
import type { Store } from '../engine/store'
import type { AudioInput } from '../audio/input'
import type { HudRenderer, MirrorFrame } from '../hud/renderer'
import { drawMirror } from '../hud/mirrorCanvas'
import { RESETS, successRate } from '../engine/resets'
import { nextStage, stageLabel } from '../engine/store'
import { STAGES } from '../config'
import { diag } from '../diagnostics'
import type { ResetId } from '../types'

export interface PhoneDeps {
  aura: Aura
  store: Store
  audio: AudioInput
  hud: HudRenderer
  glassesConnected: () => boolean
  /** false after the glasses report AuraPet left the lens (e.g. exit dialog, another app opened) */
  lensActive: () => boolean
  backend: () => { online: boolean; stt: string | null; llm: string | null }
}

const STYLE = `
:root{color-scheme:dark;--bg:#0b0f13;--card:#141a20;--line:#232c35;--text:#eef2f5;--text2:#aab4bd;--muted:#7d8790;
--storm:#d95926;--fog:#3987e5;--good:#199e70;--grid:#26303a;--accent:#40ff80}
*{box-sizing:border-box;margin:0;padding:0}
body{background:var(--bg);color:var(--text);font:15px/1.45 -apple-system,BlinkMacSystemFont,"Inter",system-ui,sans-serif;padding:14px 14px 80px;max-width:560px;margin:0 auto}
h1{font-size:20px;font-weight:650}
h2{font-size:13px;font-weight:600;text-transform:uppercase;letter-spacing:.06em;color:var(--text2);margin-bottom:10px}
.card{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:14px;margin-bottom:12px}
.row{display:flex;align-items:center;gap:10px}
.between{justify-content:space-between}
.chips{display:flex;gap:6px;flex-wrap:wrap;margin-top:6px}
.chip{font-size:11.5px;padding:3px 8px;border-radius:99px;border:1px solid var(--line);color:var(--text2)}
.chip.on{color:var(--text);border-color:#3b4a57}
.chip .dot{display:inline-block;width:7px;height:7px;border-radius:50%;margin-right:5px;background:var(--muted)}
.chip.on .dot{background:var(--accent)}
.lens{width:100%;aspect-ratio:2/1;background:#000;border-radius:10px;border:1px solid #1d2a22;image-rendering:pixelated;display:block}
.caption{font-size:12.5px;color:var(--text2);margin-top:8px;min-height:18px}
.big{font-size:28px;font-weight:700;text-transform:capitalize}
.sub{color:var(--text2);font-size:13px}
.meter{height:6px;background:var(--grid);border-radius:99px;overflow:hidden;margin-top:4px}
.meter>i{display:block;height:100%;border-radius:99px}
.btn{background:#22303c;color:var(--text);border:1px solid #33424f;border-radius:10px;padding:10px 14px;font:inherit;font-weight:600}
.btn.primary{background:var(--accent);color:#04140a;border-color:var(--accent)}
.btn:disabled{opacity:.5}
input[type=text]{width:100%;background:#0e1318;border:1px solid var(--line);color:var(--text);border-radius:10px;padding:10px 12px;font:inherit}
.stats{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:10px}
.stat{background:#10161b;border-radius:10px;padding:10px}
.stat b{display:block;font-size:22px}
.stat span{font-size:11.5px;color:var(--muted)}
.legend{display:flex;gap:14px;font-size:12px;color:var(--text2);margin-bottom:6px}
.sw{display:inline-block;width:10px;height:10px;border-radius:3px;margin-right:5px;vertical-align:-1px}
.tip{position:absolute;pointer-events:none;background:#0b0f13;border:1px solid var(--line);border-radius:8px;padding:6px 8px;font-size:12px;color:var(--text);white-space:nowrap;display:none}
.reset-row{margin-bottom:10px}
.reset-row .row{font-size:14px}
.stages{display:flex;gap:6px}
.stage{flex:1;text-align:center;padding:8px 4px;border-radius:10px;background:#10161b;font-size:12px;color:var(--muted)}
.stage.done{color:var(--text);border:1px solid #2e5c44}
.stage.cur{border:1px solid var(--accent);color:var(--text)}
details summary{cursor:pointer;color:var(--text2);font-size:13px}
pre{font:11px/1.4 ui-monospace,Menlo,monospace;color:#9fb;white-space:pre-wrap;margin-top:8px}
table{width:100%;border-collapse:collapse;font-size:12px;margin-top:6px}
td,th{padding:3px 4px;border-bottom:1px solid var(--line);text-align:left;color:var(--text2)}
.banner{background:#2a1a12;border:1px solid var(--storm);border-radius:12px;padding:12px;margin-bottom:12px}
.overlay{position:fixed;inset:0;background:rgba(5,8,10,.96);z-index:50;display:flex;align-items:center;justify-content:center;padding:24px}
.overlay .panel{max-width:420px;width:100%}
.overlay p{color:var(--text2);margin:10px 0 18px}
.steps{display:flex;gap:6px;margin-bottom:18px}
.steps i{flex:1;height:3px;border-radius:9px;background:var(--grid)}
.steps i.on{background:var(--accent)}
.toggle{display:flex;align-items:center;justify-content:space-between;padding:8px 0}
`

export function mountPhoneUi(d: PhoneDeps): void {
  const root = document.getElementById('app')!
  const style = document.createElement('style')
  style.textContent = STYLE
  document.head.appendChild(style)

  root.innerHTML = `
    <div id="crisis"></div>
    <div id="setupBanner"></div>
    <div class="card">
      <div class="row between">
        <div><h1 id="title">AuraPet</h1><div class="sub" id="subtitle"></div></div>
        <button class="btn" id="tapBtn" style="display:none">Open reset</button>
      </div>
      <div class="chips" id="chips"></div>
    </div>

    <div class="card">
      <h2>On your lens</h2>
      <canvas class="lens" id="lens"></canvas>
      <div class="caption" id="caption"></div>
    </div>

    <div class="card">
      <h2>Right now</h2>
      <div class="row between"><div class="big" id="weather">clear</div><div class="sub" id="phase"></div></div>
      <div style="margin-top:10px">
        <div class="row between sub"><span>Storm (stress)</span><span id="stressV"></span></div>
        <div class="meter"><i id="stressBar" style="background:var(--storm)"></i></div>
        <div class="row between sub" style="margin-top:8px"><span>Fog (low)</span><span id="lowV"></span></div>
        <div class="meter"><i id="lowBar" style="background:var(--fog)"></i></div>
      </div>
      <div class="caption" id="heard"></div>
    </div>

    <div class="card">
      <h2>Today's inner weather</h2>
      <div class="legend"><span><i class="sw" style="background:var(--storm)"></i>Storm (stress)</span><span><i class="sw" style="background:var(--fog)"></i>Fog (low)</span><span>&#9670; recovered</span></div>
      <div style="position:relative" id="tlWrap"><svg id="timeline" viewBox="0 0 340 150" width="100%"></svg><div class="tip" id="tlTip"></div></div>
      <details style="margin-top:8px"><summary>Show as table</summary><div id="tlTable"></div></details>
    </div>

    <div class="card">
      <h2>Bounce-back time</h2>
      <div class="stats" id="bbStats"></div>
      <svg id="bounce" viewBox="0 0 340 110" width="100%"></svg>
    </div>

    <div class="card">
      <h2>What calms you</h2>
      <div id="calms"></div>
    </div>

    <div class="card">
      <h2>Evolution</h2>
      <div class="stages" id="stages"></div>
      <div class="caption" id="nextStage"></div>
    </div>

    <div class="card">
      <h2>Demo shortcuts</h2>
      <div class="sub" style="margin-bottom:10px">Sets the recovery count so your <b>next real recovery</b> (nudge → reset → calm down) triggers the evolution. Turn on Demo mode too.</div>
      <div class="row" style="gap:8px;flex-wrap:wrap">
        <button class="btn" data-rec="2">Next → Wisp</button>
        <button class="btn" data-rec="7">Next → Guardian</button>
        <button class="btn" data-rec="14">Next → Zenith</button>
        <button class="btn" id="previewEvo">Replay evolution</button>
      </div>
    </div>

    <div class="card">
      <h2>Settings</h2>
      <div class="toggle"><div><div>Demo mode</div><div class="sub">Shorter timers so the full loop fits in a pitch</div></div><input type="checkbox" id="demo"></div>
      <div class="toggle"><div><div>Blank lens while working</div><div class="sub">Off: a tiny dim pet stays in the corner. On: the lens is empty until your mood shifts, a nudge fires, or you tap.</div></div><input type="checkbox" id="quiet"></div>
      <div class="toggle"><div>Pet name</div><input type="text" id="petName" style="width:140px"></div>
      <div style="margin-top:12px"><div class="sub" style="margin-bottom:6px">Try it by typing (goes through the same pipeline as speech)</div>
        <div class="row"><input type="text" id="typed" placeholder="e.g. this deadline is impossible, nothing works"><button class="btn" id="send">Send</button></div>
      </div>
      <div class="toggle" style="margin-top:6px"><div><div>Voice check</div><div class="sub" id="voiceSub">Teaches AuraPet how the glasses hear <i>your</i> voice, so only you count. Also: long-press the temple.</div></div><button class="btn" id="voiceBtn">Start</button></div>
      <div class="row" style="margin-top:12px;gap:8px">
        <button class="btn" id="micBtn">Start microphone</button>
        <button class="btn" id="resetData">Reset all data</button>
      </div>
      <details style="margin-top:12px"><summary>Diagnostics</summary><pre id="diag"></pre></details>
    </div>
    <div id="onboarding"></div>
  `

  const $ = (id: string) => document.getElementById(id)!
  const lens = $('lens') as HTMLCanvasElement
  let lastMirror: MirrorFrame | null = null
  d.hud.onMirror((m) => {
    lastMirror = m
    drawMirror(lens, m)
    $('caption').textContent = m.caption || ''
  })
  drawMirror(lens, null)

  // Settings
  const demo = $('demo') as HTMLInputElement
  demo.checked = d.store.data.demoMode
  demo.onchange = () => d.aura.setDemoMode(demo.checked)
  const quiet = $('quiet') as HTMLInputElement
  quiet.checked = d.store.data.blankLens
  quiet.onchange = () => d.aura.setQuietLens(quiet.checked)
  const petName = $('petName') as HTMLInputElement
  petName.value = d.store.data.pet.name
  petName.onchange = () => d.aura.setPetName(petName.value)
  const typed = $('typed') as HTMLInputElement
  const send = () => {
    void d.aura.submitText(typed.value)
    typed.value = ''
  }
  $('send').onclick = send
  typed.onkeydown = (e) => {
    if (e.key === 'Enter') send()
  }
  $('micBtn').onclick = async () => {
    await d.audio.startFromGesture()
    update(d.aura.snapshot())
  }
  $('resetData').onclick = async () => {
    if (!confirm('Erase your pet, mood history and recoveries on this device?')) return
    await d.store.reset()
    location.reload()
  }
  $('tapBtn').onclick = () => d.aura.phoneTap()
  $('voiceBtn').onclick = () => d.aura.startVoiceCheck()
  document.querySelectorAll<HTMLButtonElement>('[data-rec]').forEach((b) => {
    b.onclick = () => {
      d.aura.setRecoveries(Number(b.dataset.rec))
      if (!d.store.data.demoMode) {
        d.aura.setDemoMode(true)
        ;($('demo') as HTMLInputElement).checked = true
      }
    }
  })
  $('previewEvo').onclick = () => d.aura.previewEvolution()

  setupTimelineHover()
  renderOnboarding(d)

  let chartSig = ''
  const update = (s: AuraSnapshot) => {
    const data = d.store.data
    const pet = data.pet
    $('title').textContent = pet.name
    $('subtitle').textContent = `${stageLabel(s.stage)} · ${pet.recoveries} recoveries`
    const be = d.backend()
    $('chips').innerHTML = [
      chip(d.glassesConnected(), d.glassesConnected() ? 'G2 connected' : 'Browser preview'),
      chip(d.audio.source !== 'none', micLabel(d.audio.source)),
      chip(be.online, be.online ? (be.llm ? `AI: ${be.llm.split(':')[0]}` : 'AI: keyword mode') : 'Backend offline'),
      chip(d.aura.speechReady, be.stt ? `Speech: ${be.stt.split(':')[0]}` : d.aura.speechReady ? 'Speech: phone' : 'Speech: not set up'),
      chip(data.demoMode, data.demoMode ? 'Demo mode' : 'Everyday mode'),
    ].join('')
    $('micBtn').style.display = d.audio.source === 'none' ? '' : 'none'

    const tapBtn = $('tapBtn')
    tapBtn.style.display = s.phase === 'nudged' || (s.phase === 'idle' && s.pending) ? '' : 'none'

    $('weather').textContent = s.mood.weather
    $('phase').textContent = phaseLabel(s)
    $('stressV').textContent = pct(s.mood.stress)
    $('lowV').textContent = pct(s.mood.low)
    ;($('stressBar') as HTMLElement).style.width = pct(s.mood.stress)
    ;($('lowBar') as HTMLElement).style.width = pct(s.mood.low)
    $('heard').textContent = s.lastTranscript
      ? `Last heard (shown here only, never saved): "${s.lastTranscript}" → ${s.lastLabel}${s.lastEmotion ? `, ${s.lastEmotion}` : ''}`
      : 'Listening for your voice only.'

    $('setupBanner').innerHTML =
      d.glassesConnected() && !d.lensActive()
        ? `<div class="banner"><b>AuraPet isn't on your lens right now.</b><div class="sub" style="margin-top:4px">It's still listening here. To bring it back, open <b>AuraPet</b> from the glasses menu (or tap the temple). Tip: double-tap on the main screen opens the exit dialog.</div></div>`
        : be.online && !d.aura.speechReady
        ? `<div class="banner"><b>AuraPet can hear you but can't understand words yet.</b><div class="sub" style="margin-top:4px">This phone has no built-in speech recognition. Add <code>GROQ_API_KEY</code> (free at console.groq.com) to <code>.env</code> on the laptop, then run <code>npm run start:demo</code>.</div></div>`
        : ''
    const ratios = data.baseline.selfRatio
    $('voiceSub').innerHTML = ratios.length
      ? `Tuned: the glasses tag your speech as you ${Math.round([...ratios].sort((a, b) => a - b)[Math.floor(ratios.length / 2)] * 100)}% of the time. Redo it in a new room.`
      : 'Teaches AuraPet how the glasses hear <i>your</i> voice, so only you count. Also: long-press the temple.'
    $('crisis').innerHTML =
      s.phase === 'crisis'
        ? `<div class="banner"><b>You matter.</b><div class="sub" style="margin-top:4px">That sounded really heavy. AuraPet has paused its game. Please reach out to someone you trust, a friend, family member, or someone nearby, and let them know how you're feeling.</div></div>`
        : ''

    // Charts only redraw when data changes (or every 30s to advance "now"), so hover isn't interrupted
    const sig = `${data.timeline.length}|${data.recoveries.length}|${s.stage}|${Math.floor(Date.now() / 30000)}`
    if (sig !== chartSig) {
      chartSig = sig
      renderTimeline(d)
      renderBounce(d)
      renderCalms(d)
    }
    renderStages(d, s)
    $('diag').textContent = diagText(d)
    if (lastMirror) $('caption').textContent = lastMirror.caption || ''
  }

  d.aura.onChange(update)
  d.audio.onSourceChange(() => update(d.aura.snapshot()))
  update(d.aura.snapshot())
}

// ── Onboarding ────────────────────────────────────────────────

function renderOnboarding(d: PhoneDeps): void {
  const host = document.getElementById('onboarding')!
  if (d.store.data.onboarded || d.store.data.pet.hatched) {
    host.innerHTML = ''
    return
  }
  let step = 0
  const steps = [
    () => `
      <h1>Meet AuraPet</h1>
      <p>A tiny companion on your G2 lenses. It notices when a conversation is winding you up, helps you come back down, and grows every time you do.</p>
      <button class="btn primary" data-next>Get started</button>`,
    () => `
      <h1>Only your voice. Nothing saved.</h1>
      <p>AuraPet listens to <b>your</b> voice only. Other people are ignored. Audio and words are processed in the moment and never stored; only mood scores stay on this phone.</p>
      <button class="btn primary" data-mic>Allow listening</button>`,
    () => `
      <h1>Name your companion</h1>
      <p>You'll say this name out loud to hatch it.</p>
      <input type="text" id="obName" value="${escapeHtml(d.store.data.pet.name)}" maxlength="12">
      <div style="height:14px"></div>
      <button class="btn primary" data-name>Continue</button>`,
    () => `
      <h1>Hatch your egg</h1>
      <p>Look at your lenses and say <b>"Hi ${escapeHtml(d.store.data.pet.name)}"</b> out loud.</p>
      <p class="sub">Your voice is the controller: AuraPet's resets are done by speaking, not tapping.</p>
      <div class="row" style="gap:8px"><button class="btn" data-skip>Type it instead</button></div>`,
  ]
  const draw = () => {
    host.innerHTML = `<div class="overlay"><div class="panel"><div class="steps">${steps
      .map((_, i) => `<i class="${i <= step ? 'on' : ''}"></i>`)
      .join('')}</div>${steps[step]()}</div></div>`
    host.querySelector('[data-next]')?.addEventListener('click', () => {
      step++
      draw()
    })
    host.querySelector('[data-mic]')?.addEventListener('click', async () => {
      await d.audio.startFromGesture()
      step++
      draw()
    })
    host.querySelector('[data-name]')?.addEventListener('click', () => {
      d.aura.setPetName((document.getElementById('obName') as HTMLInputElement).value)
      step++
      draw()
    })
    host.querySelector('[data-skip]')?.addEventListener('click', () => {
      void d.aura.submitText(`Hi ${d.store.data.pet.name}`)
    })
  }
  draw()
  // Close once the egg hatches
  const poll = setInterval(() => {
    if (d.store.data.pet.hatched) {
      clearInterval(poll)
      host.innerHTML = ''
    }
  }, 500)
}

// ── Charts ────────────────────────────────────────────────────

const TL = { W: 340, H: 150, L: 30, R: 46, T: 8, B: 22 }

function todayPoints(d: PhoneDeps) {
  const start = new Date()
  start.setHours(0, 0, 0, 0)
  return d.store.data.timeline.filter((p) => p.t >= start.getTime())
}

let tlState: { x0: number; x1: number; pts: ReturnType<typeof todayPoints> } = { x0: 0, x1: 1, pts: [] }

function renderTimeline(d: PhoneDeps): void {
  const svg = document.getElementById('timeline')!
  const pts = todayPoints(d)
  const now = Date.now()
  const x0 = Math.min(pts[0]?.t ?? now, now - 30 * 60_000)
  const x1 = now
  tlState = { x0, x1, pts }
  const sx = (t: number) => TL.L + ((t - x0) / (x1 - x0)) * (TL.W - TL.L - TL.R)
  const sy = (v: number) => TL.T + (1 - v) * (TL.H - TL.T - TL.B)

  const path = (key: 'stress' | 'low') =>
    pts.length ? 'M' + pts.map((p) => `${sx(p.t).toFixed(1)},${sy(p[key]).toFixed(1)}`).join('L') : ''
  const grid = [0, 0.4, 1]
    .map(
      (v) =>
        `<line x1="${TL.L}" x2="${TL.W - TL.R}" y1="${sy(v)}" y2="${sy(v)}" stroke="var(--grid)" stroke-width="1" ${v === 0.4 ? 'stroke-dasharray="3 3"' : ''}/>` +
        `<text x="${TL.L - 4}" y="${sy(v) + 3}" fill="var(--muted)" font-size="9" text-anchor="end">${v === 0.4 ? 'calm' : v === 0 ? '0' : 'max'}</text>`,
    )
    .join('')
  const recov = d.store.data.recoveries
    .filter((r) => r.recoveredAt >= x0)
    .map((r) => {
      const x = sx(r.recoveredAt)
      const y = TL.H - TL.B + 2
      return `<path d="M${x},${y - 5}L${x + 5},${y}L${x},${y + 5}L${x - 5},${y}Z" fill="var(--text)" stroke="var(--card)" stroke-width="2"><title>Recovered ${fmtTime(r.recoveredAt)} (${Math.round(r.bounceBackMs / 60000)} min)</title></path>`
    })
    .join('')
  const last = pts[pts.length - 1]
  const endLabels = last
    ? labelPair(sx(last.t), sy(last.stress), sy(last.low))
    : `<text x="${TL.W / 2}" y="${TL.H / 2}" fill="var(--muted)" font-size="11" text-anchor="middle">Talk normally - your day will appear here</text>`
  const xLabels = [x0, x1]
    .map((t, i) => `<text x="${sx(t)}" y="${TL.H - 4}" fill="var(--muted)" font-size="9" text-anchor="${i ? 'end' : 'start'}">${i ? 'now' : fmtTime(t)}</text>`)
    .join('')

  svg.innerHTML = `${grid}${xLabels}
    <path d="${path('low')}" fill="none" stroke="var(--fog)" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>
    <path d="${path('stress')}" fill="none" stroke="var(--storm)" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>
    ${endLabels}${recov}
    <line id="tlCross" y1="${TL.T}" y2="${TL.H - TL.B}" stroke="var(--muted)" stroke-width="1" style="display:none"/>
    <rect id="tlHit" x="${TL.L}" y="0" width="${TL.W - TL.L - TL.R}" height="${TL.H}" fill="transparent"/>`

  document.getElementById('tlTable')!.innerHTML = pts.length
    ? `<table><tr><th>Time</th><th>Storm</th><th>Fog</th><th>Heard as</th></tr>${pts
        .slice(-30)
        .reverse()
        .map((p) => `<tr><td>${fmtTime(p.t)}</td><td>${pct(p.stress)}</td><td>${pct(p.low)}</td><td>${p.label}</td></tr>`)
        .join('')}</table>`
    : '<div class="sub" style="margin-top:6px">No data yet today.</div>'
}

function labelPair(x: number, yStorm: number, yFog: number): string {
  // Keep the two direct labels from colliding
  let a = yStorm
  let b = yFog
  if (Math.abs(a - b) < 11) {
    const mid = (a + b) / 2
    const stormAbove = yStorm <= yFog
    a = stormAbove ? mid - 6 : mid + 6
    b = stormAbove ? mid + 6 : mid - 6
  }
  return (
    `<text x="${x + 5}" y="${a + 3}" fill="var(--text2)" font-size="10">Storm</text>` +
    `<text x="${x + 5}" y="${b + 3}" fill="var(--text2)" font-size="10">Fog</text>`
  )
}

function setupTimelineHover(): void {
  const wrap = document.getElementById('tlWrap')!
  const tip = document.getElementById('tlTip')!
  const move = (clientX: number) => {
    const svg = document.getElementById('timeline') as unknown as SVGSVGElement
    const rect = svg.getBoundingClientRect()
    const vx = ((clientX - rect.left) / rect.width) * TL.W
    const { x0, x1, pts } = tlState
    if (!pts.length || vx < TL.L || vx > TL.W - TL.R) return hide()
    const t = x0 + ((vx - TL.L) / (TL.W - TL.L - TL.R)) * (x1 - x0)
    const p = pts.reduce((a, b) => (Math.abs(b.t - t) < Math.abs(a.t - t) ? b : a))
    const px = TL.L + ((p.t - x0) / (x1 - x0)) * (TL.W - TL.L - TL.R)
    const cross = document.getElementById('tlCross')
    if (cross) {
      cross.setAttribute('x1', String(px))
      cross.setAttribute('x2', String(px))
      cross.style.display = ''
    }
    tip.style.display = 'block'
    tip.innerHTML = `${fmtTime(p.t)}<br><span class="sw" style="background:var(--storm)"></span>Storm ${pct(p.stress)}<br><span class="sw" style="background:var(--fog)"></span>Fog ${pct(p.low)}`
    const left = (px / TL.W) * rect.width
    tip.style.left = `${Math.min(rect.width - 120, Math.max(0, left + 8))}px`
    tip.style.top = '4px'
  }
  const hide = () => {
    tip.style.display = 'none'
    const cross = document.getElementById('tlCross')
    if (cross) cross.style.display = 'none'
  }
  wrap.addEventListener('mousemove', (e) => move(e.clientX))
  wrap.addEventListener('touchmove', (e) => move(e.touches[0].clientX), { passive: true })
  wrap.addEventListener('touchstart', (e) => move(e.touches[0].clientX), { passive: true })
  wrap.addEventListener('mouseleave', hide)
  wrap.addEventListener('touchend', () => setTimeout(hide, 1500))
}

function renderBounce(d: PhoneDeps): void {
  const recs = d.store.data.recoveries
  const mins = recs.map((r) => r.bounceBackMs / 60000)
  const avg = mins.length ? mins.reduce((a, b) => a + b, 0) / mins.length : 0
  const first = mins[0]
  const latest = mins[mins.length - 1]
  document.getElementById('bbStats')!.innerHTML = [
    stat(mins.length ? fmtMin(first) : '–', 'first recovery'),
    stat(mins.length ? fmtMin(latest) : '–', 'latest'),
    stat(mins.length ? fmtMin(avg) : '–', 'average'),
  ].join('')

  const svg = document.getElementById('bounce')!
  const shown = recs.slice(-12)
  if (!shown.length) {
    svg.innerHTML = `<text x="170" y="55" fill="var(--muted)" font-size="11" text-anchor="middle">Your recoveries will show up here</text>`
    return
  }
  const W = 340
  const H = 110
  const B = 18
  const max = Math.max(1, ...shown.map((r) => r.bounceBackMs / 60000))
  const slot = (W - 10) / shown.length
  const bw = Math.min(26, slot - 2)
  svg.innerHTML =
    `<line x1="0" x2="${W}" y1="${H - B}" y2="${H - B}" stroke="var(--grid)"/>` +
    shown
      .map((r, i) => {
        const m = r.bounceBackMs / 60000
        const h = Math.max(4, (m / max) * (H - B - 16))
        const x = 5 + i * slot + (slot - bw) / 2
        const y = H - B - h
        const label = i === 0 || i === shown.length - 1 ? `<text x="${x + bw / 2}" y="${y - 4}" fill="var(--text2)" font-size="10" text-anchor="middle">${fmtMin(m)}</text>` : ''
        return `<path d="M${x},${H - B}V${y + 4}Q${x},${y} ${x + 4},${y}H${x + bw - 4}Q${x + bw},${y} ${x + bw},${y + 4}V${H - B}Z" fill="var(--good)"><title>${fmtTime(r.recoveredAt)} · ${RESETS[r.resetId].title} · ${fmtMin(m)}</title></path>${label}`
      })
      .join('') +
    `<text x="5" y="${H - 4}" fill="var(--muted)" font-size="9">oldest</text><text x="${W - 5}" y="${H - 4}" fill="var(--muted)" font-size="9" text-anchor="end">latest</text>`
}

function renderCalms(d: PhoneDeps): void {
  const stats = d.store.data.resetStats
  const ids = (Object.keys(RESETS) as ResetId[]).sort((a, b) => successRate(stats[b]) - successRate(stats[a]))
  const anyTried = ids.some((id) => stats[id].offered > 0)
  document.getElementById('calms')!.innerHTML =
    (anyTried ? '' : '<div class="sub" style="margin-bottom:10px">AuraPet learns which resets actually bring you back, and offers those first.</div>') +
    ids
      .map((id) => {
        const s = stats[id]
        const rate = s.offered ? s.recovered / s.offered : 0
        return `<div class="reset-row"><div class="row between"><span>${RESETS[id].title}</span><span class="sub">${
          s.offered ? `${s.recovered}/${s.offered} led to recovery` : 'not tried yet'
        }</span></div><div class="meter"><i style="width:${Math.round(rate * 100)}%;background:var(--good)"></i></div></div>`
      })
      .join('')
}

function renderStages(d: PhoneDeps, s: AuraSnapshot): void {
  const n = d.store.data.pet.recoveries
  document.getElementById('stages')!.innerHTML = STAGES.map(
    (st) => `<div class="stage ${s.stage === st.id ? 'cur' : n >= st.at ? 'done' : ''}"><b>${st.label}</b><br>${st.at}</div>`,
  ).join('')
  const next = nextStage(n)
  document.getElementById('nextStage')!.textContent = next
    ? `${next.at - n} more recover${next.at - n === 1 ? 'y' : 'ies'} to ${next.label}. Recoveries count when your mood actually clears after a reset.`
    : 'Zenith reached. Your companion is fully grown.'
}

// ── helpers ───────────────────────────────────────────────────

function diagText(d: PhoneDeps): string {
  const a = diag.audio
  const ago = a.lastFrameAt ? `${((Date.now() - a.lastFrameAt) / 1000).toFixed(1)}s ago` : 'never'
  const be = d.backend()
  return [
    `bridge:${diag.bridgeAttached} fg:${diag.inForeground} vis:${diag.visibility} startupPage:${diag.startupPageResult}`,
    `mic:${diag.audioSource} pcmRate:${diag.sampleRateEstimate || '?'} frames:${a.frames} last:${ago} bg:${a.framesInBackground}`,
    `roles:${JSON.stringify(a.byRole)} sources:${JSON.stringify(a.bySource)}`,
    `utterances:${diag.utterances} ignoredOthers:${diag.ignoredOtherSpeech} imu:${diag.imuFrames} selfThreshold:${diag.selfThreshold}`,
    `recent self ratios: ${diag.recentSelfRatios.join(' ')}`,
    `image:${diag.imageMode} last:${diag.lastImageResult || '-'}  speechAPI:${diag.speechRecognitionAvailable}`,
    `backend:${be.online} stt:${be.stt} llm:${be.llm}`,
    ...diag.events.slice(-8).map((e) => `${new Date(e.t).toLocaleTimeString()} ${e.kind} ${e.detail !== undefined ? JSON.stringify(e.detail) : ''}`),
  ].join('\n')
}

function chip(on: boolean, label: string): string {
  return `<span class="chip ${on ? 'on' : ''}"><i class="dot"></i>${label}</span>`
}

function micLabel(s: string): string {
  return s === 'glasses' ? 'Glasses mic' : s === 'phone-bridge' ? 'Phone mic (via Even)' : s === 'phone-web' ? 'Phone mic' : 'Mic off'
}

function phaseLabel(s: AuraSnapshot): string {
  switch (s.phase) {
    case 'nudged':
      return 'Nudge on lens'
    case 'active':
      return s.active ? `Reset: ${s.active.title}` : 'Reset'
    case 'bloom':
      return 'Bloomed'
    case 'cleared':
      return 'Recovered'
    case 'evolving':
      return 'Evolving'
    case 'hatching':
      return 'Waiting to hatch'
    case 'crisis':
      return 'Support shown'
    case 'voicecheck':
      return 'Voice check'
    default:
      return s.watching ? 'Watching for recovery' : s.pending ? 'Reset waiting' : ''
  }
}

function stat(v: string, label: string): string {
  return `<div class="stat"><b>${v}</b><span>${label}</span></div>`
}

function pct(n: number): string {
  return `${Math.round(n * 100)}%`
}

function fmtMin(m: number): string {
  return m < 1 ? `${Math.max(1, Math.round(m * 60))}s` : `${m.toFixed(m < 10 ? 1 : 0)}m`
}

function fmtTime(t: number): string {
  return new Date(t).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)
}
