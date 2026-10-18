# AuraPet — Product Spec (LA Hacks 2026, Even Realities track)

## 1. One-line pitch

**AuraPet notices when a conversation is winding you up, and helps you come back down before the bad mood takes over your day. It lives quietly in your G2 lenses as a small creature that grows every time you recover.**

> "We don't reward you for being happy. We reward you for coming back."

## 2. The problem

When you're stressed and talking to someone, the stress feeds on itself. You talk faster, get louder, and say tense things, which makes you more stressed. Most people don't notice they're in this loop until it's over. Wellness apps on your phone can't help in that moment, because nobody pulls out their phone in the middle of an argument or a stressful standup.

Smart glasses can help. They're already on your face, they hear what you say, and they can show you something without anyone else seeing it.

## 3. Product principles

1. **Stay quiet by default.** The lenses are empty or close to empty most of the time. AuraPet only speaks up when it matters.
2. **Recovery is the goal, not happiness.** Feeling bad is never punished and never farmed for points. Coming back from it is what gets rewarded.
3. **Rewards must be earned.** Nothing finishes on a tap. Every reset is confirmed by your voice or your head movement.
4. **Only your voice counts.** Other people's speech is ignored, and raw audio and transcripts never leave the session.
5. **Built for the glasses.** It uses the glasses mic (with its Self/Other speaker tag), the IMU, the touchpad and the image containers. It is not a phone app copied onto a lens.

## 4. The end-to-end flow

```
 ONBOARD ──► AMBIENT ──► DETECT ──► NUDGE ──► RESET ──► VERIFY ──► GROW ──► REFLECT
 (phone,     (lenses     (mood      (pet       (one     (voice/   (pet      (phone,
  60s)        quiet)      engine)    worried)   action)  IMU)      blooms)   end of day)
                ▲                                           │
                └──────────── back to ambient ◄─────────────┘
```

### Step 0: Onboarding (phone, about 60 seconds, once)
1. Welcome: "AuraPet helps you bounce back from stressful moments."
2. Privacy: "Only your voice is analyzed. Audio and words are never stored, only mood labels." The user taps Allow to grant mic access.
3. Voice check: read one sentence aloud. This confirms the glasses mic picks you up as `Self` and saves your baseline pitch and energy for prosody.
4. Hatch: an egg appears on the lenses, and it hatches when you say its name out loud. That teaches the user, in the first minute, that **your voice is the controller**.

### Step 1: Ambient mode (most of the day)
- **Lenses:** a tiny pet glyph in the corner at low brightness plus a one-word "weather" (`clear` / `cloudy` / `stormy`). That's all.
- Tap the temple to show the pet card for 5 seconds. Double-tap to exit.
- AuraPet listens in the background (see §7). Only utterances tagged `speakerRole === Self` are processed.

### Step 2: Detect, with a mood engine instead of frame-by-frame reactions
- Audio is split into **utterances** (stretches of speech that end with a pause), not 60 fps frames.
- For each utterance:
  1. Transcribe it (speech-to-text).
  2. Pull prosody features: pitch relative to your baseline, energy, speech rate.
  3. An LLM classifies it from the text plus a summary of those features into one of three **weather states**:
     - **Storm**: anxious or frustrated (high arousal, negative)
     - **Fog**: sad, tired or flat (low arousal, negative)
     - **Clear**: calm, happy or engaged
- A rolling **stress score** (exponential average over about the last 2 minutes of your speech) drives the pet's weather.
- **Trigger rule:** stress score above 0.65 for at least 2 utterances within 90 seconds, and no reset in the last 10 minutes. One stressed sentence isn't enough to trigger; a sustained spiral is.

### Step 3: Nudge
- The pet's art changes (a storm cloud appears and the pet looks worried), and one line shows up:
  `Storm brewing. Tap when you have 30s.`
- **The user decides when.** You may be mid-conversation, so the nudge waits. It fades after 60 seconds and stays available from the pet card.
- Swipe to dismiss for good ("not now"). That's never penalized.

### Step 4: The reset (one action, picked for the weather)
Every reset can be done in 30–60 seconds without looking at a phone, and **each one is confirmed by the hardware**:

| Weather | Reset | What the user does | How we verify it |
|---|---|---|---|
| Storm | **Name it** (affect labeling¹) | Say in one sentence what you're feeling | STT plus a quick LLM check: did they name an emotion? |
| Storm | **Slow breath ×3** | Breathe with the guided bar on the lens | No `Self` speech for about 25s, head still (IMU), then the next utterance is calmer |
| Fog | **One good thing** | Say one thing that went OK today | STT plus an LLM check that it's a genuine positive |
| Fog | **Look up** | Lift your gaze to the horizon for 20s | IMU pitch angle above the threshold for 20s |
| Either | **What's in my control?** | Say one thing you can actually do next | STT plus an LLM check for an actionable statement |

