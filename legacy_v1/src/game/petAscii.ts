/**
 * src/game/petAscii.ts — Clean, Minimalist Pixel/ASCII Art tuned for G2 (576x288 Green OLED)
 * 
 * Symmetrical, crisp Tamagotchi/VoidPet aesthetic with 4 distinct growth sizes.
 */

import type { EmotionType, PetStage } from '../types/pet'

export interface PetArtSet {
  hatchling: string // Tiny (Lvl 1-2)
  wisp: string      // Medium (Lvl 3-5)
  juvenile: string  // Large (Lvl 6-9)
  ascended: string  // Giant Guardian (Lvl 10+)
}

export const PET_ASCII_LIBRARY: Record<string, PetArtSet> = {
  // Joy / Sun Fox: Solispark
  solispark: {
    hatchling: [
      '  ╭───╮  ',
      '  │•‿•│ ✨',
      '  ╰─v─╯  ',
    ].join('\n'),

    wisp: [
      '   /\\_/\\   ',
      '  ( •‿• ) ✨',
      '  ╭─m─m─╮  ',
      '  ╰─────╯  ',
    ].join('\n'),

    juvenile: [
      '    |\\_/\\_/|    ',
      '   (  ★ ‿ ★  ) ☀',
      '  ╭──( ✦ ✦ )──╮ ',
      '  │   c u u   │ ',
      '  ╰───────────╯ ',
    ].join('\n'),

    ascended: [
      '  ☼  /|___/|\\___|\\  ☼  ',
      '    (   ★ ‿ ★   )     ',
      '   ╭─(  ✦ ☀️ ✦  )─╮    ',
      '  <(  │  ~~~  │  )>   ',
      '   ╰──┴──m─m──┴──╯    ',
      '  ★ SOLAR GUARDIAN ★   ',
    ].join('\n'),
  },

  // Calm / Water Dew: Lumidrop
  lumidrop: {
    hatchling: [
      '  ╭───╮  ',
      '  │˘◡˘│ 💧',
      '  ╰───╯  ',
    ].join('\n'),

    wisp: [
      '   ╭──────╮   ',
      '  (  ˘ ◡ ˘ ) ☯',
      '   ╰──────╯   ',
      '    ~ ~ ~ ~   ',
    ].join('\n'),

    juvenile: [
      '    ╭──────────╮    ',
      '   ( (  ☯ ◡ ☯  ) )  ',
      '  ~╰─(  ~~~  )─╯~   ',
      '     /\"\"    \"\"\\     ',
    ].join('\n'),

    ascended: [
      '   ~*~  ╭──────────╮  ~*~   ',
      '  ( (  ( (  ˘ ◡ ˘  ) )  ) ) ',
      '  ~╰───(   ☯ 💧 ☯   )───╯~  ',
      '  ( (  (   ~~~~~   )  ) )   ',
      '   ~*~  ╰──────────╯  ~*~   ',
      '     ★ ZENITH SERENITY ★    ',
    ].join('\n'),
  },

  // Anxiety / Storm Sprite: Zephyr
  zephyr: {
    hatchling: [
      '  ╭───╮  ',
      '  │•_•│? 🌪️',
      '  ╰─~─╯  ',
    ].join('\n'),

    wisp: [
      '    /|   |\\    ',
      '   (  •_•  )? ⚡',
      '   ╭──(~)──╮   ',
      '    ~ / \\ ~    ',
    ].join('\n'),

    juvenile: [
      '     /|  _  |\\     ',
      '   <( ( •_• ) )> ⚡ ',
      '  <<=(  ★ ⚡ ★  )=>>',
      '     ~ /   \\ ~     ',
    ].join('\n'),

    ascended: [
      '   ⚡  /|_______|\\  ⚡   ',
      '  <<=( (  ⊙ ‿ ⊙  ) )=>> ',
      '  <<<<(   ★ ⚡ ★   )>>>>',
      '   <<=( (  ~~~  ) )=>>  ',
      '      ~  /     \\  ~     ',
      '     ★ STORM GUARDIAN ★ ',
    ].join('\n'),
  },

  // Sadness / Lunar Moth: Gloomwing
  gloomwing: {
    hatchling: [
      '  ╭───╮  ',
      '  │u_u│ 🌙',
      '  ╰───╯  ',
    ].join('\n'),

    wisp: [
      '   /|   |\\   ',
      '  (  u_u  ) ✦',
      '  ╭─(   )─╮  ',
      '   \'--\'--\'   ',
    ].join('\n'),

    juvenile: [
      '    /|     |\\    ',
      '   / ( u_u ) \\ 🌙',
      '  <  (  ✦  )  >  ',
      '   \\  c u u  /   ',
      '    \'-------\'    ',
    ].join('\n'),

    ascended: [
      '   🌙  /|________|\\  🌙   ',
      '     /  (  U _ U  )  \\    ',
      '   <<   (   ✦ ✦   )   >>  ',
      '    <   (  ~~~~~  )   >   ',
      '     \\  \'--m---m--\'  /    ',
      '     ★ ABYSS GUARDIAN ★   ',
    ].join('\n'),
  },

  // Frustration / Ember Drake: Pyre
  pyre: {
    hatchling: [
      '  ╭───╮  ',
      '  │>_<│ 🔥',
      '  ╰─▲─╯  ',
    ].join('\n'),

    wisp: [
      '    ▲   ▲    ',
      '   ( >_< ) 🔥',
      '   ╭─(▲)─╮   ',
      '   ╰─m─m─╯   ',
    ].join('\n'),

    juvenile: [
      '    ▲ ▲   ▲ ▲    ',
      '   <(  > _ <  )> ⚡',
      '   <=(  🔥   )=> ',
      '    c───m─m───d  ',
    ].join('\n'),

    ascended: [
      '   🔥  ▲▲▲___▲▲▲  🔥   ',
      '   <<=( ( > _ < ) )=>> ',
      '   <<<=(  🔥 ⚡ 🔥  )=>>>',
      '    <<=( (  ~~~  ) )=>> ',
      '     c────m───m────d    ',
      '     ★ PYRE ASCENDED ★  ',
    ].join('\n'),
  },

  // Celestial Dragon Hybrid: Serenidrake
  serenidrake: {
    hatchling: [
      '  ╭───╮  ',
      '  │★_★│ 🐉',
      '  ╰─~─╯  ',
    ].join('\n'),

    wisp: [
      '    /|   |\\   ',
      '   (  ★‿★  ) ☯',
      '   ╭─(★)─╮    ',
      '    ~ ~ ~     ',
    ].join('\n'),

    juvenile: [
      '    /|  ___  |\\   ',
      '   ( ( ★ ‿ ★ ) ) ✦',
      '  <=(   ☯ ★ ☯   )=>',
      '   ╭──( ~~~ )──╮  ',
      '    /\"\"     \"\"\\   ',
    ].join('\n'),

    ascended: [
      '   ✦  /|___/\\___|\\  ✦   ',
      '  <<=( (  ★ ‿ ★  ) )=>> ',
      '  <<<(   ☯ ★ 🐉 ★ ☯   )>>>',
      '   <=( (  ~~~~~  ) )=>  ',
      '    ╰──┴──m───m──┴──╯   ',
      '    ★ ZENITH DRAGON ★   ',
    ].join('\n'),
  },
}

export function getPetAscii(speciesId: string, stage: PetStage): string {
  const library = PET_ASCII_LIBRARY[speciesId.toLowerCase()] || PET_ASCII_LIBRARY.solispark
  return library[stage] || library.hatchling
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
