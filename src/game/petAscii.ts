/**
 * src/game/petAscii.ts — Crisp ASCII art tuned for the G2's 576x288 Green Monochromatic Display
 */

import type { EmotionType, PetStage } from '../types/pet'

export interface PetArtSet {
  egg: string
  wisp: string
  juvenile: string
  ascended: string
}

export const PET_ASCII_LIBRARY: Record<string, PetArtSet> = {
  // Joy / Fire Creature: Solispark
  solispark: {
    egg: [
      '    .---.    ',
      '   /  *  \\   ',
      '  | * (:) |  ',
      '   \\  *  /   ',
      '    \'---\'    ',
    ].join('\n'),
    wisp: [
      '    (   )    ',
      '   ( ^o^ )   ',
      '    (   )    ',
      '     ~v~     ',
    ].join('\n'),
    juvenile: [
      '    \\ | /    ',
      '   (\\_-_/)   ',
      '  =( ^w^ )=  ',
      '   c(\")(\")   ',
    ].join('\n'),
    ascended: [
      '  *  \\|/  *  ',
      ' /\\ (\\_/) /\\ ',
      '(  =(^O^)=  )',
      ' \\/ c(\")(\") \\/ ',
      '   *~ SOL ~* ',
    ].join('\n'),
  },

  // Calm / Water Creature: Lumidrop / Zenpaca
  lumidrop: {
    egg: [
      '    .---.    ',
      '   / ~~~ \\   ',
      '  | ( o ) |  ',
      '   \\ ~~~ /   ',
      '    \'---\'    ',
    ].join('\n'),
    wisp: [
      '    .---.    ',
      '   ( -_- )   ',
      '    \\_v_/    ',
      '     ~ ~     ',
    ].join('\n'),
    juvenile: [
      '    .---.    ',
      '   ( =.= )   ',
      '  /(  ~  )\\  ',
      '    \"\" \"\"    ',
    ].join('\n'),
    ascended: [
      '   ~ .---. ~ ',
      '  ( ( ˘◡˘ ) )',
      ' ~/(  ~~~  )\\~',
      '    ~ \"\" ~   ',
    ].join('\n'),
  },

  // Anxiety / Wind Sprite: Zephyr / Wobble
  zephyr: {
    egg: [
      '    .---.    ',
      '   / ?.? \\   ',
      '  | ( ! ) |  ',
      '   \\     /   ',
      '    \'---\'    ',
    ].join('\n'),
    wisp: [
      '     ~~~     ',
      '   ( •_• )?  ',
      '    ~\\_/~    ',
      '    ~   ~    ',
    ].join('\n'),
    juvenile: [
      '   ~ (o_o) ~ ',
      '  <((  ~  ))> ',
      '   ~ / \\ ~   ',
    ].join('\n'),
    ascended: [
      '  ~= (OvO) =~ ',
      ' <<((  ★  ))>>',
      '  ~= / \\ =~  ',
    ].join('\n'),
  },

  // Sadness / Shadow Creature: Gloomwing / Umbra
  gloomwing: {
    egg: [
      '    .---.    ',
      '   /  :  \\   ',
      '  | ( . ) |  ',
      '   \\  \'  /   ',
      '    \'---\'    ',
    ].join('\n'),
    wisp: [
      '     ...     ',
      '   ( ;_; )   ',
      '    (   )    ',
      '     ...     ',
    ].join('\n'),
    juvenile: [
      '   /|   |\\   ',
      '  / (u_u) \\  ',
      '    (   )    ',
      '     \" \"     ',
    ].join('\n'),
    ascended: [
      '  /\\ (U_U) /\\ ',
      ' <  (  ✦  )  >',
      '  \\/ c(\")  \\/ ',
      '   * NIGHT * ',
    ].join('\n'),
  },

  // Frustration / Fire-Spike: Pyre
  pyre: {
    egg: [
      '    ./\\/\\.   ',
      '   /  #  \\   ',
      '  | ( > ) |  ',
      '   \\  #  /   ',
      '    \'---\'    ',
    ].join('\n'),
    wisp: [
      '    /\\ /\\    ',
      '   ( >_< )   ',
      '    (   )    ',
      '     vvv     ',
    ].join('\n'),
    juvenile: [
      '   //\\ /\\\\   ',
      '  < ( >_< ) >',
      '   c(\")(\")   ',
    ].join('\n'),
    ascended: [
      '  * /// \\\\\\ * ',
      ' < ( >=< ) > ',
      '  < c(\")(\") > ',
      '   ! PYRE !  ',
    ].join('\n'),
  },

  // Hybrid Legendary: Serenidrake (Joy + Calm)
  serenidrake: {
    egg: [
      '    .---.    ',
      '   / ★ ✦ \\   ',
      '  | ( ☯ ) |  ',
      '   \\ ✦ ★ /   ',
      '    \'---\'    ',
    ].join('\n'),
    wisp: [
      '    *---*    ',
      '   ( ◕‿◕ )   ',
      '    ~\\_/~    ',
      '   ✦  ✦  ✦   ',
    ].join('\n'),
    juvenile: [
      '   /\\  _  /\\ ',
      '  ( (◕ ‿ ◕) )',
      '  <=(  ☯  )=>',
      '    /\"   \"\\  ',
    ].join('\n'),
    ascended: [
      ' ✦ /\\   /\\ ✦ ',
      '<=( (★‿★) )=>',
      '  /(  ☯☯  )\\ ',
      '   ~ SERENI ~ ',
    ].join('\n'),
  },
}

export function getPetAscii(speciesId: string, stage: PetStage): string {
  const library = PET_ASCII_LIBRARY[speciesId.toLowerCase()] || PET_ASCII_LIBRARY.solispark
  return library[stage] || library.juvenile
}

export function getEmotionEmoji(emotion: EmotionType): string {
  switch (emotion) {
    case 'joy': return '☀️ JOY'
    case 'calm': return '💧 CALM'
    case 'anxiety': return '🌪️ ANXIOUS'
    case 'sadness': return '🌙 GLOOM'
    case 'frustration': return '⚡ TENSE'
    case 'curiosity': return '✨ CURIOUS'
  }
}
