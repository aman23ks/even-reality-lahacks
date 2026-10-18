# AuraPet: bounce back, on your G2

> LA Hacks 2026 · Even Realities track

**AuraPet notices when a conversation is winding you up and helps you come back down before the mood takes over your day.** It lives quietly in your G2 lenses as a small creature that grows every time you recover.

> "We don't reward you for being happy. We reward you for coming back."

The full product spec is in [PRODUCT_SPEC.md](PRODUCT_SPEC.md).

## How it works

```
listen (your voice only) → notice a sustained spiral → nudge on the lens → one 30-second reset
→ verified by your voice / head / quiet breathing → bloom → mood actually clears → pet grows
```

| Piece | What it does |
|---|---|
| **Ambient lens** | A tiny pet in the corner and one word (`clear`, `cloudy`, `stormy` or `foggy`). The lens is otherwise empty. |
| **Speaker gate** | Uses the glasses mic's `speakerRole`. Other people's speech never counts. |
| **Mood engine** | Speech-to-text plus an LLM labels each utterance storm, fog or clear, feeding a rolling score. Two or more tense utterances plus a high score trigger a nudge. One outburst never does. |
| **Resets** | *Name it* · *In your control* · *One good thing* (voice-verified) · *Look up* (IMU-verified) · *Breathe together* (the pet grows and shrinks as a pacer; you have to stay quiet). Tapping never completes one. |
| **Recovery** | A reset only counts as a recovery when your mood actually clears afterwards. The bounce-back time is recorded. |
| **Evolution** | Egg → Sprout → Wisp (3) → Guardian (8) → Zenith (15 recoveries) |
| **Learns what calms you** | Offers the resets that have worked for you most often first. |
| **Post-conversation debrief** | When the glasses hear you *and* someone else, AuraPet holds every nudge (nobody talks to their glasses mid-argument). When everyone goes quiet and it got tense, it offers: *"That got tense. Tap when you're free for 30 seconds."* Calm conversations get nothing. |
| **Repair ("oops")** | Say something sharp *to someone* ("whatever, do it yourself") and the lens offers: *"That came out sharp. Repair it?"* Apologise within 45s and it counts as a bounce-back. Complaining about things never triggers it. |
| **Read the room** | When the person you're talking to sounds stressed, a private cue: *"They sound stressed. Maybe ask how they're doing."* Checking on them is noticed. Their words are never shown or stored, only their mood. |
| **Kindness feeds Mochi** | Thanking, praising or encouraging someone makes Mochi glow: *"+1 kindness (3 today)"*. |
| **Storm forecast** | Learns what your storms are about (topic tags only) and when they happen. On opening: *"'Deadline' keeps coming up in your storms."* At a risky hour: *"This hour often gets tense. One slow breath first?"* |
| **Judge mode** | A guided ~3-minute tour for first-time wearers that shows every feature once and ends at Zenith (3 bounce-backs): **1/4** vent about work → reset → calm; **2/4** thank someone (kindness); **3/4** snap jokingly → apologise (repair); **4/4** tense chat with a teammate (read the room, silent mid-conversation, debrief after). Zenith screen summarises storm topics (forecast) and what you did. Swipe skips a step; the phone shows a live checklist. On by default in the judging build. |
| **Slow-down whisper** | If you're talking much faster and louder than your usual, `slow down...` fades in on the lens. |
| **Safety pause** | If something you say sounds really heavy, the game pauses and gently suggests reaching out to someone you trust. |
| **Lens mirror** | `/mirror.html` shows exactly what the wearer sees, live, for the projector. |

Privacy: audio and transcripts are processed in memory and never stored. Only mood scores and counts are saved on the phone.

## Glasses controls

| Where | Tap | Swipe | Double tap |
|---|---|---|---|
| Ambient | Pet card (or start a waiting reset) | Pet card | Exit |
| Nudge | Start reset | Not now | Not now |
| Reset | — | Try a different reset | Stop |
| Bloom / evolution / support | Close | — | Close |

## Run it

```bash
npm install
cp .env.example .env      # add GROQ_API_KEY (or OPENAI_API_KEY) for speech-to-text + AI mood labels
npm run dev:all           # web app on :5173 + backend on :3001
npm run qr                # QR for the Even App (uses your current LAN IP)
```

1. On the phone, open the **Even App**, then **Even Hub**, then **Scan QR**. Force-quit the Even App first if older copies are open.
2. Run `npm run mirror` and open the printed URL on the projector or laptop.
3. Turn on **Demo mode** in the phone's settings for short timers (30s cooldown, 3-minute recovery window).

No glasses? Open `http://localhost:5173` in a browser and use **"Try it by typing"** to drive the same pipeline.

**Package for Even Hub:** set `VITE_API_URL` in `.env` to your laptop's LAN IP, then run `npm run package`.

## Install & run on G2 (testers / judges)

**Even Hub Beta (no setup):** install **AuraPet** from Even Hub on a phone paired with G2, and open it from the glasses menu. It talks to the hosted backend; testers need **no accounts or API keys**.

1. Phone: Even App → Even Hub → **AuraPet** → install the Beta build, then open it.
2. On the phone, follow the 4-step onboarding, then say **"Hi Mochi"** to hatch.
3. Optional: **long-press the temple** for the 3-sentence voice check (teaches it your voice).
4. Phone → Settings → **Demo mode** (short timers). **Demo shortcuts → "Next → Wisp"** lets the next real recovery trigger an evolution.
5. Vent two stressed sentences → *Storm brewing* → tap → answer the reset out loud → calm down → recovery.

Projector view of the wearer's lens: `https://<backend>/mirror.html`.

## Deploy for judging

The phone app ships inside the `.ehpk`; only the backend is hosted (it holds the API keys).

1. **Backend on Render:** render.com → **New → Blueprint** → this repo, branch `aurapet-v2` (uses `render.yaml`). Enter `ANTHROPIC_API_KEY`, `GROQ_API_KEY` and `APP_KEY` when asked. You get a URL like `https://aurapet.onrender.com`. Free instances sleep after 15 min idle (~60s to wake); switch the plan to **Starter** for judging day.
2. **Package:** `npm run package:prod -- https://aurapet.onrender.com`. This generates `PROD_APP_KEY` in `.env` (copy it into Render's `APP_KEY`), points `app.json`'s network whitelist at the URL, and writes `AuraPet.ehpk`.
3. **Upload:** hub.evenrealities.com → your app → upload `AuraPet.ehpk` as a **Beta** build.
4. **Watch it live:** `npm run monitor -- https://aurapet.onrender.com`

## Code map

```
src/platform/glasses.ts   bridge: input (temple + ring), audio, IMU, lifecycle, storage
src/audio/                mic selection (glasses → phone → browser), VAD/utterances, speech fallback
src/engine/aura.ts        the state machine: nudge → reset → verify → bloom → recovery → evolve
src/engine/mood.ts        rolling storm/fog scores, trigger + recovery rules
src/engine/resets.ts      reset catalog + "learns what calms you" picker
src/hud/                  lens screens, procedural pixel-art pet, renderer, mirror
src/phone/ui.ts           companion: onboarding, timeline, bounce-back, settings, diagnostics
server/index.ts           STT + LLM classify/verify (Groq/OpenAI, keyword fallback), mirror SSE
```

The pre-redesign version is preserved in `legacy_v1/`.