¹ Affect labeling ("name it to tame it") has research behind it. Lieberman et al. (2007) found it reduces amygdala response. Worth one slide in the pitch.

**Tap never completes a reset.** Tap opens it, swipe skips it.

### Step 5: Verify, then the Bloom
- When the reset is verified, the pet turns its storm into a **bloom**. The lens art changes and the line reads `You came back. +1 Bloom`.
- **Recovery is confirmed later:** if your stress score drops below 0.4 within 10 minutes, the reset counts as a **full recovery** and the pet grows.
- Each recovery logs a **bounce-back time**: minutes from the stress spike to back below 0.4.

### Step 6: Grow
- The pet evolves on **recoveries**, not on how much you talk:
  - Sprout (0) → Wisp (3 recoveries) → Guardian (8) → Zenith (15)
- Joy and calm moments add small **sunlight** that changes the pet's look (it glows), but they don't speed up evolution. That way happy moments get bigger and more visible without turning into something to farm.

### Step 7: Reflect (phone, end of day, the "aha" screen)
- **Today's inner weather:** a timeline of the day with storms marked and the recoveries that followed.
- **Bounce-back time trend:** "Monday: 14 min to recover. Today: 4 min."
- Pet gallery and evolution progress.

### The end goal, defined
- **For the user (meaningful):** a shorter bounce-back time. You get better at coming back.
- **In the game (visible):** evolve your pet to **Zenith** through 15 real recoveries.
- **For the demo:** show a full storm → reset → recovery → evolution loop live on stage.

## 5. What to cut, keep and change from the current build

