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
      line-height: 1.3;
      text-align: center;
      transition: all 0.4s ease;
      background: radial-gradient(circle, rgba(0, 255, 170, 0.14) 0%, rgba(0, 0, 0, 0.5) 100%);
      border: 1px solid rgba(0, 255, 170, 0.35);
      padding: 14px 20px;
      border-radius: 12px;
      font-size: 0.95rem;
      letter-spacing: 1px;
      box-shadow: 0 0 16px rgba(0, 255, 170, 0.18) inset, 0 4px 14px rgba(0, 0, 0, 0.5);
      min-width: 140px;
      display: flex;
      justify-content: center;
      align-items: center;
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

    /* 4-Stage Flow Pipeline Bar */
    .flow-pipeline-bar {
      display: grid;
      grid-template-columns: 1fr auto 1fr auto 1fr auto 1fr;
      gap: 10px;
      align-items: center;
      background: rgba(14, 21, 30, 0.95);
      border: 1px solid rgba(0, 255, 170, 0.35);
      border-radius: 14px;
      padding: 12px 18px;
      box-shadow: 0 4px 24px rgba(0, 0, 0, 0.5), 0 0 16px rgba(0, 255, 170, 0.12) inset;
    }

    @media (max-width: 820px) {
      .flow-pipeline-bar {
        grid-template-columns: 1fr;
        gap: 8px;
      }
      .flow-arrow {
        display: none;
      }
    }

    .flow-step {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 8px 12px;
      border-radius: 10px;
      background: rgba(255, 255, 255, 0.03);
      border: 1px solid rgba(255, 255, 255, 0.06);
      transition: all 0.3s ease;
    }

    .flow-step.active {
      background: rgba(0, 255, 170, 0.12);
      border-color: var(--neon-green);
      box-shadow: 0 0 16px rgba(0, 255, 170, 0.22);
    }

    .flow-step .step-num {
      width: 24px;
      height: 24px;
      border-radius: 50%;
      background: rgba(255, 255, 255, 0.1);
      color: #fff;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 0.75rem;
      font-weight: 700;
    }

    .flow-step.active .step-num {
      background: var(--neon-green);
      color: #070a0e;
    }

    .flow-step .step-title {
      font-size: 0.8rem;
      font-weight: 700;
      color: #fff;
    }

    .flow-step .step-subtitle {
      font-size: 0.7rem;
      color: var(--text-dim);
      margin-top: 1px;
    }

    .flow-arrow {
      color: rgba(255, 255, 255, 0.35);
      font-size: 0.95rem;
      font-weight: 700;
      text-align: center;
    }

    /* Hero Reactive Quest Card */
    .hero-quest-card {
      background: linear-gradient(135deg, rgba(0, 229, 255, 0.12) 0%, rgba(181, 23, 158, 0.08) 100%), var(--card-bg);
      border: 2px solid var(--neon-cyan);
      border-radius: 16px;
      padding: 18px 20px;
      box-shadow: 0 0 24px rgba(0, 229, 255, 0.16), 0 8px 30px rgba(0, 0, 0, 0.5);
      position: relative;
      overflow: hidden;
      margin-bottom: 16px;
      transition: all 0.3s ease;
    }

    .hero-quest-card::before {
      content: '';
      position: absolute;
      top: 0; left: 0; right: 0; height: 3px;
      background: linear-gradient(90deg, var(--neon-green), var(--neon-cyan), var(--neon-amber));
    }

    .quest-badge-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 10px;
      flex-wrap: wrap;
      gap: 8px;
    }

    .quest-category-badge {
      font-size: 0.72rem;
      font-weight: 700;
      letter-spacing: 0.6px;
      padding: 4px 10px;
      border-radius: 8px;
      background: rgba(0, 229, 255, 0.15);
      color: var(--neon-cyan);
      border: 1px solid rgba(0, 229, 255, 0.35);
      text-transform: uppercase;
    }

    .quest-reward-pill {
      font-size: 0.75rem;
      font-weight: 700;
      color: var(--neon-amber);
      background: rgba(255, 183, 3, 0.15);
      border: 1px solid rgba(255, 183, 3, 0.35);
      padding: 4px 10px;
      border-radius: 12px;
    }

    .quest-trigger-note {
      font-size: 0.76rem;
      color: #94a3b8;
      background: rgba(0, 0, 0, 0.4);
      padding: 8px 12px;
      border-radius: 6px;
      margin-bottom: 12px;
      border-left: 3px solid var(--neon-amber);
      line-height: 1.4;
    }

    .quest-steps-list {
      list-style: none;
      margin: 10px 0 14px 0;
      display: flex;
      flex-direction: column;
      gap: 6px;
    }

    .quest-steps-list li {
      font-size: 0.82rem;
      color: #cbd5e1;
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 7px 12px;
      background: rgba(255, 255, 255, 0.03);
      border-radius: 8px;
      border: 1px solid rgba(255, 255, 255, 0.05);
    }

    .quest-steps-list li .step-idx {
      font-size: 0.7rem;
      font-weight: 700;
      color: var(--neon-green);
      background: rgba(0, 255, 170, 0.15);
      width: 20px;
      height: 20px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }

    .quest-action-row {
      display: flex;
      gap: 10px;
      align-items: center;
      flex-wrap: wrap;
    }

    .quest-timer-box {
      font-family: 'JetBrains Mono', monospace;
      font-size: 0.8rem;
      color: var(--neon-cyan);
      font-weight: 600;
      padding: 8px 14px;
      background: rgba(0, 229, 255, 0.1);
      border: 1px solid var(--neon-cyan);
      border-radius: 8px;
      display: flex;
      align-items: center;
      gap: 8px;
      cursor: pointer;
      transition: all 0.2s ease;
    }

    .quest-timer-box:hover {
      background: rgba(0, 229, 255, 0.22);
      transform: translateY(-1px);
    }

    .glasses-temple-hint {
      font-size: 0.74rem;
      color: var(--neon-green);
      display: flex;
      align-items: center;
      gap: 6px;
      margin-top: 10px;
      opacity: 0.9;
    }

    /* Quest Filter Tabs */
    .quest-filter-tabs {
      display: flex;
      gap: 8px;
      margin-bottom: 12px;
      border-bottom: 1px solid rgba(255, 255, 255, 0.08);
      padding-bottom: 8px;
      overflow-x: auto;
    }

    .quest-tab {
      background: none;
      border: none;
      color: var(--text-dim);
      font-size: 0.78rem;
      font-weight: 600;
      padding: 6px 12px;
      border-radius: 6px;
      cursor: pointer;
      transition: all 0.2s ease;
      white-space: nowrap;
    }

    .quest-tab:hover {
      color: #fff;
    }

    .quest-tab.active {
      background: rgba(0, 255, 170, 0.15);
      color: var(--neon-green);
      font-weight: 700;
    }

    /* Secondary Quest Grid */
    .quest-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
      gap: 12px;
    }

    .quest-card {
      background: rgba(255, 255, 255, 0.03);
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 12px;
      padding: 14px;
      transition: all 0.25s ease;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      gap: 10px;
    }

    .quest-card:hover {
      border-color: rgba(0, 229, 255, 0.4);
      background: rgba(255, 255, 255, 0.05);
      transform: translateY(-2px);
    }

    .quest-card.completed {
      opacity: 0.45;
      border-color: rgba(255, 255, 255, 0.04);
      background: rgba(0, 0, 0, 0.25);
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
      <!-- 4-STAGE LIVE EMOTIONAL FLOW PIPELINE -->
      <section class="span-2 flow-pipeline-bar">
        <div class="flow-step active" id="flowStep1">
          <div class="step-num">1</div>
          <div>
            <div class="step-title">🎙️ Passive Voice</div>
            <div class="step-subtitle" id="flowStep1Sub">Biometric Guard Active</div>
          </div>
        </div>
        <div class="flow-arrow">➔</div>
        <div class="flow-step" id="flowStep2">
          <div class="step-num">2</div>
          <div>
            <div class="step-title">⚡ Emotion Caught</div>
            <div class="step-subtitle" id="flowStep2Sub">Analyzing Cadence...</div>
          </div>
        </div>
        <div class="flow-arrow">➔</div>
        <div class="flow-step" id="flowStep3">
          <div class="step-num">3</div>
          <div>
            <div class="step-title">🌱 Reactive Quest</div>
            <div class="step-subtitle" id="flowStep3Sub">Active Remedy Queued</div>
          </div>
        </div>
        <div class="flow-arrow">➔</div>
        <div class="flow-step" id="flowStep4">
          <div class="step-num">4</div>
          <div>
            <div class="step-title">🏆 Zenith Core</div>
            <div class="step-subtitle" id="flowStep4Sub">Equilibrium 35%</div>
          </div>
        </div>
      </section>

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

      <!-- 1. PRIMARY SPEAKER VOICE ENROLLMENT (Save Your Voice) -->
      <section class="card span-2" id="voiceEnrollmentCard" style="border: 1px solid rgba(255, 183, 3, 0.4); background: linear-gradient(135deg, rgba(255, 183, 3, 0.08) 0%, rgba(0, 229, 255, 0.05) 100%), var(--card-bg);">
        <div class="card-title">
          <span>🎙️ Primary Speaker Voice Profile</span>
          <span style="font-size: 0.75rem; color: #ffb703; font-weight: 700;" id="voiceEnrollmentBadge">⚠️ SAVE YOUR VOICE</span>
        </div>
        
        <!-- Not Enrolled State -->
        <div id="enrollmentPromptBox" style="display: block;">
          <p style="font-size: 0.82rem; color: #cbd5e1; margin-bottom: 8px;">
            AuraPet needs to <strong>save your voice</strong> so it sets you as the <strong>Primary Speaker</strong> and completely ignores other people speaking nearby.
          </p>
          <div style="background: rgba(0,0,0,0.3); border-left: 3px solid var(--neon-cyan); padding: 8px 12px; border-radius: 6px; font-size: 0.82rem; color: #fff; margin-bottom: 12px;">
            💬 Read aloud: <em>"Hi AuraPet, I am saving my voice as the primary speaker."</em>
          </div>
          <div style="display: flex; gap: 12px; align-items: center; flex-wrap: wrap;">
            <button class="btn btn-primary" id="btnStartEnrollment" style="background: linear-gradient(135deg, #ffb703, #ff3366); color: #000; font-weight: 700; padding: 8px 18px;">
              🔴 Record & Save My Voice (4s)
            </button>
            <button class="btn" id="btnQuickLockVoicePrompt" style="background: rgba(0, 255, 170, 0.15); border: 1px solid var(--neon-green); color: var(--neon-green); font-weight: 600; padding: 8px 14px;">
              🎯 1-Click Lock Current Voice
            </button>
            <button class="btn" id="btnToggleLiveMic" style="background: rgba(0, 229, 255, 0.12); border: 1px solid var(--neon-cyan); color: var(--neon-cyan); font-weight: 600; padding: 8px 14px;">
              🎙️ Enable / Restart Mic
            </button>
            <span id="enrollmentStatusText" style="font-size: 0.82rem; color: var(--neon-cyan); font-weight: 600;"></span>
          </div>
        </div>

        <!-- Enrolled State -->
        <div id="enrollmentSavedBox" style="display: none;">
          <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px;">
            <div>
              <div style="font-size: 0.88rem; color: #fff; font-weight: 700; display: flex; align-items: center; gap: 6px;">
                <span style="color: var(--neon-green);">🟢</span> Primary Speaker Locked:
                <span style="color: var(--neon-green);" id="savedVoiceSummary">175 Hz (±22 Hz) • Centroid 1220 Hz</span>
              </div>
              <div style="font-size: 0.75rem; color: var(--neon-green); margin-top: 3px;">
                ✓ Active Ground Truth: Any other voices in the room are automatically rejected as external ambient chatter.
              </div>
            </div>
            <div style="display: flex; gap: 8px; flex-wrap: wrap;">
              <button class="btn" id="btnQuickReLockVoice" style="font-size: 0.78rem; padding: 6px 12px; border-color: var(--neon-cyan); color: var(--neon-cyan);">🎯 Re-lock Current</button>
              <button class="btn" id="btnReEnrollVoice" style="font-size: 0.78rem; padding: 6px 12px;">🔄 Re-record (4s)</button>
              <button class="btn" id="btnClearVoice" style="font-size: 0.78rem; padding: 6px 12px; color: #ff6b6b; border: 1px solid rgba(255,107,107,0.4);">🗑️ Reset</button>
            </div>
          </div>
        </div>
      </section>

      <!-- 2. G2 HUD MIRROR -->
      <section class="card span-2">
        <div class="card-title">
          <span>G2 Glasses Display (Live Mirror)</span>
          <span style="font-size: 0.75rem; color: var(--neon-green);" id="activeScreenTag">PET COMPANION HUD</span>
        </div>
        <div id="g2GlassesConnectionBanner" style="display: flex; align-items: center; justify-content: space-between; font-size: 0.75rem; margin-bottom: 8px; padding: 6px 10px; background: rgba(0,0,0,0.3); border-radius: 6px; border: 1px solid rgba(255,255,255,0.08); flex-wrap: wrap; gap: 6px;">
          <span id="g2StatusText">👓 Hardware Link: <strong style="color: var(--neon-cyan);">Ready to Push (BLE / Web Bridge)</strong></span>
          <span id="g2ScreenSizeText" style="color: var(--text-dim);">576×288 Monochrome Green</span>
        </div>
        <pre class="g2-hud-screen" id="hudMirror">Loading G2 HUD Display...</pre>
        <div class="sim-controls">
          <button class="btn btn-primary" id="btnConnectGlasses" style="background: linear-gradient(135deg, #00ffaa, #00e5ff); color: #0a0e14; font-weight: 700;">👓 Send HUD to Glasses Lens</button>
          <button class="btn" id="btnShowQrModal" style="background: rgba(0, 229, 255, 0.15); border: 1px solid var(--neon-cyan); color: var(--neon-cyan); font-weight: 700;">📱 Sideload QR Code</button>
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

      <!-- 4. DYNAMIC REACTIVE SIDE QUESTS & SOMATIC REMEDIES -->
      <section class="card span-2" id="questsSectionCard">
        <div class="card-title">
          <span>🌱 Dynamic Reactive Quests & Somatic Remedies</span>
          <span style="color: var(--neon-green); font-size: 0.75rem; font-weight: 700;" id="activeRemedyCountBadge">⚡ 1 Active Remedy Spawned</span>
        </div>
        
        <p style="font-size: 0.78rem; color: var(--text-dim); margin-bottom: 14px;">
          When your voice exhibits tension, anxiety, or low energy, AuraPet generates an immediate micro-action. Completing it transforms heavy energy into Ascension XP & Essence.
        </p>

        <!-- Quest Filter Tabs -->
        <div class="quest-filter-tabs">
          <button class="quest-tab active" data-filter="all">All Quests (<span id="countAllQuests">3</span>)</button>
          <button class="quest-tab" data-filter="reactive">⚡ Active Remedies (<span id="countReactiveQuests">1</span>)</button>
          <button class="quest-tab" data-filter="mindful">🧘 Daily Resilience (<span id="countMindfulQuests">2</span>)</button>
          <button class="quest-tab" data-filter="completed">✓ Completed (<span id="countCompletedQuests">0</span>)</button>
        </div>

        <!-- Hero Active Remedy Spotlight Container -->
        <div id="heroQuestContainer"></div>

        <!-- Secondary Quests Deck -->
        <div id="secondaryQuestsGrid" class="quest-grid"></div>
      </section>

      <!-- 5. SMART SPEAKER DIARIZATION ENGINE (Wearer Gating) -->
      <section class="card span-2" style="background: linear-gradient(135deg, rgba(0, 229, 255, 0.08) 0%, rgba(0, 255, 170, 0.05) 100%), var(--card-bg); border: 1px solid rgba(0, 229, 255, 0.3);">
        <div class="card-title">
          <span>🎙️ Smart Speaker Diarization Engine</span>
          <span style="font-size: 0.75rem; color: var(--neon-green);" id="diarizerStatusTag">🔒 Locked to Wearer Only</span>
        </div>
        <div style="display: flex; flex-wrap: wrap; gap: 14px; justify-content: space-between; align-items: center; margin-bottom: 12px;">
          <div>
            <div style="font-size: 0.82rem; color: #fff; font-weight: 600;">
              Active Acoustic Diarizer:
              <span id="activeSpeakerNameBadge" style="color: var(--neon-green); margin-left: 6px;">🟢 You (Wearer) • 96% Match</span>
            </div>
            <div style="font-size: 0.75rem; color: var(--text-dim); margin-top: 3px;">
              Speaker diarization distinguishes the glasses wearer from other people in the room using pitch ($F_0$), spectral centroid timbre, and near-field proximity gating. External voices are strictly ignored.
            </div>
          </div>
          <div style="display: flex; gap: 8px; flex-wrap: wrap;">
            <button class="btn btn-primary" id="btnLockMyVoice" style="font-size: 0.78rem; padding: 6px 12px; background: linear-gradient(135deg, #00ffaa, #00e5ff); color: #0a0e14; font-weight: 700;">
              🎯 1-Click Lock My Voice
            </button>
            <button class="btn" id="btnToggleDiarizeMode" style="font-size: 0.78rem; padding: 6px 12px;">
              🛡️ Mode: Strict (Reject Others)
            </button>
          </div>
        </div>
        <div style="display: flex; gap: 16px; font-size: 0.75rem; color: var(--text-dim); border-top: 1px solid rgba(255,255,255,0.08); padding-top: 8px; flex-wrap: wrap;">
          <div>Target Pitch: <strong style="color: #fff;" id="diarizeTargetPitch">165 Hz (±22 Hz)</strong></div>
          <div>Timbre Centroid: <strong style="color: #fff;" id="diarizeTargetCentroid">1200 Hz</strong></div>
          <div>Near-Field Gate: <strong style="color: var(--neon-green);">Mouth Proximity Enabled</strong></div>
        </div>
      </section>

      <!-- 6. AMBIENT DAILY SPEECH & EMOTION TRANSCRIPTION JOURNAL -->
      <section class="card span-2">
        <div class="card-title">
          <span>Ambient Daily Speech Journal (Speaker Diarized)</span>
          <span style="color: var(--neon-cyan);">Live STT & Emotion Scoring</span>
        </div>
        <p style="font-size: 0.78rem; color: var(--text-dim); margin-bottom: 12px;">
          Go about your daily life and talk naturally. AuraPet diarizes speech in real-time: your voice scores emotions and grows your pet, while other people's speech is automatically filtered out.
        </p>

        <!-- Quick Phrase Tester -->
        <div style="display: flex; gap: 8px; margin-bottom: 14px; flex-wrap: wrap;">
          <input type="text" id="inputDemoPhrase" placeholder="Type or speak a test phrase (e.g., 'I am so excited about this demo!')..." 
            style="flex: 1; min-width: 260px; padding: 8px 12px; background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.15); border-radius: 8px; color: #fff; font-size: 0.82rem;">
          <button class="btn btn-primary" id="btnTestPhrase">Test as You (Wearer)</button>
          <button class="btn" id="btnTestExternalSpeaker" style="background: rgba(255,75,75,0.15); border: 1px solid rgba(255,75,75,0.4); color: #ff6b6b;">🧪 Test as Other Person (Ambient)</button>
        </div>

        <div id="transcriptFeed" style="display: flex; flex-direction: column; gap: 8px; max-height: 320px; overflow-y: auto;">
          <!-- Transcripts rendered here -->
        </div>
      </section>

      <!-- QR Code Modal for Even Reality G2 Sideloading -->
      <div id="qrModalOverlay" style="display: none; position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; background: rgba(0,0,0,0.85); backdrop-filter: blur(8px); z-index: 9999; justify-content: center; align-items: center;">
        <div style="background: #0f172a; border: 2px solid var(--neon-cyan); border-radius: 16px; padding: 24px; max-width: 460px; width: 92%; text-align: center; box-shadow: 0 0 32px rgba(0,229,255,0.3); max-height: 90vh; overflow-y: auto;">
          <h3 style="font-size: 1.25rem; color: #fff; margin-bottom: 6px;">📱 Connect Even Reality G2 Glasses</h3>
          <p style="font-size: 0.8rem; color: var(--text-dim); margin-bottom: 14px;">
            Open Even Reality app on your phone &gt; <strong>Even Lab</strong> &gt; <strong>Prototype</strong> &gt; Scan this QR code.
          </p>
          <div style="background: #fff; padding: 12px; border-radius: 12px; display: inline-block; margin-bottom: 12px;">
            <img src="https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=http://192.168.1.113:5173" alt="Even Reality QR Code" style="width: 200px; height: 200px; display: block;" />
          </div>
          <div style="font-family: monospace; font-size: 0.82rem; color: var(--neon-cyan); margin-bottom: 14px; background: rgba(0,0,0,0.4); padding: 8px 12px; border-radius: 8px; word-break: break-all;">
            http://192.168.1.113:5173
          </div>
          
          <!-- Crucial Multi-Device Bluetooth Warning -->
          <div style="font-size: 0.76rem; color: #cbd5e1; margin-bottom: 16px; text-align: left; line-height: 1.5; background: rgba(255, 183, 3, 0.08); border-left: 3px solid var(--neon-amber); padding: 10px 12px; border-radius: 6px;">
            <strong style="color: var(--neon-amber); display: block; margin-bottom: 4px;">⚠️ Testing with a New Phone / Device?</strong>
            Even Reality G2 glasses connect via Bluetooth to <strong>only ONE phone at a time</strong>.<br>
            <strong>1. Disconnect Old Phone:</strong> Turn off Bluetooth on your previous phone.<br>
            <strong>2. Verify G2 Connected on New Phone:</strong> In Even Reality app &gt; <em>Glasses</em> tab, make sure both temples show <strong>Connected</strong> with battery status (L: XX%, R: XX%).<br>
            <strong>3. Same Wi-Fi:</strong> Ensure the new phone is connected to this Wi-Fi network (not on 5G cellular data).<br>
            <strong>4. Package File Alternative:</strong> You can also install the prebuilt package <code>g2-app.ehpk</code> in Even Lab.
          </div>
          <button class="btn btn-primary" id="btnCloseQrModal" style="width: 100%; padding: 10px; font-weight: 700;">Close</button>
        </div>
      </div>
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
      const fp = app.getVoiceAnalyzer().getFingerprint()
      const voiceTag = fp.isEnrolled ? `[VOICE: ${fp.medianPitchHz}Hz LOCKED]` : '[VOICE: UNENROLLED]'
      mirrorEl.textContent = [
        `┌── [ ${pet.name} ] ───────────────────── [ ${pet.stage.toUpperCase()} LVL ${pet.level} ] ──┐`,
        `│  Mood: ${getEmotionEmoji(pet.dominantMood).padEnd(18)} XP: ${pet.xp}/${pet.xpToNextLevel} (${Math.round((pet.xp/pet.xpToNextLevel)*100)}%) ${voiceTag.padStart(20)} │`,
        `│                                                       │`,
        ...ascii.split('\n').map((line) => `│  ${line.padEnd(25)}  Pitch: ${reading ? reading.pitchHz + ' Hz' : fp.medianPitchHz + ' Hz'}               │`),
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

  let activeQuestFilter: 'all' | 'reactive' | 'mindful' | 'completed' = 'all'
  let activeGuidedTimerInterval: any = null

  // Render Quests list with Hero Reactive Spotlight & Secondary Deck
  const renderQuests = () => {
    const heroEl = document.getElementById('heroQuestContainer')
    const secondaryEl = document.getElementById('secondaryQuestsGrid')
    if (!heroEl || !secondaryEl) return

    const quests = petManager.getActiveQuests()
    const uncompleted = quests.filter((q) => !q.completed)
    const completed = quests.filter((q) => q.completed)
    const reactive = uncompleted.filter((q) => q.category === 'anxiety_remedy' || q.category === 'burnout_shield' || q.isDynamic)
    const mindful = uncompleted.filter((q) => q.category === 'joy_anchor' || q.category === 'mindful_reset' || q.category === 'grit_power')

    // Update Tab Counts
    const cAll = document.getElementById('countAllQuests')
    const cReactive = document.getElementById('countReactiveQuests')
    const cMindful = document.getElementById('countMindfulQuests')
    const cCompleted = document.getElementById('countCompletedQuests')
    const badgeRemedy = document.getElementById('activeRemedyCountBadge')

    if (cAll) cAll.textContent = quests.length.toString()
    if (cReactive) cReactive.textContent = reactive.length.toString()
    if (cMindful) cMindful.textContent = mindful.length.toString()
    if (cCompleted) cCompleted.textContent = completed.length.toString()
    if (badgeRemedy) {
      badgeRemedy.textContent = reactive.length > 0 
        ? `⚡ ${reactive.length} Active ${reactive.length === 1 ? 'Remedy' : 'Remedies'} Spawned`
        : '🌿 Equilibrium Balanced'
    }

    // 1. Pick Hero Quest (highest priority uncompleted reactive remedy, or first uncompleted)
    const heroQuest = reactive[0] || uncompleted[0]

    if (heroQuest && activeQuestFilter !== 'completed') {
      const stepsHtml = (heroQuest.steps || [heroQuest.microStep])
        .map((step, idx) => `
          <li>
            <span class="step-idx">${idx + 1}</span>
            <span>${step}</span>
          </li>
        `)
        .join('')

      heroEl.innerHTML = `
        <div class="hero-quest-card" data-id="${heroQuest.id}">
          <div class="quest-badge-row">
            <span class="quest-category-badge">${heroQuest.categoryLabel || '⚡ REACTIVE SOMATIC REMEDY'}</span>
            <span class="quest-reward-pill">+${heroQuest.rewardXp} XP • +${heroQuest.rewardEssence} ${heroQuest.targetEmotion.toUpperCase()} ESSENCE</span>
          </div>
          <h3 style="font-size: 1.15rem; color: #fff; margin-bottom: 6px; display: flex; align-items: center; gap: 8px;">
            <span>${heroQuest.icon || '🌱'}</span>
            <span>${heroQuest.title}</span>
          </h3>
          <p style="font-size: 0.85rem; color: #cbd5e1; margin-bottom: 10px; line-height: 1.45;">
            ${heroQuest.microStep}
          </p>
          <div class="quest-trigger-note">
            ⚡ <strong>Acoustic Trigger:</strong> ${heroQuest.triggerReason || 'Dynamically calibrated from recent speech patterns'}
          </div>
          <ul class="quest-steps-list">
            ${stepsHtml}
          </ul>
          <div class="quest-action-row">
            <button class="quest-timer-box" id="btnStartQuestTimer" data-duration="${heroQuest.durationSec || 15}" data-id="${heroQuest.id}">
              <span>▶️ Start ${heroQuest.durationSec || 15}s Guided Action</span>
            </button>
            <button class="btn btn-primary btn-complete-quest" data-id="${heroQuest.id}" style="padding: 8px 18px; font-weight: 700; background: linear-gradient(135deg, #00ffaa, #00e5ff); color: #070a0e;">
              ✓ Complete & Claim XP
            </button>
          </div>
          <div class="glasses-temple-hint">
            <span>👓</span>
            <span><strong>G2 Glasses Shortcut:</strong> Tap the right temple on your Even Reality glasses anytime to complete this remedy.</span>
          </div>
        </div>
      `
    } else {
      heroEl.innerHTML = `
        <div style="background: rgba(0, 255, 170, 0.06); border: 1px dashed var(--neon-green); border-radius: 14px; padding: 18px; text-align: center; margin-bottom: 16px;">
          <div style="font-size: 1.4rem; margin-bottom: 4px;">🎉</div>
          <div style="font-size: 0.95rem; font-weight: 700; color: #fff; margin-bottom: 2px;">All Micro-Remedies Cleared!</div>
          <div style="font-size: 0.78rem; color: var(--text-dim);">Talk naturally with someone or in a meeting. If tension or anxiety arises, AuraPet will automatically spawn a new somatic remedy.</div>
        </div>
      `
    }

    // 2. Secondary Quests Grid
    let secondaryList = quests.filter((q) => q.id !== heroQuest?.id)
    if (activeQuestFilter === 'reactive') {
      secondaryList = reactive.filter((q) => q.id !== heroQuest?.id)
    } else if (activeQuestFilter === 'mindful') {
      secondaryList = mindful.filter((q) => q.id !== heroQuest?.id)
    } else if (activeQuestFilter === 'completed') {
      secondaryList = completed
    }

    if (secondaryList.length === 0) {
      secondaryEl.innerHTML = `
        <div style="grid-column: 1 / -1; padding: 20px; text-align: center; color: var(--text-dim); font-size: 0.8rem;">
          No other quests in this category.
        </div>
      `
    } else {
      secondaryEl.innerHTML = secondaryList.map((q) => `
        <div class="quest-card ${q.completed ? 'completed' : ''}" data-id="${q.id}">
          <div>
            <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 6px;">
              <span style="font-size: 0.68rem; font-weight: 700; color: var(--neon-cyan); text-transform: uppercase;">
                ${q.categoryLabel || q.remedyFor.toUpperCase()}
              </span>
              <span style="font-size: 0.72rem; color: var(--neon-amber); font-weight: 700;">+${q.rewardXp} XP</span>
            </div>
            <h4 style="font-size: 0.9rem; color: #fff; margin-bottom: 4px; display: flex; align-items: center; gap: 6px;">
              <span>${q.icon || '🌱'}</span>
              <span>${q.title}</span>
            </h4>
            <p style="font-size: 0.78rem; color: var(--text-dim); line-height: 1.4;">${q.microStep}</p>
            <div style="font-size: 0.7rem; color: #94a3b8; margin-top: 6px;">
              Target: <strong style="color: var(--neon-green);">${q.targetEmotion.toUpperCase()}</strong> (+${q.rewardEssence} Essence)
            </div>
          </div>
          <div style="display: flex; justify-content: flex-end; margin-top: 8px;">
            ${!q.completed
              ? `<button class="btn btn-primary btn-complete-quest" data-id="${q.id}" style="padding: 5px 12px; font-size: 0.75rem;">Done</button>`
              : `<span style="font-size: 0.75rem; color: var(--neon-green); font-weight: 600;">✓ Completed</span>`
            }
          </div>
        </div>
      `).join('')
    }

    // Attach listeners to complete buttons
    document.querySelectorAll('.btn-complete-quest').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const id = (e.currentTarget as HTMLElement).getAttribute('data-id')
        if (id) {
          const res = petManager.completeQuest(id)
          if (res.success) {
            updateUI()
          }
        }
      })
    })

    // Attach listener for Guided Breath/Action Timer
    const timerBtn = document.getElementById('btnStartQuestTimer')
    if (timerBtn) {
      timerBtn.addEventListener('click', (e) => {
        const targetBtn = e.currentTarget as HTMLElement
        const duration = parseInt(targetBtn.getAttribute('data-duration') || '15', 10)
        const questId = targetBtn.getAttribute('data-id')
        
        if (activeGuidedTimerInterval) {
          clearInterval(activeGuidedTimerInterval)
          activeGuidedTimerInterval = null
        }

        let remaining = duration
        targetBtn.style.pointerEvents = 'none'
        targetBtn.style.background = 'rgba(0, 255, 170, 0.25)'
        targetBtn.style.borderColor = 'var(--neon-green)'
        targetBtn.style.color = 'var(--neon-green)'

        activeGuidedTimerInterval = setInterval(() => {
          remaining--
          if (remaining > 0) {
            const phase = remaining % 8 >= 4 ? '🌬️ Inhale / Hold' : '🌿 Exhale Slow'
            targetBtn.innerHTML = `<span>⏳ ${remaining}s • ${phase}</span>`
          } else {
            clearInterval(activeGuidedTimerInterval)
            activeGuidedTimerInterval = null
            targetBtn.innerHTML = `<span>✨ Completed! Claiming XP...</span>`
            setTimeout(() => {
              if (questId) {
                petManager.completeQuest(questId)
                updateUI()
              }
            }, 600)
          }
        }, 1000)
      })
    }

    // Attach listener for quest tabs
    document.querySelectorAll('.quest-tab').forEach((tab) => {
      tab.addEventListener('click', (e) => {
        const target = e.currentTarget as HTMLElement
        const filter = target.getAttribute('data-filter') as any
        if (filter) {
          activeQuestFilter = filter
          document.querySelectorAll('.quest-tab').forEach((t) => t.classList.remove('active'))
          target.classList.add('active')
          renderQuests()
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

    // 0. Update 4-Stage Flow Pipeline Bar
    const s1 = document.getElementById('flowStep1')
    const s1Sub = document.getElementById('flowStep1Sub')
    const s2 = document.getElementById('flowStep2')
    const s2Sub = document.getElementById('flowStep2Sub')
    const s3 = document.getElementById('flowStep3')
    const s3Sub = document.getElementById('flowStep3Sub')
    const s4 = document.getElementById('flowStep4')
    const s4Sub = document.getElementById('flowStep4Sub')

    if (s1 && s1Sub) {
      const fp = app.getVoiceAnalyzer().getFingerprint()
      if (s.isListening) {
        s1.classList.add('active')
        s1Sub.textContent = fp.isEnrolled ? `Wearer Locked (${fp.medianPitchHz} Hz)` : 'Listening (All Voices)'
      } else {
        s1.classList.remove('active')
        s1Sub.textContent = 'Mic Inactive'
      }
    }

    if (s2 && s2Sub) {
      if (s.lastReading) {
        s2.classList.add('active')
        s2Sub.textContent = `${getEmotionEmoji(s.lastReading.primary)} ${s.lastReading.primary.toUpperCase()} (${Math.round(s.lastReading.confidence * 100)}%)`
      } else {
        s2.classList.remove('active')
        s2Sub.textContent = 'Awaiting Speech...'
      }
    }

    if (s3 && s3Sub) {
      const quests = petManager.getActiveQuests()
      const pending = quests.filter((q) => !q.completed)
      if (pending.length > 0) {
        s3.classList.add('active')
        s3Sub.textContent = `${pending[0].title.slice(0, 18)}...`
      } else {
        s3.classList.remove('active')
        s3Sub.textContent = 'All Completed ✓'
      }
    }

    if (s4 && s4Sub) {
      s4.classList.add('active')
      s4Sub.textContent = `Equilibrium ${goal.equilibriumScore}%`
    }

    // 0b. End Goal Hero update
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

    // 3. Biometric Prosody & Speaker Diarization Metrics
    const va = app.getVoiceAnalyzer()
    const reading = s.lastReading
    const metricPitch = document.getElementById('metricPitch')
    const metricIsolation = document.getElementById('metricIsolation')
    const diarizerStatusTag = document.getElementById('diarizerStatusTag')
    const activeSpeakerNameBadge = document.getElementById('activeSpeakerNameBadge')
    const diarizeTargetPitch = document.getElementById('diarizeTargetPitch')
    const diarizeTargetCentroid = document.getElementById('diarizeTargetCentroid')

    const fp = va.getFingerprint()
    const activeDiar = va.getActiveDiarizedSpeaker()

    if (diarizeTargetPitch) diarizeTargetPitch.textContent = `${fp.medianPitchHz} Hz (±${fp.pitchVariance} Hz)`
    if (diarizeTargetCentroid) diarizeTargetCentroid.textContent = `${fp.spectralCentroid} Hz`

    // Voice Enrollment Primary Speaker Card Sync
    const voiceEnrollmentBadge = document.getElementById('voiceEnrollmentBadge')
    const enrollmentPromptBox = document.getElementById('enrollmentPromptBox')
    const enrollmentSavedBox = document.getElementById('enrollmentSavedBox')
    const savedVoiceSummary = document.getElementById('savedVoiceSummary')
    const voiceEnrollmentCard = document.getElementById('voiceEnrollmentCard')

    if (fp.isEnrolled) {
      if (enrollmentPromptBox) enrollmentPromptBox.style.display = 'none'
      if (enrollmentSavedBox) enrollmentSavedBox.style.display = 'block'
      if (voiceEnrollmentBadge) {
        voiceEnrollmentBadge.textContent = '🔒 PRIMARY SPEAKER LOCKED'
        voiceEnrollmentBadge.style.color = 'var(--neon-green)'
      }
      if (savedVoiceSummary) {
        savedVoiceSummary.textContent = `${fp.medianPitchHz} Hz (±${fp.pitchVariance} Hz) • Centroid ${fp.spectralCentroid} Hz`
      }
      if (voiceEnrollmentCard) {
        voiceEnrollmentCard.style.borderColor = 'rgba(0, 255, 170, 0.4)'
        voiceEnrollmentCard.style.background = 'linear-gradient(135deg, rgba(0, 255, 170, 0.08) 0%, rgba(0, 229, 255, 0.05) 100%), var(--card-bg)'
      }
    } else {
      if (enrollmentPromptBox) enrollmentPromptBox.style.display = 'block'
      if (enrollmentSavedBox) enrollmentSavedBox.style.display = 'none'
      if (voiceEnrollmentBadge) {
        voiceEnrollmentBadge.textContent = '⚠️ SAVE YOUR VOICE'
        voiceEnrollmentBadge.style.color = '#ffb703'
      }
      if (voiceEnrollmentCard) {
        voiceEnrollmentCard.style.borderColor = 'rgba(255, 183, 3, 0.4)'
        voiceEnrollmentCard.style.background = 'linear-gradient(135deg, rgba(255, 183, 3, 0.08) 0%, rgba(255, 51, 102, 0.05) 100%), var(--card-bg)'
      }
    }

    if (diarizerStatusTag) {
      const mode = va.getDiarizationMode()
      diarizerStatusTag.textContent = fp.isEnrolled
        ? (mode === 'strict' ? '🔒 Primary Voice Locked (Strict Mode)' : '🛡️ Primary Voice (Adaptive)')
        : '⚠️ Unenrolled (Save Voice First)'
      diarizerStatusTag.style.color = fp.isEnrolled ? 'var(--neon-green)' : '#ffb703'
    }

    if (activeSpeakerNameBadge && activeDiar) {
      if (activeDiar.isWearer) {
        activeSpeakerNameBadge.textContent = `🟢 ${activeDiar.speakerLabel} • ${Math.round(activeDiar.confidence * 100)}% Match`
        activeSpeakerNameBadge.style.color = 'var(--neon-green)'
      } else {
        activeSpeakerNameBadge.textContent = `⛔ ${activeDiar.speakerLabel} • REJECTED`
        activeSpeakerNameBadge.style.color = '#ff5555'
      }
    }

    if (reading) {
      if (metricPitch) metricPitch.textContent = `${reading.pitchHz} Hz`
      if (metricIsolation) {
        metricIsolation.textContent = reading.isUserVoice
          ? `Wearer Verified (${Math.round(reading.userVoiceConfidence * 100)}%)`
          : 'Ambient Speaker Filtered'
        metricIsolation.style.color = reading.isUserVoice ? 'var(--neon-green)' : '#ff5555'
      }
    }

    // 4. Render Ambient Transcripts Feed with Speaker Diarization Badges
    const feedEl = document.getElementById('transcriptFeed')
    if (feedEl) {
      const txs = s.recentTranscripts || []
      if (txs.length === 0) {
        feedEl.innerHTML = '<div style="color: #666; font-size: 0.8rem; padding: 12px; text-align: center;">No wearer speech recorded yet. Speak naturally into your glasses or microphone...</div>'
      } else {
        feedEl.innerHTML = txs.map(t => {
          const time = new Date(t.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
          const emoBadge = getEmotionEmoji(t.primaryEmotion)
          const isWearer = t.isWearerVoice !== false
          const speakerLabel = t.speakerLabel || (isWearer ? 'You (Wearer)' : 'Speaker 2 (Ambient)')
          const badgeStyle = isWearer 
            ? 'background: rgba(0, 255, 170, 0.12); color: var(--neon-green); border: 1px solid rgba(0, 255, 170, 0.35);'
            : 'background: rgba(255, 75, 75, 0.15); color: #ff6b6b; border: 1px solid rgba(255, 75, 75, 0.35);'

          return `
            <div style="background: ${isWearer ? 'rgba(255,255,255,0.025)' : 'rgba(255,60,60,0.04)'}; border: 1px solid ${isWearer ? 'rgba(255,255,255,0.07)' : 'rgba(255,75,75,0.2)'}; border-radius: 8px; padding: 10px; display: flex; justify-content: space-between; align-items: center; gap: 10px;">
              <div style="flex: 1;">
                <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px; flex-wrap: wrap;">
                  <span style="font-family: monospace; font-size: 0.72rem; color: var(--text-dim);">${time}</span>
                  <span style="font-size: 0.7rem; padding: 2px 7px; border-radius: 4px; font-weight: 700; ${badgeStyle}">
                    ${isWearer ? '🟢' : '⛔'} ${speakerLabel} (${Math.round((t.wearerConfidence || 0.92) * 100)}%)
                  </span>
                  ${!isWearer ? '<span style="font-size: 0.7rem; color: #ff7777; font-weight: 600;">[Diarizer: Filtered • 0 Pts]</span>' : ''}
                </div>
                <div style="font-size: 0.9rem; color: ${isWearer ? '#fff' : '#94a3b8'}; font-weight: 500;">"${t.text}"</div>
                <div style="font-size: 0.72rem; color: var(--text-dim); margin-top: 4px;">
                  Joy: ${Math.round(t.emotionScores.joy * 100)}% • Calm: ${Math.round(t.emotionScores.calm * 100)}% • Tension: ${Math.round(t.emotionScores.frustration * 100)}% • Worry: ${Math.round(t.emotionScores.anxiety * 100)}%
                </div>
              </div>
              <div style="text-align: right;">
                ${isWearer ? `
                  <span style="font-size: 0.82rem; font-weight: 700; padding: 4px 8px; border-radius: 6px; background: rgba(0, 229, 255, 0.12); color: var(--neon-cyan); border: 1px solid rgba(0, 229, 255, 0.3);">
                    ${emoBadge} (${Math.round(t.confidence * 100)}%)
                  </span>
                ` : `
                  <span style="font-size: 0.75rem; font-weight: 600; padding: 3px 6px; border-radius: 4px; background: rgba(255,255,255,0.05); color: #888;">
                    0 Pts (Ignored)
                  </span>
                `}
              </div>
            </div>
          `
        }).join('')
      }
    }

    renderQuests()
    updateMirror()
  }

  // Button Listeners: Test as Wearer
  document.getElementById('btnTestPhrase')?.addEventListener('click', () => {
    const input = document.getElementById('inputDemoPhrase') as HTMLInputElement | null
    if (!input || !input.value.trim()) return
    const text = input.value.trim()
    input.value = ''

    const va = app.getVoiceAnalyzer()
    const textAnalysis = (va as any).analyzeTextEmotions ? (va as any).analyzeTextEmotions(text) : { primary: 'joy' as const, scores: { joy: 0.8, calm: 0.3, anxiety: 0.1, sadness: 0.0, frustration: 0.0, curiosity: 0.2 } }
    
    const fp = va.getFingerprint()
    const wearerPitch = fp.isEnrolled ? fp.medianPitchHz : 168

    const record = {
      id: `tx_${Date.now()}`,
      text,
      timestamp: Date.now(),
      primaryEmotion: textAnalysis.primary,
      confidence: 0.94,
      emotionScores: textAnalysis.scores,
      pitchHz: wearerPitch,
      isWearerVoice: true,
      wearerConfidence: 0.98,
      speakerId: 'speaker_wearer',
      speakerLabel: 'You (Primary Saved Voice)',
      diarizationConfidence: 0.98,
    }

    const cur = state.get()
    state.update({
      recentTranscripts: [record, ...cur.recentTranscripts].slice(0, 15),
      lastTranscribedText: text,
      coachMessage: `"${text.slice(0, 35)}..." (${getEmotionEmoji(record.primaryEmotion)})`,
    })

    petManager.applyVoiceEmotion({
      primary: record.primaryEmotion,
      confidence: 0.94,
      scores: record.emotionScores,
      pitchHz: wearerPitch,
      energyRms: 0.08,
      tempoBpm: 120,
      timestamp: Date.now(),
      isUserVoice: true,
      userVoiceConfidence: 0.98,
      speakerId: 'speaker_wearer',
      speakerLabel: 'You (Primary Saved Voice)',
      diarizationConfidence: 0.98,
    })

    app.renderHudScreen()
    updateUI()
  })

  // Test as Other Person (Ambient Speaker Diarization Rejection)
  document.getElementById('btnTestExternalSpeaker')?.addEventListener('click', () => {
    const input = document.getElementById('inputDemoPhrase') as HTMLInputElement | null
    const text = input && input.value.trim() ? input.value.trim() : 'Hey, did you see the score of the game?'
    if (input) input.value = ''

    const va = app.getVoiceAnalyzer()
    const fp = va.getFingerprint()
    const wearerPitch = fp.isEnrolled ? fp.medianPitchHz : 168
    // Generate pitch distinct from user's saved voice (e.g. +70 Hz or -60 Hz)
    const externalPitch = wearerPitch > 185 ? Math.max(95, wearerPitch - 75) : wearerPitch + 80
    const textAnalysis = (va as any).analyzeTextEmotions ? (va as any).analyzeTextEmotions(text) : { primary: 'curiosity' as const, scores: { joy: 0.1, calm: 0.2, anxiety: 0.1, sadness: 0.1, frustration: 0.1, curiosity: 0.7 } }

    const record = {
      id: `tx_${Date.now()}`,
      text,
      timestamp: Date.now(),
      primaryEmotion: textAnalysis.primary,
      confidence: 0.88,
      emotionScores: textAnalysis.scores,
      pitchHz: externalPitch, // Deliberately outside wearer profile
      isWearerVoice: false, // EXTERNAL SPEAKER!
      wearerConfidence: 0.15,
      speakerId: 'speaker_ambient_1',
      speakerLabel: externalPitch > wearerPitch ? 'Speaker 2 (Higher Pitch External - Ignored)' : 'Speaker 2 (Deeper Pitch External - Ignored)',
      diarizationConfidence: 0.95,
    }

    const cur = state.get()
    state.update({
      recentTranscripts: [record, ...cur.recentTranscripts].slice(0, 15),
      lastTranscribedText: `[Filtered: Speaker 2] "${text}"`,
      coachMessage: '🛡️ Diarizer: Filtered out Speaker 2 (No emotion points added)',
    })

    // Intentionally DO NOT call petManager.applyVoiceEmotion!
    app.renderHudScreen()
    updateUI()
  })

  // 1-Click Lock My Voice
  document.getElementById('btnLockMyVoice')?.addEventListener('click', () => {
    const va = app.getVoiceAnalyzer()
    const reading = state.get().lastReading
    va.quickLockWearerVoice(reading?.pitchHz, reading ? 1200 : undefined)
    const btn = document.getElementById('btnLockMyVoice')
    if (btn) {
      btn.textContent = '✓ Voice Locked!'
      setTimeout(() => { if (btn) btn.textContent = '🎯 1-Click Lock My Voice' }, 2000)
    }
    updateUI()
  })

  // Toggle adaptive vs strict vs permissive diarization
  document.getElementById('btnToggleDiarizeMode')?.addEventListener('click', () => {
    const va = app.getVoiceAnalyzer()
    const curMode = va.getDiarizationMode()
    const nextMode = curMode === 'adaptive' ? 'strict' : (curMode === 'strict' ? 'permissive' : 'adaptive')
    va.setDiarizationMode(nextMode)
    const btn = document.getElementById('btnToggleDiarizeMode')
    if (btn) {
      if (nextMode === 'adaptive') btn.textContent = '🛡️ Mode: Adaptive (Balanced)'
      else if (nextMode === 'strict') btn.textContent = '🛡️ Mode: Strict (Tighter)'
      else btn.textContent = '🛡️ Mode: Permissive (Hall/Demo)'
    }
    updateUI()
  })

  // Start Guided Voice Enrollment (Save My Voice 4s)
  document.getElementById('btnStartEnrollment')?.addEventListener('click', async () => {
    const btn = document.getElementById('btnStartEnrollment') as HTMLButtonElement | null
    const statusText = document.getElementById('enrollmentStatusText')
    if (btn) btn.disabled = true

    try {
      const va = app.getVoiceAnalyzer()
      await va.enrollVoice(4, (secRemaining, currentPitch) => {
        const pitchTag = currentPitch ? ` • Pitch: ${currentPitch} Hz` : ''
        if (btn) btn.textContent = `🎙️ Listening... ${secRemaining}s remaining`
        if (statusText) statusText.textContent = `Speak naturally... ${secRemaining}s${pitchTag}`
      })
      const fp = va.getFingerprint()
      if (statusText) statusText.textContent = `✓ Voice Profile Saved! (${fp.medianPitchHz} Hz Locked)`
    } catch (err) {
      console.error('[Enrollment] Error:', err)
      if (statusText) statusText.textContent = 'Could not record mic. Please verify mic permissions.'
    } finally {
      if (btn) {
        btn.disabled = false
        btn.textContent = '🔴 Record & Save My Voice (4s)'
      }
      app.renderHudScreen()
      updateUI()
    }
  })

  // 1-Click Lock Current Voice from Prompt Box
  document.getElementById('btnQuickLockVoicePrompt')?.addEventListener('click', () => {
    const va = app.getVoiceAnalyzer()
    const reading = state.get().lastReading
    const fp = va.quickLockWearerVoice(reading?.pitchHz, reading ? 1200 : undefined)
    const statusText = document.getElementById('enrollmentStatusText')
    if (statusText) statusText.textContent = `✓ Voice Profile Saved (${fp.medianPitchHz} Hz Locked)!`
    app.renderHudScreen()
    updateUI()
  })

  // Enable / Restart Mic button listener
  document.getElementById('btnToggleLiveMic')?.addEventListener('click', async () => {
    const va = app.getVoiceAnalyzer()
    const btn = document.getElementById('btnToggleLiveMic') as HTMLButtonElement | null
    const statusText = document.getElementById('enrollmentStatusText')
    if (btn) btn.textContent = '⏳ Starting Mic...'
    await va.stopListening()
    const ok = await va.startListening()
    if (btn) {
      btn.textContent = ok ? '✓ Mic Active & Listening' : '❌ Mic Permission Denied'
      setTimeout(() => { if (btn) btn.textContent = '🎙️ Enable / Restart Mic' }, 3000)
    }
    if (statusText) {
      statusText.textContent = ok ? '✓ Microphone listening! Speak aloud.' : 'Could not access mic. Check browser permissions.'
    }
    updateUI()
  })

  // Quick Re-lock Current Voice from Saved Box
  document.getElementById('btnQuickReLockVoice')?.addEventListener('click', () => {
    const va = app.getVoiceAnalyzer()
    const reading = state.get().lastReading
    va.quickLockWearerVoice(reading?.pitchHz, reading ? 1200 : undefined)
    app.renderHudScreen()
    updateUI()
  })

  // Re-enroll Voice Button
  document.getElementById('btnReEnrollVoice')?.addEventListener('click', () => {
    const promptBox = document.getElementById('enrollmentPromptBox')
    const savedBox = document.getElementById('enrollmentSavedBox')
    if (promptBox) promptBox.style.display = 'block'
    if (savedBox) savedBox.style.display = 'none'
  })

  // Clear Saved Voice Button
  document.getElementById('btnClearVoice')?.addEventListener('click', () => {
    app.getVoiceAnalyzer().clearEnrolledVoice()
    app.renderHudScreen()
    updateUI()
  })

  document.getElementById('btnConnectGlasses')?.addEventListener('click', async () => {
    const btn = document.getElementById('btnConnectGlasses') as HTMLButtonElement | null
    const bannerText = document.getElementById('g2StatusText')
    if (btn) btn.textContent = '⏳ Connecting...'
    if (bannerText) bannerText.innerHTML = `👓 Hardware Link: <strong style="color: var(--neon-amber);">Acquiring BLE Bridge...</strong>`

    const res = await app.reconnectGlasses()
    if (btn) btn.textContent = res.success ? '✓ Sent to G2 Lens!' : '⚠️ Simulator Mode'
    if (bannerText) {
      bannerText.innerHTML = res.success
        ? `👓 Hardware Link: <strong style="color: var(--neon-green);">Streaming to G2 Optical Waveguide (BLE Active)</strong>`
        : `👓 Hardware Link: <strong style="color: var(--neon-amber);">${res.message}</strong>`
    }
    setTimeout(() => {
      if (btn) btn.textContent = '👓 Send HUD to Glasses Lens'
    }, 3500)
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

  // Sideload QR Modal listeners
  document.getElementById('btnShowQrModal')?.addEventListener('click', () => {
    const modal = document.getElementById('qrModalOverlay')
    if (modal) modal.style.display = 'flex'
  })

  document.getElementById('btnCloseQrModal')?.addEventListener('click', () => {
    const modal = document.getElementById('qrModalOverlay')
    if (modal) modal.style.display = 'none'
  })

  document.getElementById('qrModalOverlay')?.addEventListener('click', (e) => {
    if (e.target === document.getElementById('qrModalOverlay')) {
      const modal = document.getElementById('qrModalOverlay')
      if (modal) modal.style.display = 'none'
    }
  })

  // Listen to state changes
  state.onChange(() => updateUI())

  // Initial draw
  updateUI()
}
