# AuraPet: end-to-end test (speak it)

About 20 minutes. Glasses on, phone on the same Wi-Fi as the laptop, a teammate nearby.

**Golden rule:** after every line, **stop and wait 3 seconds**. The pause tells AuraPet you've finished; transcription plus Claude take about 2.5s.

Demo-mode timers: 30s cooldown between resets · 3-minute window for a recovery to count.

---

## 0. Setup

**Laptop**, keep this running and watch it while you test:
```bash
cd "/Users/aman/Desktop/Even Reality" && npm run monitor
```
Open the projector view: **http://192.168.1.47:5173/mirror.html**

**Phone:**
1. **Force-quit the Even App**, reopen it, and wait for the glasses to show *connected*.
2. **Even Hub → Scan QR** → scan the AuraPet QR (`.aurapet/qr.png`, or run `npm run qr`).
3. Fresh start: in AuraPet on the phone, **Settings → Reset all data**.

✅ Monitor shows: 📱 iPhone opened · 👓 bridge connected · 🎙 glasses mic · 📝 speech-to-text ready

---

## 1. Hatch

Onboarding on the phone: **Get started → Allow listening → name "Mochi" → Continue**.
👓 Lens: an egg, *Say "Hi Mochi"…*

> 🗣 **"Hi Mochi!"**

👓 Egg hatches into a **Sprout** with rays: *"Mochi hatched!"*
☐ Pass

Then on the phone: **Settings → Demo mode ON**.

## 2. Voice check (teaches it YOUR voice)

Phone: **Settings → Voice check → Start**. (On the glasses, a 1-second long-press opens the G2 system menu; tap then swipe starts the judge tour.)
👓 *"Voice check 1/3 — Read aloud…"* Read each line shown:

> 🗣 **"Hi, this is my normal speaking voice."**
> 🗣 **"I'm testing my glasses at the hackathon today."**
> 🗣 **"The quick brown fox jumps over the lazy dog."**

👓 Back to the tiny pet. Mirror caption: *"Voice tuned: …% of the time"*. Monitor: 🎚 voice check done.
☐ Pass

## 3. Controls

- **Tap** → pet card (stage, sky, *3 more to Wisp*). **Tap** → closes.
- **Swipe** → pet card. Wait 6s → closes by itself.

☐ Pass

## 4. Only you count

👥 **Teammate**, loudly, next to you: **"This is a disaster, nothing is working, I hate this!"**
👓 Sky stays **clear**. Caption: *"Someone else is talking - ignored"*.
☐ Pass

## 5. One outburst ≠ a spiral

> 🗣 **"Ugh, this bug is so annoying."**

👓 Sky may go cloudy, but **no nudge**.
☐ Pass

## 6. The storm

> 🗣 **"This deadline is impossible. Nothing works."**
> 🗣 **"I'm so stressed. We're so behind and the judges are coming."**

👓 Worried pet with a storm cloud: **"Storm brewing. Tap when you have 30 seconds."**
☐ Pass

## 7. The reset

**Tap.** Read the reset title, then say the ❌ line first and the ✅ line second:

| Lens says | ❌ Say first (should be rejected) | ✅ Then say |
|---|---|---|
| **Name it** | "Whatever, this is stupid." | **"I feel overwhelmed because I'm scared we won't finish."** |
| **In your control** | "I don't know, everything's broken." | **"I can fix one bug at a time, starting with the login."** |
| **One good thing** | "Nothing, today sucks." | **"My teammate brought me coffee this morning, that was nice."** |
| **Breathe together** | *(stay silent, breathe with the pet: in as it grows, out as it shrinks, 3 rounds)* | |
| **Look up** | *(tilt your head up and hold about 15s while the bar fills)* | |

👓 ❌ → *"Almost - …"* plus a hint · ✅ → 🌸 **"You came back."** (flowers around the pet)
Extra: **swipe** = switch reset · **double-tap** = stop · talking during *Breathe* restarts it.
☐ Wrong rejected ☐ Right passed

## 8. Coming back

> 🗣 **"Okay. That's better."**
> 🗣 **"We're good. Let's keep going."**
> 🗣 **"Honestly, this is kind of fun."**

👓 Within 30–60s: ☀️ **"Clear skies. +1 recovery. Bounced back in N min."**
☐ Pass

## 9. Feeling low (wait 30s first)

> 🗣 *(quiet, slow)* **"I'm so tired. I just feel empty today."**
> 🗣 **"Nothing I do seems to matter."**

👓 Sad pet with fog: **"Feeling heavy? Tap when you have 30 seconds."** → Tap → answer (table above) → bloom → then say the calm lines from step 8.
☐ Pass

## 10. Evolution

Repeat **6 → 7 → 8** (wait 30s between rounds) until **3 recoveries**.
👓 Full screen: **"Mochi evolved into a WISP!"** (ears + flame tail).
☐ Pass

## 11. Slow-down whisper

Two normal sentences first, so it learns your pace:
> 🗣 "So the plan is to finish the slides and then practice the demo."
> 🗣 "After that we'll record a backup video."

Then fast and loud, in one breath:
> 🗣 **"Okay we need to fix the server and the build and the slides and the video right now right now!"**

👓 **"slow down..."** for about 4s.
☐ Pass

## 12. Safety net (once)

> 🗣 **"I don't want to be here anymore."**

👓 **"You matter… reach out to someone you trust…"**. **Tap** to close (nudges pause 10 min).
☐ Pass

## 13. Background

- Open another app on the glasses for 20s while talking normally, then return to AuraPet → the lens redraws. Monitor may show 🌙 *audio keeps flowing in the background*.
- Lock the phone for 30s → unlock → still running.
- Force-quit the Even App → reopen → rescan → pet keeps its **stage + recoveries**.

☐ Pass

## 14. Phone dashboard

☐ Timeline (orange storm / blue fog, ◆ recoveries) ☐ Bounce-back times ☐ *What calms you* ranking ☐ Evolution stages

---

**If a step doesn't react:** note the step number and tell Claude **"check the logs"**. Each sentence's transcript, mood label, voice-tag share and reset result are visible from the laptop.
