## Inspiration

We've all had a conversation that ruined the rest of the day. A tense standup, a sharp comment from a teammate, a call that went sideways. In the moment you don't notice the spiral: you talk faster, get sharper, say something you regret, and carry it into every conversation after.

We wanted to build something that understands *your* voice: it learns your voiceprint and picks up the emotional patterns in how you speak. It's always running quietly in the background, but it only shows up when you need it: a reminder to be a little kinder or more compassionate, or a nudge to shift from an unpleasant moment to a better one, so the rest of your day goes better.

We also believe **kindness and composure are habits, not traits**. You build them one moment at a time: catching yourself, resetting, repairing. So we built a coach that helps you practise that habit, and a small companion that grows every time you do.

## What it does

**Compassion Coach** is a quiet companion on Even G2 that helps you shift your mood in tense moments and come back to center.

- **Listens to your voice only.** G2's speaker tagging plus a **voice fingerprint** (from a 3-sentence voice check) mean other people's speech never counts.
- **Stays silent during hard conversations.** When it hears you *and* someone else, every nudge is held, because nobody should talk to their glasses mid-argument.
- **Helps right after.** When the conversation ends and it got tense: *"That got tense. Tap when you're free for 30 seconds."* One spoken reset follows: name the feeling, say one thing in your control, or name one good thing. Each one is **verified by your voice**, never by a tap.
- **Catches the sharp moment.** Say something cutting *to someone* ("whatever, do it yourself") and the lens offers: *"That came out sharp. Repair it?"* Apologise and it counts.
- **Reads the room.** If the person you're talking to sounds stressed: *"They sound stressed. Maybe ask how they're doing."*
- **Rewards the habit, not the mood.** Your companion, Mochi, grows only when you actually recover: Sprout → Wisp → Guardian → **Zenith**. Kind words, repairs and checking on others earn badges and accessories Mochi wears on your lens. Calming down *on your own*, before any nudge, counts most.
- **Shows your patterns** on the phone: bounce-back time trend, what calms you, and what your storms are usually about (topic tags only, never words).
- **Judge mode:** a guided tour on the lens that shows every feature in about 3 minutes and ends at Zenith. Start it by saying *"start the tour"* or from the glasses menu.

Quiet by design: most of the time the lens shows nothing but a tiny companion. It appears only when it can help.

## How we built it

- **Even Hub SDK + TypeScript/Vite.** A single bridge layer handles temple and ring input, the glasses mic (with `speakerRole`), the IMU, lifecycle events, and the G2 long-press menu. The lens uses text containers plus a **procedurally drawn pixel-art pet**, quantised to G2's 4-level greyscale, with a single-flight renderer so animations never back up over BLE.
- **Audio pipeline on the phone:** voice-activity detection splits the stream into utterances. Each one is decided as wearer or other by **fusing the glasses' per-frame speaker tag with our voice fingerprint** (a 24-band mel-spaced spectral profile, pitch and spectral centroid, built with an FFT we wrote, and a self-calibrated match threshold).
- **Backend (Node/Express on Render):** Groq **Whisper large-v3-turbo** for speech-to-text, a fast Groq LLM for live mood labels (storm / fog / clear, plus harsh, repair, kindness and topic) in about 0.65s end to end, and **Claude Haiku** for judging whether a spoken reset actually satisfies the exercise. Audio and transcripts are processed in memory and never stored.
- **A mood engine** with a rolling, recency-weighted score, so one outburst never triggers a nudge but a sustained spiral does, plus conversation tracking to hold nudges and debrief afterwards.
- **A live lens mirror** (Server-Sent Events) so a projector shows exactly what the wearer sees, and a diagnostics feed we used to debug on real hardware.

## Challenges we ran into

- **The glasses mic wouldn't stream.** The SDK only streams audio after the first lens page exists, which we found in the docs after hours of silence.
- **Speaker tags flicker.** G2 tagged only about 30% of our own speech as "self", so we moved to per-utterance decisions and added a voice fingerprint, tested at 33/36 correct owner-vs-other decisions across six voices.
- **Latency.** Our first pipeline took 3–6 seconds per sentence. Benchmarking every model available to us got it to about 0.65s server-side and about 1.5s from the end of a sentence to the lens. (One "fast" model we benchmarked turned out to be returning quick *404s*. Lesson learned: check the answers, not just the timings.)
- **Lens lifecycle.** The host sometimes reported "background" while we were still on screen, which froze our renderer, so we learned to always draw and to rebuild pages on return.
- **Designing for quiet.** Our first version showed a pet all day and rewarded every emotion. We rebuilt around one idea: *reward coming back, not being happy*, and stay silent until it helps.

## Accomplishments that we're proud of

- An end-to-end experience running on real G2 hardware: own-voice detection, live mood, spoken resets verified by AI, and a pet that evolves on your lens.
- The **post-conversation debrief**: AI that knows when *not* to speak.
- A privacy-first design: no audio or transcripts stored, the other person's words never leave the server, and the voiceprint is numbers only.
- A deployed backend and an Even Hub Beta build that a judge can try without any setup.

## What we learned

- On glasses, **when** you show something matters more than **what** you show.
- Kindness can be designed for: catching a sharp remark and offering a repair changed how our own team talked during the hackathon.
- Hardware truth beats assumptions. Logging real device diagnostics from the first hour saved us repeatedly.

## What's next for Compassion Coach

- Tuning the voice fingerprint and mood thresholds on real users.
- Hands-free control with head nods (accept) and shakes (dismiss) using the G2 IMU.
- A weekly reflection: your bounce-back trend, kindest days, and recurring storm topics.
- A "graduation" mode where Mochi steps back as you need it less, because the real goal is building the habit.

## Try it

- **Even Hub app:** Compassion Coach (Beta)
- No accounts or API keys needed: open Compassion Coach from the G2 menu and say *"start the tour"*.
- Code and install guide: https://github.com/aman23ks/even-reality-lahacks/tree/aurapet-v2
