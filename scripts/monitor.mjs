#!/usr/bin/env node
/**
 * scripts/monitor.mjs — live view of phone/glasses connection milestones.
 * Reads the diagnostics every app instance posts to diag.log (every 5s) and prints each milestone once.
 *   node scripts/monitor.mjs [laptop-ip]          watch the local backend (reads diag.log)
 *   node scripts/monitor.mjs https://<deployed>   watch a hosted backend (polls /api/diag/recent)
 */

import fs from 'node:fs'

const ARG = process.argv[2] || 'your-laptop-ip'
const REMOTE = /^https?:\/\//.test(ARG) ? ARG.replace(/\/$/, '') : null
const IP = REMOTE ? new URL(REMOTE).host : ARG
const FILE = 'diag.log'
const G = '\x1b[32m', Y = '\x1b[33m', R = '\x1b[31m', D = '\x1b[2m', B = '\x1b[1m', N = '\x1b[0m'
const time = () => new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
const say = (icon, color, msg) => console.log(`  ${D}${time()}${N} ${icon} ${color}${msg}${N}`)

if (!fs.existsSync(FILE)) fs.writeFileSync(FILE, '')
let offset = fs.statSync(FILE).size
let carry = ''
const started = Date.now()
const instances = new Map() // bootAt -> { seen:Set, lastAt, isPhone, quiet }
let phoneSeen = false
let lastHint = 0

function once(inst, key, fn) {
  if (inst.seen.has(key)) return
  inst.seen.add(key)
  fn()
}

function handle(r) {
  const id = r.bootAt
  if (!id) return
  const isPhone = !/Macintosh|Windows NT|X11/.test(r.userAgent || '') || r.bridgeAttached
  let inst = instances.get(id)
  if (!inst) {
    inst = { seen: new Set(), lastAt: Date.now(), isPhone, quiet: false }
    instances.set(id, inst)
    if (isPhone) {
      phoneSeen = true
      const device = /iPhone/.test(r.userAgent) ? 'iPhone' : /Android/.test(r.userAgent) ? 'Android' : 'phone'
      say('📱', G, `${B}${device} opened Compassion Coach${N}${G} — the phone can reach the laptop`)
    } else {
      say('💻', D, 'a laptop browser tab opened the app (fine for testing, ignored below)')
    }
  }
  if (inst.quiet) say('🔄', G, 'phone is back (app running again)')
  inst.lastAt = Date.now()
  inst.quiet = false
  if (!inst.isPhone) return

  const a = r.audio || {}
  const roles = a.byRole || {}
  const kinds = new Set((r.events || []).map((e) => e.kind))

  if (!r.bridgeAttached) {
    once(inst, 'nobridge', () =>
      say('⚠️ ', Y, 'Opened OUTSIDE the Even App (no glasses link). Scan the QR from Even App → Even Hub → Scan QR, not the camera.'),
    )
    return
  }
  once(inst, 'bridge', () => say('👓', G, 'Even App bridge connected'))

  if (r.startupPageResult === 0) once(inst, 'page', () => say('🖼 ', G, 'lens page created on the glasses'))
  else if (r.startupPageResult != null)
    once(inst, 'pagefail', () =>
      say('⚠️ ', Y, `lens page returned ${r.startupPageResult} (another Compassion Coach copy may own the lens — force-quit the Even App)`),
    )

  if (r.audioSource === 'glasses') once(inst, 'mic', () => say('🎙 ', G, `glasses mic streaming${r.sampleRateEstimate ? ` (${r.sampleRateEstimate} Hz)` : ''}`))
  else if (r.audioSource === 'phone-bridge') once(inst, 'micphone', () => say('⚠️ ', Y, 'glasses mic silent — using the PHONE mic through the Even App instead'))
  else if (r.audioSource === 'phone-web') once(inst, 'micweb', () => say('⚠️ ', Y, 'glasses mic silent — using the phone browser mic'))
  else if (r.audioSource === 'none' && kinds.has('boot_done')) once(inst, 'micnone', () => say('✗ ', R, 'no microphone available — check mic permission for the Even App'))

  if ((roles.self || 0) > 0) once(inst, 'self', () => say('🗣 ', G, 'glasses tag YOUR voice (speakerRole=self)'))
  if ((roles.other || 0) > 0) once(inst, 'other', () => say('🛡 ', G, 'glasses tag OTHER speakers — they will be ignored'))
  if (a.frames > 50 && !roles.self && !roles.other)
    once(inst, 'noroles', () => say('·', D, 'audio arrives without speaker tags — every voice nearby will count'))

  if (r.backend?.online && !r.backend.stt && !r.speechRecognitionAvailable)
    once(inst, 'nostt', () =>
      say('✗ ', R, 'no speech-to-text: Compassion Coach hears you but can\'t understand words. Add GROQ_API_KEY to .env, then npm run start:demo'),
    )
  if (r.backend?.stt) once(inst, 'stt', () => say('📝', G, 'speech-to-text ready (glasses audio → words → Claude)'))
  if (r.utterances > 0) once(inst, 'utt', () => say('💬', G, 'heard you speak'))
  if (r.imuFrames > 0) once(inst, 'imu', () => say('🧭', G, 'head-tilt sensor reporting ("Look up" reset enabled)'))
  if (r.lastImageResult === 'success') once(inst, 'img', () => say('🐣', G, `pet image drawn on the lens (${r.imageMode})`))
  else if (r.lastImageResult) once(inst, 'imgfail', () => say('⚠️ ', Y, `pet image failed: ${r.lastImageResult}`))
  if ((a.framesInBackground || 0) > 0) once(inst, 'bg', () => say('🌙', G, 'audio keeps flowing while Compassion Coach is in the background'))

  for (const e of r.events || []) {
    if (e.kind === 'voice_check_done')
      once(inst, `vc@${e.t}`, () => say('🎚 ', G, `voice check done — your threshold ${e.detail?.threshold?.toFixed?.(2) ?? e.detail?.threshold} (samples ${JSON.stringify(e.detail?.samples)})`))
  }
  const milestones = { badge: '🏅 badge unlocked', personal_best: '⏱  new personal best', self_recovery: '🧣 calmed down on their own', repair_offer: '🩹 "that came out sharp" (repair offered)', repair_done: '🩹 repair made → Mochi grew', room_cue: '👀 "they sound stressed" cue', room_answered: '💛 you checked on them', kindness: '✨ kindness noticed', forecast: '🔮 forecast shown', forecast_hour: '🔮 hourly heads-up', convo_start: '🗣  conversation detected (nudges held)', convo_end: '🤫 conversation ended', debrief: '⛈  debrief offered after the conversation', judge_demo_start: '🎬 judge demo started', hatched: '🥚 hatched!', voice_check_start: '🎚  voice check started', nudge: '⛈  nudge shown', reset_complete: '🌸 reset verified → bloom', recovered: '☀️  recovery counted', crisis_screen: '💚 support screen shown' }
  for (const e of r.events || []) {
    if (milestones[e.kind]) once(inst, `${e.kind}@${e.t}`, () => say('', G, milestones[e.kind]))
    if (e.kind === 'lifecycle') once(inst, `life@${e.t}`, () => say('·', D, `glasses: ${e.detail}`))
  }
}

