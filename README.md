# ✨ AuraPet G2 — VoidPet for Even Reality Smart Glasses
> **LA Hacks 2026** — Emotional wellness pet companion powered by continuous voice fingerprinting, vocal prosody emotion classification, and smart glasses heads-up display.

---

## 🌟 Concept & Vision

**AuraPet** turns everyday conversations into a mindful, gamified companion on your **Even Reality G2 Smart Glasses** (576×288 monochrome display):
1. **Continuous Voice Listening & Fingerprinting**:
   - Streams raw audio from the G2 glasses microphone (`bridge.audioControl(true, AudioInputSource.Glasses)`).
   - Calibrates your unique vocal fingerprint (pitch baseline $F_0$, variance, spectral centroid) so it **only reacts to YOUR voice** and ignores background noise or other people talking around you.
2. **Real-time Vocal Emotion Recognition**:
   - Detects emotional states from your natural speech: **Joy ☀️, Calm 💧, Anxiety 🌪️, Melancholy 🌙, Frustration ⚡, and Curiosity ✨**.
3. **VoidPet-Style Evolution & Leveling**:
   - Your companion pet (*Solispark*, *Lumidrop*, *Zephyr*, *Gloomwing*, *Pyre*) feeds on emotional presence.
   - Grows through stages: **Egg → Wisp → Juvenile → Ascended Guardian**.
4. **Actionable Wellness Quests ("Steps to get points & get happy")**:
   - Dynamically prescribes bite-sized micro-steps on your glasses HUD (e.g. *Box Breathing 4-7-8*, *Shoulder & Jaw Release*, *Gratitude Prompts*).
   - Completing micro-steps awards **XP**, boosts happiness, and synthesizes **Emotional Essence**.
5. **Elemental Breeding Lab**:
   - Fuse two emotional spirits (e.g. Joy + Calm) using Essence points to hatch legendary hybrid creatures like **Serenidrake**!

---

## 🕶️ G2 Glasses HUD Navigation (576×288 Mono Display)

| Gesture on G2 Temple | Action on HUD |
|---|---|
| **Single Tap** | **Pet companion** (+Happiness/cheer) / **Complete Quest** / **Hatch Egg** |
| **Swipe Forward** | Cycle screen forward: `Pet HUD` → `Wellness Quest` → `Breeding Lab` |
| **Swipe Backward** | Cycle screen backward: `Breeding Lab` → `Wellness Quest` → `Pet HUD` |
| **Double Tap** | Return to Pet HUD or trigger Even OS exit confirmation |

---

## 🏗️ Architecture

```
┌─────────────────────────────────┐
│     Even Reality G2 Glasses     │
│   • 576×288 Monochrome OLED     │
│   • Temple Touchpad Gestures    │
│   • Directional Microphone      │
└──────────────┬──────────────────┘
               │ Bluetooth Low Energy / Even SDK Bridge
               ▼
┌─────────────────────────────────┐
│  Phone WebView / Companion UI   │  (http://192.168.13.91:5173)
│   • Live G2 HUD Mirror          │
│   • Voice Isolation & Pitch F0  │
│   • VoidPet Status & Evolution  │
│   • Wellness Quests Checklist   │
│   • Breeding Sanctuary          │
└──────────────┬──────────────────┘
               │ HTTP / JSON API
               ▼
┌─────────────────────────────────┐
│  Express Backend Server         │  (http://192.168.13.91:3001)
│   • Voice Profile Store         │
│   • Emotion Prosody Engine      │
│   • AI Coach (OpenAI/Groq/Heur) │
│   • Essence & Breeding Sync     │
└─────────────────────────────────┘
```

---

## 🚀 Quick Start

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Environment (`.env`)
```bash
cp .env.example .env
# Ensure VITE_API_URL points to your laptop LAN IP (e.g., http://192.168.13.91:3001)
# Optional: Add OPENAI_API_KEY or GROQ_API_KEY for dynamic LLM coaching
```

### 3. Launch Frontend + Backend
```bash
npm run dev:all
```
- **Phone Companion Dashboard**: `http://localhost:5173` (or `http://192.168.13.91:5173`)
- **Backend API Server**: `http://localhost:3001`

### 4. Test on G2 Glasses
1. Open the **Even Realities** app on your phone.
2. Tap **Even Hub** tab → **Scan QR**.
3. Scan the QR code for `http://192.168.13.91:5173` (or run `npm run qr`).
4. Wear your glasses! Tap the temple to pet your companion, speak naturally, and watch it evolve!

### 5. Package App for Submission
```bash
npm run package
# Generates stamped `g2-app.ehpk` ready for Even Hub deployment
```
