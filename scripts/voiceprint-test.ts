// Offline check: can the voiceprint tell voices apart? Generate clips with macOS `say` (see README), then:
//   npx tsx scripts/voiceprint-test.ts <dir-with-Name_1..5.wav>
import fs from 'node:fs'
import { voiceFeatures, buildVoiceprint, matchScore } from '../src/audio/voiceprint'

const dir = process.argv[2]

function load(p: string): Float32Array {
  const b = fs.readFileSync(p)
  let off = 12
  while (off < b.length) {
    const id = b.toString('ascii', off, off + 4)
    const sz = b.readUInt32LE(off + 4)
    if (id === 'data') {
      off += 8
      const n = sz / 2
      const out = new Float32Array(n)
      for (let i = 0; i < n; i++) out[i] = b.readInt16LE(off + i * 2) / 32768
      return out
    }
    off += 8 + sz
  }
  throw new Error('no data chunk')
}

function voicedFrames(x: Float32Array): Float32Array[] {
  const out: Float32Array[] = []
  for (let i = 0; i + 320 <= x.length; i += 320) {
    const f = x.slice(i, i + 320)
    let s = 0
    for (const v of f) s += v * v
    if (Math.sqrt(s / 320) > 0.01) out.push(f)
  }
  return out
}

function pitches(f: Float32Array[]): number[] {
  const ps: number[] = []
  for (let i = 0; i + 1 < f.length; i += 3) {
    const w = new Float32Array(640)
    w.set(f[i])
    w.set(f[i + 1], 320)
    let e = 0
    for (const v of w) e += v * v
    let best = 0
    let lag = 0
    for (let L = 40; L <= 228; L++) {
      let c = 0
      for (let k = 0; k + L < 640; k++) c += w[k] * w[k + L]
      if (c / e > best) {
        best = c / e
        lag = L
      }
    }
    if (best > 0.45) ps.push(16000 / lag)
  }
  return ps
}

const feat = (v: string, i: number) => {
  const f = voicedFrames(load(`${dir}/${v}_${i}.wav`))
  return voiceFeatures(f, pitches(f))!
}

const voices = ['Daniel', 'Samantha', 'Fred', 'Karen', 'Rishi', 'Ralph']
let correct = 0
let total = 0
for (const owner of voices) {
  const vp = buildVoiceprint([1, 2, 3].map((i) => feat(owner, i)))!
  const cells = voices.map((v) => {
    const scores = [4, 5].map((i) => matchScore(vp, feat(v, i)))
    const ok = v === owner ? scores.every((s) => s >= vp.threshold) : scores.every((s) => s < vp.threshold)
    correct += ok ? 1 : 0
    total++
    return `${v.slice(0, 7).padEnd(8)}${scores.map((s) => (s * 100).toFixed(0).padStart(3)).join('/')}${ok ? ' ok' : ' XX'}`
  })
  console.log(`${owner.padEnd(9)}thr ${(vp.threshold * 100).toFixed(0)} | ${cells.join(' | ')}`)
}
console.log(`\n${correct}/${total} owner-vs-other decisions correct`)
