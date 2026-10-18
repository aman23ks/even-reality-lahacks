/**
 * src/game/petAscii.ts — Physical Creature Growth ASCII Art tuned for G2 (576x288 Mono Display)
 * 
 * Each pet visibly GROWS from Tiny Hatchling -> Medium Wisp -> Large Beast -> Giant Ascended Guardian
 */

import type { EmotionType, PetStage } from '../types/pet'

export interface PetArtSet {
  hatchling: string // Tiny (Lvl 1-2)
  wisp: string      // Medium (Lvl 3-5)
  juvenile: string  // Large (Lvl 6-9)
  ascended: string  // Giant Guardian (Lvl 10+)
}

export const PET_ASCII_LIBRARY: Record<string, PetArtSet> = {
  // Joy / Fire Creature: Solispark
  solispark: {
    hatchling: [
      '  (..)  ',
      ' /"*"\\ ',
      '  ~v~   ',
      ' (Tiny) ',
    ].join('\n'),

    wisp: [
      '   .-.   ',
      '  (^o^)  ',
      ' /| * |\\ ',
      '  ~\" \"~  ',
      ' (Wisp)  ',
    ].join('\n'),

    juvenile: [
      '   \\ | /   ',
      '  (\\_-_/)  ',
      ' =( ^w^ )= ',
      '  /| * |\\  ',
      '  c(\")(\")  ',
      ' (Beast)   ',
    ].join('\n'),

    ascended: [
      '  *~.  \\|/  .~*  ',
      ' / \\ \\(\\_/) / /\\ ',
      '(   =(^O^)=   )  ',
      ' \\ \\_/c(\")\\_/ /  ',
      '  \'--\'\"\"\"\"\'--\'   ',
      ' *~ ZENITH SOL ~* ',
    ].join('\n'),
  },

  // Calm / Water Spirit: Lumidrop
  lumidrop: {
    hatchling: [
      '  (..)  ',
      ' /~~~\\ ',
      '  \" \"   ',
      ' (Tiny) ',
    ].join('\n'),

    wisp: [
      '   .---.   ',
      '  ( -_- )  ',
      ' /(  ~  )\\ ',
      '   \"\" \"\"   ',
      '  (Wisp)   ',
    ].join('\n'),

    juvenile: [
      '   ~ .---. ~   ',
      '  ( ( ˘◡˘ ) )  ',
      ' ~/(  ~~~  )\\~ ',
      '   /\"\"   \"\"\\   ',
      '   (Juvenile)  ',
    ].join('\n'),

    ascended: [
      '  ~*~  .---.  ~*~  ',
      ' ( ( ( ☯◡☯ ) ) )  ',
      '~/(   ~~~~~   )\\~ ',
      '(  ( (  ~  ) )  ) ',
      ' ~*~  \"\" \"\"  ~*~  ',
      '  * ZENITH CALM *  ',
    ].join('\n'),
  },

  // Anxiety / Wind Sprite: Zephyr (Transforms panic into lightning agility!)
  zephyr: {
    hatchling: [
      '  (??)  ',
      '  /\"\\   ',
      '  ~ ~   ',
      ' (Tiny) ',
    ].join('\n'),

    wisp: [
      '   ~.~   ',
      '  (•_•)? ',
      ' <( ~ )> ',
      '  ~ / \\~ ',
      ' (Wisp)  ',
    ].join('\n'),

    juvenile: [
      '  ~~ (o_o) ~~  ',
      ' <<((  ~  ))>> ',
      '   /| * |\\     ',
      '  ~= / \\ =~    ',
      '  (Zephyr)     ',
    ].join('\n'),

    ascended: [
      '  ==~  /\\ /\\  ~==  ',
      ' <<( ( OvO ) )>>  ',
      '<<<<(  ★⚡★  )>>>> ',
      '  <=( (   ) )=>   ',
      '  ==~  / \\  ~==   ',
      '  * STORM GUARDIAN *',
    ].join('\n'),
  },

  // Melancholy / Shadow Creature: Gloomwing (Transforms sadness into profound depth!)
  gloomwing: {
    hatchling: [
      '  (..)  ',
      '  /...\\ ',
      '   ...  ',
      ' (Tiny) ',
    ].join('\n'),

    wisp: [
      '   /| |\\   ',
      '  ( ;_; )  ',
      '  /(   )\\  ',
      '   \"\" \"\"   ',
      '  (Wisp)   ',
    ].join('\n'),

    juvenile: [
      '   /\\   /\\   ',
      '  /  (u_u)  \\ ',
      ' <  (  ✦  )  >',
      '  \\ c(\")(\") / ',
      '   (Gloomwing)',
    ].join('\n'),

    ascended: [
      '  /\\/\\ (U_U) /\\/\\  ',
      ' <    (  ✦✦ )    > ',
      '<<   /(  ★  )\\   >>',
      ' <    c(\")(\")    > ',
      '  \\/\\/ NIGHT \\/\\/  ',
      '  * ABYSS GUARDIAN *',
    ].join('\n'),
  },

  // Frustration / Fire-Spike: Pyre (Transforms anger into unstoppable drive!)
  pyre: {
    hatchling: [
      '  (><)  ',
      '  /##\\  ',
      '  vvv   ',
      ' (Tiny) ',
    ].join('\n'),

    wisp: [
      '   /\\ /\\   ',
      '  ( >_< )  ',
      '  <( # )>  ',
      '   c(\")(\") ',
      '  (Wisp)   ',
    ].join('\n'),

    juvenile: [
      '   /// \\\\\\   ',
      '  <( >_< )>  ',
      '  <=( # )=>  ',
      '   c(\")(\")   ',
      '   (Pyre Lvl)',
    ].join('\n'),

    ascended: [
      ' *!*  /// \\\\\\  *!* ',
      '<<<=( ( >=< ) )=>>>',
      ' <<  /(  ⚡🔥 )\\  >> ',
      '  <   c(\")(\")   >  ',
      '  * PYRE ASCENDED * ',
    ].join('\n'),
  },

  // Legendary Hybrid: Serenidrake (Joy + Calm)
  serenidrake: {
    hatchling: [
      '  (☯☯)  ',
      '  /★\\   ',
      '  ~ ~   ',
      ' (Hatch) ',
    ].join('\n'),

    wisp: [
      '   *---*   ',
      '  ( ◕‿◕ )  ',
      '  <=(☯)=>  ',
      '   ✦   ✦   ',
      '  (Drake)  ',
    ].join('\n'),

    juvenile: [
      '   /\\  _  /\\   ',
      '  ( (◕ ‿ ◕) )  ',
      ' <=(  ☯★☯  )=> ',
      '  /(       )\\  ',
      '    /\"   \"\\    ',
      '  (Dragon Beast)',
    ].join('\n'),

    ascended: [
      ' ✦ /\\   /\\   /\\ ✦ ',
      '<=( (★ ‿ ★) )=>',
      ' <<(   ☯★☯   )>> ',
      '<<<( (  🐉  ) )>>>',
      '  /(  ~~~~~  )\\  ',
      ' * ZENITH DRAGON * ',
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