| Area | Decision | Why |
|---|---|---|
| Breeding Lab, eggs, Essence, Serenidrake | **Cut** | A second game loop that doesn't serve the mission. Judges can't explain it back to you. |
| Multiple pets / inventory | **Cut** | One pet, one relationship. |
| Hunger, happiness % | **Cut** | Tamagotchi guilt mechanics. Bad fit for a wellness product. |
| 6 emotion point banks + "Equilibrium ≥80%" | **Cut** | The current win condition (`petManager.ts:115`) needs *at least 60 anxiety, sadness and frustration points*, so you literally have to be upset more to win. That directly contradicts the mission. |
| Points for every emotion | **Change** | Feelings are acknowledged (the pet's weather shows them) but never scored. Recoveries are scored. |
| 6 emotions | **Change → 3 weather states** | Readable on a 576×288 mono display at a glance, and much more accurate to classify. |
| Wellness quests (tap to complete, up to 6 queued) | **Change → resets** | One at a time, only when triggered, with a 10-min cooldown, verified by voice or IMU. |
| AI coach line every 12s | **Cut** | Noise on the lens. The LLM is used for classification and verification instead. |
| Pitch Hz, XP numbers, diarizer labels on the HUD | **Move to phone debug view** | Keep them for judges in a "how it works" panel, but not on the lens. |
| Tap-to-pet | **Keep (tiny delight)** | The pet reacts, no points. |
| Voice fingerprint calibration | **Simplify** | The glasses already tag `AudioSpeakerRole.Self/Other`. Keep the pitch baseline only for prosody, and the custom diarizer only as a fallback for the phone mic. |
| ASCII art | **Upgrade → image containers** | The SDK supports greyscale `updateImageRawData`. Four stages × three weathers of real pixel art will look far better on stage. |
| Hard-coded seed points and fake transcripts | **Cut** | Start honest at zero. |

## 6. Bugs in the current build that matter for the new design

1. **XP/points awarded at 60×/sec.** `voiceAnalyzer.ts:211-219` runs `processAudioFrame` on every `requestAnimationFrame`. Each voiced frame fires `onEmotion`, and `app.ts:245` adds +3 points and +4 XP each time, so the pet levels on noise.
2. **Double counting.** Transcripts call `applyVoiceEmotion` again (`app.ts:319`) on top of the per-frame calls.
3. **"Emotional Alchemy" fires on frame flicker** (`petManager.ts:159`): any negative → positive frame transition gives +25 XP.
4. **Quests complete on tap** (`app.ts:167-182`) with no verification.
5. **Transcription uses the phone mic through Web Speech API** (`voiceAnalyzer.ts:117-118, 815+`), not the glasses audio. It's also unclear whether `webkitSpeechRecognition` exists inside the Even App WebView at all. **Needs a device test.** The fix is to send glasses PCM utterances to server-side STT.
6. **Unenrolled means everyone is the wearer** (`voiceAnalyzer.ts:337-345`). The glasses' `speakerRole` should gate this instead.
7. **No persistence.** A reload resets the pet. Use `bridge.setLocalStorage`.
8. **Every non-pet HUD update does a full `rebuildPageContainer`**, which causes flicker. Use `textContainerUpgrade` and `updateImageRawData` for in-place updates.

## 7. Background running: what's realistic

Even Hub apps are WebViews inside the Even App. Only one app owns the lens at a time.

**Recommended approach: "ambient foreground."** AuraPet stays the active glasses app but shows almost nothing (corner glyph, low brightness). To the user this *feels* like a background app, because the lens is clear until it matters. This is fully under our control and is also the right UX.

What the SDK gives us to support this:
- `FOREGROUND_EXIT_EVENT` / `FOREGROUND_ENTER_EVENT`: pause and resume cleanly, and save state on exit.
- `ABNORMAL_EXIT_EVENT` / `SYSTEM_EXIT_EVENT`: save state.
- `bridge.setLocalStorage`: pet, recoveries and baseline survive restarts.
- Launch source (`glassesMenu` / `appMenu`): resume straight into ambient mode.

**Must test on device (first hour of hacking):**
- [ ] After `FOREGROUND_EXIT_EVENT`, do audio events still arrive? If yes, we get true background listening and can surface a nudge when the user comes back.
- [ ] With the phone locked or the Even App backgrounded, does the WebView keep running JS? (iOS may suspend it.) For the demo, keep the phone unlocked on the table.
- [ ] Does `webkitSpeechRecognition` exist in the Even App WebView? (Decides whether we need server STT immediately.)

## 8. Architecture (target)

```
G2 glasses mic ──PCM + speakerRole──► Phone WebView (Even App)
G2 IMU ─────────────────────────────►   • VAD / utterance segmenter (drop non-Self)
G2 touchpad ────────────────────────►   • Prosody features per utterance
                                        • Mood engine (EMA, hysteresis, cooldown)
                                        • Reset state machine + verifiers
                                        • HUD renderer (image + text, in-place updates)
                                        • Persistence (bridge.setLocalStorage)
                                              │ utterance WAV + features
                                              ▼
                                        Backend (Express)
                                        • STT (Groq Whisper, fast)
                                        • LLM: classify weather / verify reset
                                        • Returns labels only; nothing stored
```

**Reset state machine:** `idle → nudged → active(reset) → verifying → bloomed → watching_recovery(10m) → recovered | expired → idle`

## 9. Glasses screens (all of them)

| Screen | When | Content |
|---|---|---|
| Ambient | Default | Corner pet glyph + weather word, low brightness |
| Pet card | Tap from ambient (5s) | Pet art (large), stage, recoveries toward next stage |
| Nudge | Trigger fires | Worried pet + "Storm brewing. Tap when you have 30s." |
| Reset | Tap on nudge | One instruction + live progress (breath bar / "listening…") |
| Bloom | Verified | Bloom animation + "You came back." |
| Evolution | Stage up | Full-screen evolution moment (this is the demo money shot) |

There are no menus to scroll through, and every screen can be read in under a second.

## 10. Demo script (3 minutes)

1. **(20s) Hook.** "Ever had a conversation make your day worse? You don't notice the spiral until it's too late."
2. **(30s) Ambient.** Show the lens: almost nothing there. "AuraPet stays out of your way."
3. **(40s) Storm.** A teammate plays the stressed coworker. The presenter vents: "This deadline is impossible, nothing works, I'm so behind." The pet's weather turns stormy and a nudge appears on the lens (mirrored on screen).
4. **(15s) Ignoring others.** The teammate talks angrily and nothing changes. "It only listens to me. The glasses tag my voice."
5. **(40s) Reset.** Tap, then "Name it": "I'm overwhelmed because I'm scared we won't finish." Verified, the storm becomes a bloom. Then, in a calmer voice: "OK, one thing I can do is cut the breeding feature." The weather clears.
6. **(20s) Grow.** The 3rd recovery triggers evolution to Wisp, full-screen on the lens.
7. **(15s) Reflect.** On the phone: the day's weather timeline and bounce-back trend. "We don't reward being happy. We reward coming back."

Pre-seed 2 recoveries before going on stage so the live one triggers evolution (and say so honestly if asked).

## 11. Build plan (priority order)

| # | Task | Must/Nice |
|---|---|---|
| 1 | Device tests from §7 | Must |
| 2 | Utterance segmenter on glasses PCM, gated on `speakerRole === Self` | Must |
| 3 | Backend `/utterance`: STT + LLM → `{weather, intensity}` | Must |
| 4 | Mood engine (EMA, trigger rule, cooldown); delete per-frame XP | Must |
| 5 | Reset state machine + 3 verifiers (Name it, One good thing, Look up via IMU) | Must |
| 6 | Recovery-based evolution + persistence | Must |
| 7 | Rewrite the HUD into the 6 screens above; delete breeding/quests/endgoal screens | Must |
| 8 | Phone: onboarding + weather timeline + bounce-back trend; delete breeding UI | Must |
| 9 | Pixel-art image containers (4 stages × 3 weathers) | Nice (big demo payoff) |
| 10 | Breath reset with IMU stillness | Nice |
| 11 | "How it works" debug panel on phone for judges | Nice |
