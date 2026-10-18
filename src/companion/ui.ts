/**
 * src/companion/ui.ts — Mobile Companion Dashboard, G2 HUD Simulator & The Zenith End Goal
 * 
 * Features:
 * - Real-time G2 576x288 HUD mirror
 * - Visible Pet Growth from Tiny Hatchling -> Giant Ascended Guardian
 * - Emotion Points for BOTH negative and positive emotions
 * - Micro-remedies to guide users into a positive mood
 * - Defined End Goal: Awakening the Zenith Harmony Guardian
 * - Biometric Wearer Voice Isolation & Fingerprinting
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
      --bg-dark: #070a0e;
      --card-bg: rgba(14, 21, 30, 0.85);
      --card-border: rgba(0, 255, 170, 0.22);
      --neon-green: #00ffaa;
      --neon-cyan: #00e5ff;
      --neon-amber: #ffb703;
      --neon-pink: #ff3366;
      --neon-purple: #b5179e;
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
        radial-gradient(ellipse at 15% 15%, rgba(0, 255, 170, 0.09) 0%, transparent 45%),
        radial-gradient(ellipse at 85% 85%, rgba(0, 229, 255, 0.09) 0%, transparent 55%);
    }

    .dashboard-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 14px 18px;
      margin-bottom: 16px;
      background: var(--card-bg);
      border: 1px solid var(--card-border);
      border-radius: 14px;
      backdrop-filter: blur(12px);
    }

    .title-group h1 {
      font-size: 1.5rem;
      font-weight: 700;
      background: linear-gradient(135deg, #00ffaa 0%, #00e5ff 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      letter-spacing: -0.5px;
    }

    .status-badge {
      font-size: 0.75rem;
      padding: 5px 12px;
      border-radius: 20px;
      background: rgba(0, 255, 170, 0.12);
      color: var(--neon-green);
      border: 1px solid rgba(0, 255, 170, 0.35);
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
      max-width: 950px;
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
      padding: 18px;
      backdrop-filter: blur(14px);
      box-shadow: 0 8px 28px rgba(0,0,0,0.4);
    }

    .card-title {
      font-size: 0.85rem;
      text-transform: uppercase;
      letter-spacing: 0.8px;
      color: var(--text-dim);
      margin-bottom: 12px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    /* End Goal Hero Card */
    .end-goal-card {
      background: linear-gradient(135deg, rgba(181, 23, 158, 0.15) 0%, rgba(0, 229, 255, 0.12) 100%), var(--card-bg);
      border: 1px solid rgba(181, 23, 158, 0.35);
      position: relative;
      overflow: hidden;
    }

    .end-goal-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 10px;
    }

    .rank-badge {
      background: linear-gradient(135deg, #b5179e, #00e5ff);
      color: #fff;
      font-size: 0.72rem;
      font-weight: 700;
      padding: 4px 10px;
      border-radius: 12px;
      text-transform: uppercase;
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

    .sim-controls {
      display: flex;
      gap: 8px;
      margin-top: 10px;
      flex-wrap: wrap;
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

    /* Pet Growth Visualizer */
    .pet-growth-box {
      display: flex;
      align-items: center;
      gap: 16px;
      margin-bottom: 14px;
      background: rgba(0, 0, 0, 0.35);
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 12px;
      padding: 12px;
    }

    .pet-ascii-avatar {
      font-family: 'JetBrains Mono', monospace;
      color: var(--neon-green);
      white-space: pre;
      line-height: 1.25;
      transition: transform 0.4s ease;
      background: rgba(0, 255, 170, 0.05);
      border: 1px dashed rgba(0, 255, 170, 0.25);
      padding: 8px 14px;
      border-radius: 8px;
      font-size: 0.85rem;
    }

    .growth-stage-indicator {
      display: flex;
      gap: 6px;
      margin-top: 8px;
    }

    .growth-dot {
      flex: 1;
      height: 6px;
      border-radius: 3px;
      background: rgba(255, 255, 255, 0.1);
      transition: background 0.3s;
    }

    .growth-dot.active {
      background: var(--neon-green);
      box-shadow: 0 0 6px var(--neon-green);
    }

    /* Emotion Points Grid (All Emotions Give Points!) */
    .emotion-points-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 8px;
      margin-bottom: 14px;
    }

    .emotion-point-chip {
      background: rgba(255, 255, 255, 0.04);
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 8px;
      padding: 8px;
      text-align: center;
      transition: all 0.2s;
    }

    .emotion-point-chip.active {
      border-color: var(--neon-cyan);
      background: rgba(0, 229, 255, 0.08);
    }

    .emotion-point-chip .label {
      font-size: 0.72rem;
      color: var(--text-dim);
      display: block;
      margin-bottom: 2px;
    }

    .emotion-point-chip .pts {
      font-size: 1rem;
      font-weight: 700;
      color: var(--text-main);
    }

    /* Progress bar */
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

    .voice-metric {
      display: flex;
      justify-content: space-between;
      padding: 6px 0;
      border-bottom: 1px solid rgba(255, 255, 255, 0.06);
      font-size: 0.82rem;
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
    }

    .quest-item.completed {
      opacity: 0.45;
      text-decoration: line-through;
    }
  `
  document.head.appendChild(styleEl)

  // Render HTML Frame
  root.innerHTML = `
    <header class="dashboard-header">
      <div class="title-group">
        <h1>✨ AuraPet G2</h1>
        <div style="font-size: 0.8rem; color: var(--text-dim);">Emotional Voice Companion for Even Reality Smart Glasses</div>
      </div>
      <div class="status-badge" id="hudStatus">
        <span class="pulse-dot"></span>
        <span id="listeningText">Mic Active</span>
      </div>
    </header>

    <div class="grid-container">
      <!-- 0. THE END GOAL HERO BANNER -->
      <section class="card span-2 end-goal-card">
        <div class="end-goal-header">
          <div>
            <h2 style="font-size: 1.15rem; font-weight: 700; color: #fff; margin-bottom: 4px;" id="goalTitle">
              🏆 End Goal: Awaken the Zenith Harmony Guardian
            </h2>
            <p style="font-size: 0.8rem; color: #cbd5e1; max-width: 650px;" id="goalDesc">
              Resilience is NOT feeling happy 24/7. It is listening to ALL 5 emotions (Joy, Calm, Anxiety, Sadness, Anger) and transforming them into inner power.
            </p>
          </div>
          <span class="rank-badge" id="ascensionRankTag">Novice Seeker (Sprout)</span>
        </div>
        <div style="margin-top: 10px;">
          <div style="display: flex; justify-content: space-between; font-size: 0.78rem; margin-bottom: 4px;">
            <span style="color: var(--neon-cyan);">Emotional Equilibrium Score (Balance all 5 feelings):</span>
            <strong id="equilibriumPercentText" style="color: var(--neon-green);">35%</strong>
          </div>
          <div class="progress-bar-bg" style="height: 10px;">
            <div class="progress-bar-fill" id="equilibriumBar" style="width: 35%; background: linear-gradient(90deg, #00ffaa, #00e5ff, #b5179e);"></div>
          </div>
        </div>
      </section>

      <!-- 1. G2 HUD MIRROR -->
      <section class="card span-2">
        <div class="card-title">
          <span>G2 Glasses Display (Live Mirror)</span>
          <span style="font-size: 0.75rem; color: var(--neon-green);" id="activeScreenTag">PET COMPANION HUD</span>
        </div>
        <pre class="g2-hud-screen" id="hudMirror">Loading G2 HUD Display...</pre>
        <div class="sim-controls">
          <button class="btn btn-primary" id="btnConnectGlasses" style="background: linear-gradient(135deg, #00ffaa, #00e5ff); color: #0a0e14; font-weight: 700;">👓 Send HUD to Glasses Lens</button>
          <button class="btn btn-primary" id="btnSimTap">👆 Tap Temple (Pet/Action)</button>
          <button class="btn" id="btnSimSwipeFwd">👉 Swipe (Quests/Goal)</button>
          <button class="btn" id="btnSimSwipeBack">👈 Swipe Back</button>
          <button class="btn" id="btnCalibrate">🎙️ Calibrate My Voice</button>
        </div>
      </section>

      <!-- 2. VOIDPET STATUS & VISIBLE GROWTH -->
      <section class="card">
        <div class="card-title">
          <span>Visible Pet Growth</span>
          <span style="color: var(--neon-amber);" id="petLevelTag">Lvl 1 HATCHLING</span>
        </div>
        <div>
          <!-- Growth visualizer showing ASCII pet scaling -->
          <div class="pet-growth-box">
            <pre class="pet-ascii-avatar" id="petAvatarPreview">
  (..)  
 /"*"\\ 
  ~v~   
            </pre>
            <div style="flex: 1;">
              <h3 style="font-size: 1.15rem; color: var(--neon-green);" id="petName">Solispark</h3>
              <div style="font-size: 0.78rem; color: var(--text-dim);" id="petSpecies">Joy Hatchling (Tiny)</div>
              <div style="font-size: 0.75rem; color: var(--neon-cyan); margin-top: 4px;" id="growthMilestoneText">
                Stage 1 of 4 • Grows to Wisp at Level 3
              </div>
              <div class="growth-stage-indicator">
                <div class="growth-dot active" title="Stage 1: Hatchling (Tiny)"></div>
                <div class="growth-dot" title="Stage 2: Wisp (Medium)"></div>
                <div class="growth-dot" title="Stage 3: Juvenile (Large)"></div>
                <div class="growth-dot" title="Stage 4: Ascended (Giant)"></div>
              </div>
            </div>
            <button class="btn btn-primary" id="btnPetCompanion" style="padding: 6px 10px; font-size: 0.75rem;">❤️ Pet</button>
          </div>

          <div style="margin-bottom: 8px;">
            <div style="display: flex; justify-content: space-between; font-size: 0.78rem;">
              <span>Happiness:</span>
              <strong id="petHpText">80%</strong>
            </div>
            <div class="progress-bar-bg">
              <div class="progress-bar-fill" id="petHpBar" style="width: 80%;"></div>
            </div>
          </div>

          <div style="margin-bottom: 8px;">
            <div style="display: flex; justify-content: space-between; font-size: 0.78rem;">
              <span>XP to Next Growth:</span>
              <strong id="petXpText">25 / 60 XP</strong>
            </div>
            <div class="progress-bar-bg">
              <div class="progress-bar-fill" id="petXpBar" style="width: 42%; background: linear-gradient(90deg, #ffb703, #ff3366);"></div>
            </div>
          </div>
        </div>
      </section>

      <!-- 3. EMOTION POINTS VAULT (All Feelings Earn Points!) -->
      <section class="card">
        <div class="card-title">
          <span>Emotional Awareness Points</span>
          <span style="color: var(--neon-cyan);" id="totalVoicePointsBadge">145 Total Pts</span>
        </div>
        <p style="font-size: 0.75rem; color: var(--text-dim); margin-bottom: 10px;">
          Every emotion earns points! Negative emotions acknowledge awareness; positive remedies foster growth.
        </p>
        <div class="emotion-points-grid">
          <div class="emotion-point-chip" id="chipJoy">
            <span class="label">☀️ Joy</span>
            <span class="pts" id="ptsJoy">35</span>
          </div>
          <div class="emotion-point-chip" id="chipCalm">
            <span class="label">💧 Calm</span>
            <span class="pts" id="ptsCalm">40</span>
          </div>
          <div class="emotion-point-chip" id="chipAnxiety">
            <span class="label">🌪️ Anxiety</span>
            <span class="pts" id="ptsAnxiety">20</span>
          </div>
          <div class="emotion-point-chip" id="chipSadness">
            <span class="label">🌙 Gloom</span>
            <span class="pts" id="ptsSadness">15</span>
          </div>
          <div class="emotion-point-chip" id="chipFrustration">
            <span class="label">⚡ Tension</span>
            <span class="pts" id="ptsFrustration">10</span>
          </div>
          <div class="emotion-point-chip" id="chipCurious">
            <span class="label">✨ Focus</span>
            <span class="pts" id="ptsCurious">25</span>
          </div>
        </div>

        <div class="voice-metric">
          <span style="color: var(--text-dim);">Live Pitch (F0):</span>
          <strong id="metricPitch">165 Hz</strong>
        </div>
        <div class="voice-metric">
          <span style="color: var(--text-dim);">Biometric Voice Isolation:</span>
          <strong style="color: var(--neon-green);" id="metricIsolation">Wearer Only (94% match)</strong>
        </div>
      </section>

      <!-- 4. REMEDY STEPS TO GROW HAPPY EMOTION -->
      <section class="card span-2">
        <div class="card-title">
          <span>Micro-Remedies & Mood Transformation</span>
          <span style="color: var(--neon-green);">Transform Mood $\rightarrow$ +Bonus XP</span>
        </div>
        <div id="questList">
          <!-- Quests will be rendered dynamically -->
        </div>
      </section>
    </div>
  `

  const state = app.getStateManager()
  const petManager = app.getPetManager()

  // Update HUD Mirror
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
        `┌── [ WELLNESS REMEDY ] ──────────────────────── [ +${active ? active.rewardXp : 0} XP ] ──┐`,
        `│                                                       │`,
        `│  Target: ${active ? active.title.padEnd(43) : 'All Completed!'.padEnd(43)} │`,
        `│  Remedy: ${active ? active.microStep.padEnd(43) : ''.padEnd(43)} │`,
        `│  Reward: +${active ? active.rewardEssence : 0} ${active ? active.targetEmotion.toUpperCase() : ''} Essence                             │`,
        `│                                                       │`,
        `└────────────────────────────────── [TAP] Complete | [SWIPE] Goal ┘`,
      ].join('\n')
    } else if (screen === 'endgoal') {
      const goal = petManager.getEndGoalStatus()
      const pts = petManager.getEmotionPoints()
      mirrorEl.textContent = [
        `┌── [ ZENITH END GOAL ] ────────────────────────── [ RESILIENCE ] ──┐`,
        `│  Rank: ${goal.currentAscensionRank.padEnd(47)}│`,
        `│  Equilibrium: ${goal.equilibriumScore}% / 100%       Total Pts: ${pts.totalVoicePoints} Pts        │`,
        `│  Joy: ${pts.joy} | Calm: ${pts.calm} | Anxiety: ${pts.anxiety} | Sad: ${pts.sadness} | Grit: ${pts.frustration}       │`,
        `│                                                       │`,
        `│  "Balance all 5 emotions to awaken the Zenith Guardian"│`,
        `└────────────────────────────────────── [SWIPE] Pet HUD ┘`,
      ].join('\n')
    } else if (screen === 'breeding') {
      const pair = petManager.getBreedingPair()
      const pts = petManager.getEmotionPoints()
      mirrorEl.textContent = [
        `┌── [ BREEDING LAB ] ───────────────────────────── [ SANCTUARY ] ──┐`,
        `│  Joy: ${pts.joy} | Calm: ${pts.calm} | Focus: ${pts.curiosity}                          │`,
        `│  ${pair ? `Incubating: ${pair.eggSpecies.toUpperCase()} (${pair.currentEssence}/${pair.hatchCostEssence} Essence)` : 'Incubate two emotional spirits into a hybrid'}   │`,
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
            <h4 style="font-size: 0.95rem; margin-bottom: 3px;">${q.title}</h4>
            <p style="font-size: 0.8rem; color: var(--text-dim);">${q.microStep}</p>
            <span style="font-size: 0.72rem; color: var(--neon-cyan); margin-top: 3px; display: inline-block;">
              Remedy for: <strong>${q.remedyFor.toUpperCase()}</strong> $\\rightarrow$ Boosts <strong>${q.targetEmotion.toUpperCase()}</strong>
            </span>
          </div>
          <div style="text-align: right;">
            <div style="font-size: 0.8rem; color: var(--neon-amber); font-weight: 600;">+${q.rewardXp} XP</div>
            ${
              !q.completed
                ? `<button class="btn btn-primary btn-complete-quest" data-id="${q.id}" style="padding: 4px 8px; font-size: 0.75rem; margin-top: 4px;">Done</button>`
                : '<span style="font-size: 0.75rem; color: #666;">Completed ✓</span>'
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
    const pts = petManager.getEmotionPoints()
    const goal = petManager.getEndGoalStatus()

    // 0. End Goal Hero update
    const goalTitle = document.getElementById('goalTitle')
    const eqText = document.getElementById('equilibriumPercentText')
    const eqBar = document.getElementById('equilibriumBar')
    const rankTag = document.getElementById('ascensionRankTag')
    if (goalTitle) goalTitle.textContent = `🏆 ${goal.title}`
    if (eqText) eqText.textContent = `${goal.equilibriumScore}% Equilibrium`
    if (eqBar) eqBar.style.width = `${goal.equilibriumScore}%`
    if (rankTag) rankTag.textContent = goal.currentAscensionRank

    // 1. Pet Stats & Visible Growth
    const petNameEl = document.getElementById('petName')
    const petSpeciesEl = document.getElementById('petSpecies')
    const petLevelTag = document.getElementById('petLevelTag')
    const petHpText = document.getElementById('petHpText')
    const petHpBar = document.getElementById('petHpBar')
    const petXpText = document.getElementById('petXpText')
    const petXpBar = document.getElementById('petXpBar')
    const petAvatarPreview = document.getElementById('petAvatarPreview')
    const growthMilestoneText = document.getElementById('growthMilestoneText')

    if (petNameEl) petNameEl.textContent = pet.name
    if (petSpeciesEl) petSpeciesEl.textContent = `${pet.speciesName} (${pet.stage.toUpperCase()})`
    if (petLevelTag) petLevelTag.textContent = `Lvl ${pet.level} ${pet.stage.toUpperCase()}`
    if (petHpText) petHpText.textContent = `${pet.happiness}%`
    if (petHpBar) petHpBar.style.width = `${pet.happiness}%`
    if (petXpText) petXpText.textContent = `${pet.xp} / ${pet.xpToNextLevel} XP`
    if (petXpBar) petXpBar.style.width = `${Math.min(100, Math.round((pet.xp / pet.xpToNextLevel) * 100))}%`

    if (petAvatarPreview) {
      petAvatarPreview.textContent = getPetAscii(pet.speciesId, pet.stage)
      petAvatarPreview.style.transform = `scale(${pet.sizeScale})`
    }

    if (growthMilestoneText) {
      if (pet.stage === 'hatchling') growthMilestoneText.textContent = 'Stage 1 of 4 • Grows to Wisp at Level 3'
      else if (pet.stage === 'wisp') growthMilestoneText.textContent = 'Stage 2 of 4 • Grows to Juvenile Beast at Level 6'
      else if (pet.stage === 'juvenile') growthMilestoneText.textContent = 'Stage 3 of 4 • Grows to Ascended Guardian at Level 10'
      else growthMilestoneText.textContent = '★ Stage 4 of 4: MAX ASCENDED GUARDIAN! ★'
    }

    // Growth dots update
    const dots = document.querySelectorAll('.growth-dot')
    const stageIndex = ['hatchling', 'wisp', 'juvenile', 'ascended'].indexOf(pet.stage)
    dots.forEach((dot, idx) => {
      if (idx <= stageIndex) dot.classList.add('active')
      else dot.classList.remove('active')
    })

    // 2. Emotion Points Vault
    const ptsJoy = document.getElementById('ptsJoy')
    const ptsCalm = document.getElementById('ptsCalm')
    const ptsAnxiety = document.getElementById('ptsAnxiety')
    const ptsSadness = document.getElementById('ptsSadness')
    const ptsFrustration = document.getElementById('ptsFrustration')
    const ptsCurious = document.getElementById('ptsCurious')
    const totalVoicePointsBadge = document.getElementById('totalVoicePointsBadge')

    if (ptsJoy) ptsJoy.textContent = String(pts.joy)
    if (ptsCalm) ptsCalm.textContent = String(pts.calm)
    if (ptsAnxiety) ptsAnxiety.textContent = String(pts.anxiety)
    if (ptsSadness) ptsSadness.textContent = String(pts.sadness)
    if (ptsFrustration) ptsFrustration.textContent = String(pts.frustration)
    if (ptsCurious) ptsCurious.textContent = String(pts.curiosity)
    if (totalVoicePointsBadge) totalVoicePointsBadge.textContent = `${pts.totalVoicePoints} Total Pts`

    // Active chip highlight
    const chips: Record<string, HTMLElement | null> = {
      joy: document.getElementById('chipJoy'),
      calm: document.getElementById('chipCalm'),
      anxiety: document.getElementById('chipAnxiety'),
      sadness: document.getElementById('chipSadness'),
      frustration: document.getElementById('chipFrustration'),
      curiosity: document.getElementById('chipCurious'),
    }
    Object.entries(chips).forEach(([emo, el]) => {
      if (el) {
        if (emo === pet.dominantMood) el.classList.add('active')
        else el.classList.remove('active')
      }
    })

    // 3. Biometric Prosody & Isolation
    const reading = s.lastReading
    const metricPitch = document.getElementById('metricPitch')
    const metricIsolation = document.getElementById('metricIsolation')
    if (reading) {
      if (metricPitch) metricPitch.textContent = `${reading.pitchHz} Hz`
      if (metricIsolation) {
        metricIsolation.textContent = reading.isUserVoice
          ? `Wearer Verified (${Math.round(reading.userVoiceConfidence * 100)}%)`
          : 'Ambient Speaker Ignored'
        metricIsolation.style.color = reading.isUserVoice ? 'var(--neon-green)' : 'var(--text-dim)'
      }
    }

    renderQuests()
    updateMirror()
  }

  // Button Listeners
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
    const screens = ['pet', 'quest', 'endgoal', 'breeding'] as const
    const cur = state.get().currentScreen
    const next = screens[(screens.indexOf(cur as any) + 1) % screens.length]
    state.update({ currentScreen: next })
    await app.renderHudScreen()
    updateUI()
  })

  document.getElementById('btnSimSwipeBack')?.addEventListener('click', async () => {
    const screens = ['pet', 'quest', 'endgoal', 'breeding'] as const
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

  // Listen to state changes
  state.onChange(() => updateUI())

  // Initial draw
  updateUI()
}
