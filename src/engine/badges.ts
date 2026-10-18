/**
 * src/engine/badges.ts — Badges, and the accessories Mochi wears for them.
 *
 * Rewards are for the moments that matter (repairing, kindness, reading the room, calming down on
 * your own), not for time spent in the app.
 */

import type { Accessory } from '../hud/sprite'

export type BadgeId =
  | 'first_repair'
  | 'first_kind'
  | 'first_room'
  | 'first_self'
  | 'peacemaker'
  | 'storm_chaser'
  | 'kind_soul'
  | 'zen_master'
  | 'night_owl'

export interface BadgeDef {
  title: string
  desc: string
  icon: string
  accessory?: Accessory
}

export const BADGES: Record<BadgeId, BadgeDef> = {
  first_repair: { title: 'Patched Up', desc: 'Repaired a sharp moment.', icon: '🩹', accessory: 'patch' },
  first_kind: { title: 'Warm Words', desc: 'Said something kind.', icon: '🌸', accessory: 'flower' },
  first_room: { title: 'Room Reader', desc: 'Checked on someone who was struggling.', icon: '👓', accessory: 'glasses' },
  first_self: { title: 'On My Own', desc: 'Calmed down before Mochi had to ask.', icon: '🧣', accessory: 'scarf' },
  peacemaker: { title: 'Peacemaker', desc: '3 repairs.', icon: '🕊' },
  storm_chaser: { title: 'Storm Chaser', desc: 'Weathered 10 storms.', icon: '⛈' },
  kind_soul: { title: 'Kind Soul', desc: '10 kind words.', icon: '💛' },
  zen_master: { title: 'Zen Master', desc: 'Calmed down on your own 3 times.', icon: '🧘' },
  night_owl: { title: 'Night Owl Calm', desc: 'Bounced back after 10pm.', icon: '🦉' },
}

export const ACCESSORY_NAMES: Record<Accessory, string> = {
  patch: 'a heart patch',
  flower: 'a flower crown',
  glasses: 'tiny glasses',
  scarf: 'a cozy scarf',
}

export function accessoriesFor(ids: Iterable<BadgeId>): Accessory[] {
  const out: Accessory[] = []
  for (const id of ids) {
    const a = BADGES[id]?.accessory
    if (a && !out.includes(a)) out.push(a)
  }
  return out
}

export function fmtDuration(ms: number): string {
  const s = Math.max(1, Math.round(ms / 1000))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}
