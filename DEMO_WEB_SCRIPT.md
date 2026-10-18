# Compassion Coach (Compassion Coach): web simulator demo script

Record the browser at **http://localhost:5173**. The **"On your lens"** panel at the top is exactly what Even G2 shows. Everything below runs through the real pipeline (speech/text → AI mood → lens), typed into **Settings → "Try it by typing"**.

- Lines starting with **`them:`** play the other person in the conversation.
- **Pause after each line** until the lens updates (about 1–2s). Trim the waits when editing.
- Target length after editing: **about 3 minutes**.

---

## Before you hit record (2 min)
1. Open **http://localhost:5173**, then **Settings → Reset all data** → reload.
2. Turn on **Settings → Demo mode** (short timers).
3. Zoom the browser so the **lens panel** and the **"Try it by typing"** box are both easy to see. Rearrange or scroll between them as needed.
4. Start screen recording with **Cmd+Shift+5**, recording your voice for narration.

---

## Scene 1: The problem and the idea (0:00–0:20)
**Show:** the onboarding screen.
**Say:**
> "One tense conversation can ruin the rest of your day, and in the moment, you don't notice the spiral. Compassion Coach, called Compassion Coach on Even Hub, is a quiet companion on your Even G2 glasses. It listens to your voice, stays out of your way, and helps you come back to center when you need it."

## Scene 2: Onboarding and hatching (0:20–0:40)
**Do:** click **Get started → Allow listening** (privacy screen) **→** name it **Mochi → Continue → Type it instead**.
**Lens:** the egg hatches into a **Sprout**.
**Say:**
> "Setup takes 30 seconds. It only listens to your voice: audio and words are never stored. Meet Mochi. Mochi grows every time you bounce back from stress."

## Scene 3: Voice fingerprint (0:40–0:55)
**Do:** speak into the laptop mic: **"Mochi, learn my voice"**, then read the 3 lines shown on the lens.
*(If the mic isn't picking you up, skip this scene and just show **Settings → Voice fingerprint**.)*
**Lens:** *"Voiceprint saved."*
**Say:**
> "It learns your voiceprint, so only your voice counts. On the glasses, it combines that with G2's own speaker detection."

## Scene 4: Quiet by design (0:55–1:05)
**Show:** the lens with a tiny Mochi and *"Mochi: clear"*.
**Say:**
> "Most of the time, this is all you see. It's always running, but it only appears when it can actually help."

## Scene 5: A storm, a reset, a bounce-back (1:05–1:40)
**Do:** first click **Demo shortcuts → "Next → Wisp"** so this recovery evolves Mochi. Then type:
1. `This deadline is impossible, nothing works.`
2. `I'm so stressed, we're so behind.`

**Lens:** ⛈ **"Storm brewing. Tap when you have 30 seconds."** → click **Open reset** (top of the page).
3. Wrong answer first: `Whatever.` → *"Almost…"* plus a coaching hint
4. `I feel overwhelmed because I'm scared we won't finish.` → 🌸 **"You came back."**
5. `Okay, that's better. We're good.` → ☀️ **"Clear skies"** → ✨ **"Mochi evolved into a WISP!"**

**Say:**
> "One stressed sentence isn't a spiral, but two are. Mochi offers one 30-second reset, and it's checked by AI: tapping doesn't count, and neither does a vague answer. Name the feeling, calm down, and Mochi grows."

## Scene 6: Silent mid-conversation, debrief after (1:40–2:05)
*(Wait about 30 seconds after Scene 5 for the cooldown, or cut it in the edit.)*
**Do:**
1. `them: The client says the demo broke again.`
2. `Seriously? This is impossible, nothing ever works.`
3. `them: They need it fixed by tonight.`
4. `I'm so stressed about this.`

**Lens:** the phone says *"In a conversation · nudges held"*; the lens stays quiet. About 10 seconds later: **"That got tense. Tap when you're free for 30 seconds."**
**Say:**
> "When you're talking with someone, it holds every nudge. Nobody wants to talk to their glasses mid-argument. The moment the conversation ends, it checks in."

## Scene 7: Repair the sharp moment (2:05–2:20)
**Do:** dismiss or complete the debrief, then:
1. `them: Can you redo the slides?`
2. `Whatever, do it yourself.` → 🩹 **"That came out sharp. Repair it?"**
3. `Sorry, that came out wrong.` → **"Nice repair. That takes guts."** Mochi gets a **heart patch**.

**Say:**
> "It notices when something you say comes out sharp, not when you complain about things, and helps you repair it."

## Scene 8: Read the room (2:20–2:32)
**Do:**
1. `them: Honestly, I'm really overwhelmed right now.` → 👀 **"They sound stressed. Maybe ask how they're doing."**
2. `Hey, are you okay? Can I help?` → **"+ you showed up for them"**. Mochi gets **glasses**.

**Say:**
> "It also reads the room, privately. Only you see this, and the other person's words never leave the server."

## Scene 9: Kindness feeds Mochi (2:32–2:40)
**Do:** `Thanks so much for helping me today.` → ✨ **"+1 kindness"**, flower crown.
**Say:**
> "Kindness is a habit. Every kind word counts, and Mochi wears what you earn."

## Scene 10: Calming down on your own (2:40–2:55)
**Do:**
1. `Ugh, this is so frustrating.` (one line only, so no nudge appears) → the sky turns stormy
2. Wait about 10 seconds, then: `Actually, it's fine. I've got this.` and `I feel calm now.`

**Lens:** **"You came back on your own. That's the real goal."** Mochi gets a **scarf**.
**Say:**
> "And when you calm down before Mochi even has to ask, that counts most. The real goal is building the habit."

## Scene 11: Your patterns (2:55–3:15)
**Do:** scroll the page slowly through: **Today's inner weather**, **Bounce-back time**, **What calms you**, **Trophy case**, **Your patterns** (storm topics and forecast).
**Say:**
> "On your phone: how fast you bounce back, which resets work for you, the badges you've earned, and what your storms are usually about, kept as topic tags only, never your words. Over a few days, it even forecasts when things tend to get tense."

## Scene 12: Close (3:15–3:25)
**Show:** the lens with Mochi wearing its accessories.
**Say:**
> "Compassion Coach: every kind word counts. Find it on Even Hub."

---

## Optional extras (if you have time)
- **Safety pause:** type `I don't want to be here anymore.` → *"You matter… reach out to someone you trust."* Then reload. Mention it rather than dwelling on it.
- **Lens mirror:** open **http://localhost:5173/mirror.html** for a full-screen lens view and record that instead of the panel.
- **Slow-down whisper** needs real fast speech into the mic (typing can't trigger it), so just mention it: *"If you start talking much faster and louder than usual, a quiet 'slow down' appears."*

## If something doesn't trigger
- **No storm nudge?** Add one more stressed line, or wait out the 30-second cooldown after the previous reset.
- **No "They sound stressed"?** Make the `them:` line clearly stressed, and wait about 30 seconds after the last cue.
- **Messy take?** Settings → Reset all data → reload, and start that scene again.
