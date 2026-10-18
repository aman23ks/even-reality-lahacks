/**
 * src/companion/ui.ts — Mobile Companion Dashboard & G2 HUD Simulator
 * 
 * Renders an interface on the phone WebView / laptop browser:
 * - Real-time G2 576x288 HUD mirror
 * - Live Voice Activity & Emotion Prosody visualizer
 * - VoidPet status, level-up & happiness bars
 * - Wellness micro-step quests (earn points & improve mood)
 * - Elemental Breeding Lab
 * - Voice Fingerprint enrollment
 */

import type { AuraPetApp } from '../app'
import { getPetAscii, getEmotionEmoji } from '../game/petAscii'

export function renderCompanionDashboard(app: AuraPetApp): void {
  const root = document.getElementById('app')
  if (!root) return

  // Inject styles
  const styleEl = document.createElement('style')
  styleEl.textContent = `
    @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=JetBrains+Mono:wght@400;600&display=swap');

    :root {
      --bg-dark: #0a0e14;
      --card-bg: rgba(18, 26, 36, 0.75);
      --card-border: rgba(0, 255, 170, 0.18);
      --neon-green: #00ffaa;
      --neon-cyan: #00e5ff;
      --neon-amber: #ffb703;
      --neon-pink: #ff3366;
      --text-main: #f0f6fc;
      --text-dim: #8b949e;
    }

    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background-color: var(--bg-dark);
      color: var(--text-main);
      font-family: 'Space Grotesk', -apple-system, sans-serif;
      min-height: 100vh;
      padding: 16px;
      background-image: 
        radial-gradient(ellipse at 20% 10%, rgba(0, 255, 170, 0.08) 0%, transparent 40%),
        radial-gradient(ellipse at 80% 80%, rgba(0, 229, 255, 0.08) 0%, transparent 50%);
    }

    .dashboard-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 12px 16px;
      margin-bottom: 16px;
      background: var(--card-bg);
      border: 1px solid var(--card-border);
      border-radius: 14px;
      backdrop-filter: blur(12px);
    }

    .title-group h1 {
      font-size: 1.4rem;
      font-weight: 700;
      background: linear-gradient(135deg, #00ffaa 0%, #00e5ff 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      letter-spacing: -0.5px;
    }

    .status-badge {
      font-size: 0.75rem;
      padding: 4px 10px;
      border-radius: 20px;
      background: rgba(0, 255, 170, 0.12);
      color: var(--neon-green);
      border: 1px solid rgba(0, 255, 170, 0.3);
      font-weight: 600;
      display: flex;
      align-items: center;
      gap: 6px;
    }

    .pulse-dot {
      width: 7px;
      height: 7px;
      background-color: var(--neon-green);
      border-radius: 50%;
      box-shadow: 0 0 8px var(--neon-green);
      animation: pulse 1.8s infinite;
    }

    @keyframes pulse {
      0% { opacity: 0.4; transform: scale(0.9); }
      50% { opacity: 1; transform: scale(1.15); }
      100% { opacity: 0.4; transform: scale(0.9); }
    }

    .grid-container {
      display: grid;
      grid-template-columns: 1fr;
      gap: 16px;
      max-width: 900px;
      margin: 0 auto;
    }

    @media (min-width: 768px) {
      .grid-container {
        grid-template-columns: 1fr 1fr;
      }
      .span-2 {
        grid-column: span 2;
      }
    }

    .card {
      background: var(--card-bg);
      border: 1px solid var(--card-border);
      border-radius: 14px;
      padding: 16px;
      backdrop-filter: blur(12px);
      box-shadow: 0 8px 24px rgba(0,0,0,0.3);
    }

    .card-title {
      font-size: 0.9rem;
      text-transform: uppercase;
      letter-spacing: 0.8px;
      color: var(--text-dim);
      margin-bottom: 12px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    /* G2 HUD Simulator */
    .g2-hud-screen {
      background: #020905;
      border: 2px solid #00ff66;
      border-radius: 8px;
      padding: 14px;
      color: #00ff66;
      font-family: 'JetBrains Mono', monospace;
      font-size: 0.78rem;
      line-height: 1.35;
      min-height: 180px;
      white-space: pre;
      overflow-x: auto;
      box-shadow: 0 0 16px rgba(0, 255, 102, 0.2) inset, 0 4px 16px rgba(0, 255, 102, 0.15);
      position: relative;
    }

    .g2-hud-screen::after {
      content: 'G2 HUD MIRROR (576×288)';
      position: absolute;
      top: 6px;
      right: 8px;
      font-size: 0.55rem;
      opacity: 0.5;
      letter-spacing: 1px;
    }

    /* Controls bar for simulation */
    .sim-controls {
      display: flex;
      gap: 8px;
      margin-top: 10px;
    }

    .btn {
      padding: 8px 14px;
      background: rgba(255, 255, 255, 0.06);
      border: 1px solid rgba(255, 255, 255, 0.12);
      border-radius: 8px;
      color: var(--text-main);
      font-size: 0.8rem;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s ease;
      display: flex;
      align-items: center;
      gap: 6px;
      justify-content: center;
    }

    .btn:hover {
      background: rgba(0, 255, 170, 0.15);
      border-color: var(--neon-green);
      transform: translateY(-1px);
    }

    .btn-primary {
      background: linear-gradient(135deg, rgba(0, 255, 170, 0.25), rgba(0, 229, 255, 0.25));
      border-color: var(--neon-green);
      color: var(--neon-green);
    }

    /* Pet Card */
    .pet-stats-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 12px;
    }

    .progress-bar-bg {
      background: rgba(255, 255, 255, 0.08);
      height: 8px;
      border-radius: 4px;
      overflow: hidden;
      margin-top: 4px;
    }

    .progress-bar-fill {
      height: 100%;
      background: linear-gradient(90deg, var(--neon-green), var(--neon-cyan));
      border-radius: 4px;
      transition: width 0.3s ease;
    }

    /* Voice & Emotion Card */
    .emotion-badge-large {
      display: inline-block;
      padding: 6px 14px;
      border-radius: 8px;
      background: rgba(0, 229, 255, 0.12);
      border: 1px solid var(--neon-cyan);
      color: var(--neon-cyan);
      font-weight: 700;
      font-size: 1rem;
      margin-bottom: 10px;
    }

    .voice-metric {
      display: flex;
      justify-content: space-between;
      padding: 6px 0;
      border-bottom: 1px solid rgba(255, 255, 255, 0.06);
      font-size: 0.85rem;
    }

    /* Quests Checklist */
    .quest-item {
      background: rgba(255, 255, 255, 0.03);
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 10px;
      padding: 12px;
      margin-bottom: 10px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      transition: all 0.2s;
    }

    .quest-item.completed {
      opacity: 0.45;
      text-decoration: line-through;
    }

    .quest-info h4 {
      font-size: 0.95rem;
      margin-bottom: 3px;
    }

    .quest-info p {
      font-size: 0.8rem;
      color: var(--text-dim);
    }

    .quest-reward {
      font-size: 0.8rem;
      color: var(--neon-amber);
      font-weight: 600;
    }

    /* Breeding Sanctuary */
    .essence-vault {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 8px;
      margin-bottom: 12px;
    }

    .essence-pill {
      background: rgba(255, 255, 255, 0.04);
      padding: 6px 8px;
      border-radius: 8px;
      text-align: center;
      font-size: 0.8rem;
    }
  `
  document.head.appendChild(styleEl)

  // Render Skeleton
  root.innerHTML = `
    <header class="dashboard-header">
      <div class="title-group">
        <h1>✨ AuraPet G2</h1>
        <div style="font-size: 0.8rem; color: var(--text-dim);">VoidPet Companion for Even Reality Smart Glasses</div>
      </div>
      <div class="status-badge" id="hudStatus">
        <span class="pulse-dot"></span>
        <span id="listeningText">Mic Active</span>
      </div>
    </header>

    <div class="grid-container">
      <!-- 1. G2 HUD MIRROR -->
      <section class="card span-2">
        <div class="card-title">
          <span>G2 Glasses Display (Live Mirror)</span>
          <span style="font-size: 0.75rem; color: var(--neon-green);" id="activeScreenTag">PET COMPANION HUD</span>
        </div>
        <pre class="g2-hud-screen" id="hudMirror">Loading G2 HUD Display...</pre>
        <div class="sim-controls" style="flex-wrap: wrap;">
          <button class="btn btn-primary" id="btnConnectGlasses" style="background: linear-gradient(135deg, #00ffaa, #00e5ff); color: #0a0e14; font-weight: 700;">👓 Send HUD to Glasses Lens</button>
          <button class="btn btn-primary" id="btnSimTap">👆 Tap Temple</button>
          <button class="btn" id="btnSimSwipeFwd">👉 Swipe Quests</button>
          <button class="btn" id="btnSimSwipeBack">👈 Swipe HUD</button>
          <button class="btn" id="btnCalibrate">🎙️ Calibrate Voice</button>
        </div>
      </section>

      <!-- 2. VOICE FINGERPRINT & EMOTION DETECTION -->
      <section class="card">
        <div class="card-title">
          <span>Voice Fingerprint & Emotion</span>
          <span style="font-size: 0.75rem; color: var(--neon-cyan);" id="voiceMatchBadge">Fingerprint: Ready</span>
        </div>
        <div>
          <div class="emotion-badge-large" id="currentEmotionBadge">☀️ JOY (88%)</div>
          <p style="font-size: 0.85rem; color: #a0aec0; margin-bottom: 12px;" id="coachTipText">
            "Speak naturally to bond with your pet..."
          </p>

          <div class="voice-metric">
            <span style="color: var(--text-dim);">Live Pitch (F0):</span>
            <strong id="metricPitch">165 Hz</strong>
          </div>
          <div class="voice-metric">
            <span style="color: var(--text-dim);">Vocal Energy (RMS):</span>
            <strong id="metricEnergy">0.082</strong>
          </div>
          <div class="voice-metric">
            <span style="color: var(--text-dim);">Voice Isolation:</span>
            <strong style="color: var(--neon-green);" id="metricIsolation">Wearer Verified (92%)</strong>
          </div>
          <div class="voice-metric">
            <span style="color: var(--text-dim);">Glasses Audio Input:</span>
            <strong style="color: var(--neon-cyan);">Continuous Listening</strong>
          </div>
        </div>
      </section>

      <!-- 3. VOIDPET STATUS & EVOLUTION -->
      <section class="card">
        <div class="card-title">
          <span>Active Companion</span>
          <span style="color: var(--neon-amber);" id="petLevelTag">Lvl 2 WISP</span>
        </div>
        <div>
          <div class="pet-stats-row">
            <div>
              <h3 style="font-size: 1.2rem; color: var(--neon-green);" id="petName">Solispark</h3>
              <div style="font-size: 0.8rem; color: var(--text-dim);" id="petSpecies">Joy Elemental Wisp</div>
            </div>
            <button class="btn btn-primary" id="btnPetCompanion" style="padding: 6px 12px;">❤️ Pet Me</button>
          </div>

          <div style="margin-bottom: 10px;">
            <div style="display: flex; justify-content: space-between; font-size: 0.8rem;">
              <span>Happiness:</span>
              <strong id="petHpText">85%</strong>
            </div>
            <div class="progress-bar-bg">
              <div class="progress-bar-fill" id="petHpBar" style="width: 85%;"></div>
            </div>
          </div>

          <div style="margin-bottom: 10px;">
            <div style="display: flex; justify-content: space-between; font-size: 0.8rem;">
              <span>XP to Next Evolution:</span>
              <strong id="petXpText">45 / 100 XP</strong>
            </div>
            <div class="progress-bar-bg">
              <div class="progress-bar-fill" id="petXpBar" style="width: 45%; background: linear-gradient(90deg, #ffb703, #ff3366);"></div>
            </div>
          </div>
        </div>
      </section>

      <!-- 4. WELLNESS QUESTS / MICRO-STEPS (POINTS & WELLNESS) -->
      <section class="card">
        <div class="card-title">
          <span>Wellness Micro-Steps (Get Points!)</span>
          <span style="color: var(--neon-green);">+XP & Essence</span>
        </div>
        <div id="questList">
          <!-- Dynamic Quests will be rendered here -->
        </div>
      </section>

      <!-- 5. BREEDING SANCTUARY & ESSENCE LAB -->
      <section class="card">
        <div class="card-title">
          <span>Breeding Lab & Essence Vault</span>
          <span style="color: var(--neon-cyan);">Fusion Sanctuary</span>
        </div>
        <div class="essence-vault">
          <div class="essence-pill">☀️ Joy: <strong id="essJoy">40</strong></div>
          <div class="essence-pill">💧 Calm: <strong id="essCalm">50</strong></div>
          <div class="essence-pill">✨ Focus: <strong id="essCurious">25</strong></div>
        </div>
        <div style="background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.08); border-radius: 8px; padding: 10px; margin-bottom: 10px;">
          <div style="font-weight: 600; font-size: 0.85rem; margin-bottom: 4px;">🧬 Hybrid Breeding: Serenidrake</div>
          <div style="font-size: 0.75rem; color: var(--text-dim); margin-bottom: 8px;">
            Combine Solispark (Joy) + Lumidrop (Calm) to hatch the Celestial Dragon of Serenity.
          </div>
          <button class="btn btn-primary" id="btnBreed" style="width: 100%;">🥚 Incubate & Hatch Hybrid</button>
        </div>
      </section>
    </div>
  `

  const state = app.getStateManager()
  const petManager = app.getPetManager()
  const voiceAnalyzer = app.getVoiceAnalyzer()

  // Update HUD Mirror text
  const updateMirror = () => {
    const s = state.get()
    const pet = s.activePet
    const screen = s.currentScreen
    const mirrorEl = document.getElementById('hudMirror')
    const screenTag = document.getElementById('activeScreenTag')
    if (!mirrorEl || !screenTag) return

    screenTag.textContent = `${screen.toUpperCase()} SCREEN`

    if (screen === 'pet') {
      const ascii = getPetAscii(pet.speciesId, pet.stage)
      const reading = s.lastReading
      mirrorEl.textContent = [
        `┌── [ ${pet.name} ] ───────────────────── [ ${pet.stage.toUpperCase()} LVL ${pet.level} ] ──┐`,
        `│  Mood: ${getEmotionEmoji(pet.dominantMood).padEnd(20)}  XP: ${pet.xp}/${pet.xpToNextLevel} (${Math.round((pet.xp/pet.xpToNextLevel)*100)}%)    │`,
        `│                                                       │`,
        ...ascii.split('\n').map((line) => `│  ${line.padEnd(25)}  Pitch: ${reading ? reading.pitchHz + ' Hz' : '165 Hz'}               │`),
        `│                                                       │`,
        `│  "${s.coachMessage.slice(0, 50).padEnd(51)}" │`,
        `└─────────────────────────────────── [TAP] Pet | [SWIPE] Quest ┘`,
      ].join('\n')
    } else if (screen === 'quest') {
      const quests = s.activeQuests
      const active = quests.find((q) => !q.completed) || quests[0]
      mirrorEl.textContent = [
        `┌── [ WELLNESS QUEST ] ───────────────────────── [ +${active ? active.rewardXp : 0} XP ] ──┐`,
        `│                                                       │`,
        `│  Target: ${active ? active.title.padEnd(43) : 'All Completed!'.padEnd(43)} │`,
        `│  Action: ${active ? active.microStep.padEnd(43) : ''.padEnd(43)} │`,
        `│  Reward: +${active ? active.rewardEssence : 0} ${active ? active.targetEmotion.toUpperCase() : ''} Essence                             │`,
        `│                                                       │`,
        `└────────────────────────────────── [TAP] Complete | [SWIPE] Pet ┘`,
      ].join('\n')
    } else if (screen === 'breeding') {
      const pair = petManager.getBreedingPair()
      const ess = petManager.getEssencePoints()
      mirrorEl.textContent = [
        `┌── [ BREEDING LAB ] ───────────────────────────── [ SANCTUARY ] ──┐`,
        `│                                                       │`,
        `│  Essence: Joy: ${ess.joy} | Calm: ${ess.calm} | Focus: ${ess.curiosity}                │`,
        `│  ${pair ? `Incubating: ${pair.eggSpecies.toUpperCase()} (${pair.currentEssence}/${pair.hatchCostEssence} Essence)` : 'Select two pets to fuse into a legendary hybrid'}  │`,
        `│                                                       │`,
        `└────────────────────────────────────── [TAP] Hatch | [SWIPE] Pet ┘`,
      ].join('\n')
    }
  }

  // Render Quests list
  const renderQuests = () => {
    const listEl = document.getElementById('questList')
    if (!listEl) return
    const quests = petManager.getActiveQuests()

    listEl.innerHTML = quests
      .map(
        (q) => `
        <div class="quest-item ${q.completed ? 'completed' : ''}" data-id="${q.id}">
          <div class="quest-info">
            <h4>${q.title}</h4>
            <p>${q.microStep}</p>
          </div>
          <div>
            <div class="quest-reward">+${q.rewardXp} XP</div>
            ${
              !q.completed
                ? `<button class="btn btn-primary btn-complete-quest" data-id="${q.id}" style="padding: 4px 8px; font-size: 0.75rem; margin-top: 4px;">Done</button>`
                : '<span style="font-size: 0.75rem; color: #666;">Done ✓</span>'
            }
          </div>
        </div>
      `
      )
      .join('')

    listEl.querySelectorAll('.btn-complete-quest').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const id = (e.target as HTMLElement).getAttribute('data-id')
        if (id) {
          petManager.completeQuest(id)
          updateUI()
        }
      })
    })
  }

  // Full UI sync
  const updateUI = () => {
    const s = state.get()
    const pet = s.activePet

    // Pet stats
    const petNameEl = document.getElementById('petName')
    const petSpeciesEl = document.getElementById('petSpecies')
    const petLevelTag = document.getElementById('petLevelTag')
    const petHpText = document.getElementById('petHpText')
    const petHpBar = document.getElementById('petHpBar')
    const petXpText = document.getElementById('petXpText')
    const petXpBar = document.getElementById('petXpBar')

    if (petNameEl) petNameEl.textContent = pet.name
    if (petSpeciesEl) petSpeciesEl.textContent = `${pet.speciesName} (${pet.element.toUpperCase()})`
    if (petLevelTag) petLevelTag.textContent = `Lvl ${pet.level} ${pet.stage.toUpperCase()}`
    if (petHpText) petHpText.textContent = `${pet.happiness}%`
    if (petHpBar) petHpBar.style.width = `${pet.happiness}%`
    if (petXpText) petXpText.textContent = `${pet.xp} / ${pet.xpToNextLevel} XP`
    if (petXpBar) petXpBar.style.width = `${Math.min(100, Math.round((pet.xp / pet.xpToNextLevel) * 100))}%`

    // Emotion & Prosody
    const reading = s.lastReading
    const emotionBadge = document.getElementById('currentEmotionBadge')
    const coachTip = document.getElementById('coachTipText')
    const metricPitch = document.getElementById('metricPitch')
    const metricEnergy = document.getElementById('metricEnergy')
    const metricIsolation = document.getElementById('metricIsolation')
    const voiceMatchBadge = document.getElementById('voiceMatchBadge')

    if (reading) {
      if (emotionBadge) emotionBadge.textContent = `${getEmotionEmoji(reading.primary)} (${Math.round(reading.confidence * 100)}%)`
      if (metricPitch) metricPitch.textContent = `${reading.pitchHz} Hz`
      if (metricEnergy) metricEnergy.textContent = `${reading.energyRms}`
      if (metricIsolation) {
        metricIsolation.textContent = reading.isUserVoice
          ? `Wearer Verified (${Math.round(reading.userVoiceConfidence * 100)}%)`
          : 'Ambient Voice Ignored'
        metricIsolation.style.color = reading.isUserVoice ? 'var(--neon-green)' : 'var(--text-dim)'
      }
    }

    if (coachTip) coachTip.textContent = `"${s.coachMessage}"`

    const fp = voiceAnalyzer.getFingerprint()
    if (voiceMatchBadge) {
      voiceMatchBadge.textContent = fp.isEnrolled
        ? `Fingerprint: Enrolled (${fp.medianPitchHz} Hz)`
        : 'Fingerprint: Calibrating...'
    }

    // Essence
    const ess = petManager.getEssencePoints()
    const essJoy = document.getElementById('essJoy')
    const essCalm = document.getElementById('essCalm')
    const essCurious = document.getElementById('essCurious')
    if (essJoy) essJoy.textContent = String(ess.joy)
    if (essCalm) essCalm.textContent = String(ess.calm)
    if (essCurious) essCurious.textContent = String(ess.curiosity)

    renderQuests()
    updateMirror()
  }

  // Wire simulator & glasses push buttons
  document.getElementById('btnConnectGlasses')?.addEventListener('click', async () => {
    const btn = document.getElementById('btnConnectGlasses') as HTMLButtonElement | null
    if (btn) btn.textContent = '⏳ Connecting...'
    await app.reconnectGlasses()
    if (btn) btn.textContent = '✓ Sent to Glasses!'
    setTimeout(() => {
      if (btn) btn.textContent = '👓 Send HUD to Glasses Lens'
    }, 2500)
    updateUI()
  })

  document.getElementById('btnSimTap')?.addEventListener('click', async () => {
    const cur = state.get().currentScreen
    if (cur === 'pet') {
      const active = petManager.getActivePet()
      active.happiness = Math.min(100, active.happiness + 5)
      state.update({ activePet: active, coachMessage: `Petted ${active.name}! ❤️` })
    } else if (cur === 'quest') {
      const quests = petManager.getActiveQuests()
      const pending = quests.find((q) => !q.completed)
      if (pending) petManager.completeQuest(pending.id)
    } else if (cur === 'breeding') {
      petManager.hatchEgg()
    }
    await app.renderHudScreen()
    updateUI()
  })

  document.getElementById('btnSimSwipeFwd')?.addEventListener('click', async () => {
    const screens = ['pet', 'quest', 'breeding'] as const
    const cur = state.get().currentScreen
    const next = screens[(screens.indexOf(cur as any) + 1) % screens.length]
    state.update({ currentScreen: next })
    await app.renderHudScreen()
    updateUI()
  })

  document.getElementById('btnSimSwipeBack')?.addEventListener('click', async () => {
    const screens = ['pet', 'quest', 'breeding'] as const
    const cur = state.get().currentScreen
    const prev = screens[(screens.indexOf(cur as any) - 1 + screens.length) % screens.length]
    state.update({ currentScreen: prev })
    await app.renderHudScreen()
    updateUI()
  })

  document.getElementById('btnCalibrate')?.addEventListener('click', async () => {
    await app.startCalibration()
    updateUI()
  })

  document.getElementById('btnPetCompanion')?.addEventListener('click', () => {
    const active = petManager.getActivePet()
    active.happiness = Math.min(100, active.happiness + 10)
    state.update({ activePet: active, coachMessage: `You showed love to ${active.name}! 💕` })
    updateUI()
  })

  document.getElementById('btnBreed')?.addEventListener('click', () => {
    const all = petManager.getAllPets()
    if (all.length >= 2) {
      petManager.startBreeding(all[0].id, all[1].id)
      petManager.hatchEgg()
      state.update({ coachMessage: 'Hatched a new Serenidrake dragon! 🐲✨' })
      updateUI()
    }
  })

  // Listen to state changes
  state.onChange(() => updateUI())

  // Initial draw
  updateUI()
}