let remoteSeq = -1
let remoteBusy = false
let lastWarn = 0
async function pollRemote() {
  if (remoteBusy) return
  remoteBusy = true
  try {
    const r = await fetch(`${REMOTE}/api/diag/recent?after=${Math.max(0, remoteSeq)}`)
    const j = await r.json()
    // First poll only sets the cursor, so old history isn't replayed
    if (remoteSeq >= 0) for (const line of j.lines) {
      try {
        handle(JSON.parse(line))
      } catch {
        // ignore
      }
    }
    remoteSeq = j.seq
  } catch (e) {
    if (Date.now() - lastWarn > 15_000) {
      lastWarn = Date.now()
      say('⚠️ ', Y, `can't reach ${REMOTE} (${e.cause?.code ?? e.message}) — still waking up?`)
    }
  } finally {
    remoteBusy = false
  }
}

function poll() {
  if (REMOTE) {
    void pollRemote()
    return checkQuiet()
  }
  const size = fs.statSync(FILE).size
  if (size < offset) offset = 0
  if (size > offset) {
    const fd = fs.openSync(FILE, 'r')
    const buf = Buffer.alloc(size - offset)
    fs.readSync(fd, buf, 0, buf.length, offset)
    fs.closeSync(fd)
    offset = size
    const lines = (carry + buf.toString('utf8')).split('\n')
    carry = lines.pop() ?? ''
    for (const line of lines) {
      try {
        handle(JSON.parse(line))
      } catch {
        // partial / non-JSON line
      }
    }
  }

  checkQuiet()
}

function checkQuiet() {
  const now = Date.now()
  for (const inst of instances.values()) {
    if (inst.isPhone && !inst.quiet && now - inst.lastAt > 20_000) {
      inst.quiet = true
      say('💤', Y, 'phone stopped checking in (locked, backgrounded, or app closed)')
    }
  }
  if (!REMOTE && !phoneSeen && now - started > 45_000 && now - lastHint > 60_000) {
    lastHint = now
    say('⏳', Y, `no phone yet. On the phone, open Safari → ${B}http://${IP}:5173${N}${Y}`)
    console.log(`           ${D}loads → network OK, rescan the QR inside the Even App (Even Hub → Scan QR)`)
    console.log(`           doesn't load → Wi-Fi blocks devices: turn on the phone's hotspot, join it from the laptop, re-run npm run start:demo${N}`)
  }
}

console.log(`  ${D}waiting for the phone… (milestones appear here as they happen)${N}`)
setInterval(poll, 1000)
