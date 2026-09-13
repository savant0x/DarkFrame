/**
 * @file lib/baseGreetings.ts
 * @created 2026-09-13
 * @overview FID-20260912-093 — realistic randomized base greetings.
 *
 * Every hostile base (Beer Bases AND regular bots) used to spawn silently —
 * `tiles.base_greeting` was never written at spawn time, so the tile panel's
 * "Base message" well only ever rendered for player-authored greetings.
 * This module is the single pool + pickers both spawn paths share.
 *
 * Voice rules:
 *  - Beer Bases (🍺): rowdy brewery crews — they own the tile and want you
 *    to know the beer is theirs.
 *  - Regular bots: mercenary warband chatter, flavored by specialization
 *    (Hoarder/Fortress/Raider/Ghost/Balanced/Boss) with a shared fallback.
 *
 * Deterministic-enough randomness: plain Math.random over the pool; greetings
 * are written ONCE at claim time and persist, so variety comes from the pool
 * size, not re-rolls. Pure string module — no DB, trivially testable.
 */

/** Rowdy beer-base crew messages. */
const BEER_BASE_GREETINGS: readonly string[] = [
  '🍺 The taps run cold and the vault runs deep. Take a pint — or take your chances.',
  '🍺 Brewery territory. The stock is counted twice daily and defended once, thoroughly.',
  '🍺 You found the brewhouse. Samples are for friends; everything else is defended.',
  '🍺 Fresh batch conditioning. Disturb the quiet and meet the cellar guard.',
  '🍺 Best brew this side of the wasteland — and it is NOT free.',
  '🍺 The crew is drinking. The garrison is not. State your business.',
  '🍺 Kegs stacked to the ceiling. Raid us and learn what hop-fueled regret is.',
  '🍺 Quench your thirst elsewhere — this stock already has an owner.',
  '🍺 Brewmaster says: one free pint for the polite, a beating for the greedy.',
  '🍺 The drums stopped an hour ago. That means the watch is ON.',
  '🍺 Fermentation pit, armory, and a very short guest list.',
  '🍺 Last crew that tried this is fertilizing the barley field.',
  '🍺 Buy low, drink high, raid never.',
  '🍺 The flags say peace. The turrets say otherwise.',
  '🍺 You are standing in the delivery lane. That has a toll.',
];

/** Mercenary / warband messages by bot specialization. */
const SPECIALIST_GREETINGS: Record<string, readonly string[]> = {
  Hoarder: [
    '🪙 Everything shiny goes in the vault. You may admire it from out there.',
    '🪙 Counting in progress. Come back never.',
    '🪙 The piles are organized by year. Touch nothing.',
    '🪙 We bought this peace with the last raiders\' own metal.',
    '🪙 Inventory is 100% accounted for. That is what the locks are for.',
  ],
  Fortress: [
    '🛡 Walls three thick, opinions one: leave.',
    '🛡 The gate has opened for no one in 200 days.',
    '🛡 Siege math: you lose. Every time.',
    '🛡 We do not negotiate. We endure.',
    '🛡 Knock louder — the inner wall enjoys the company.',
  ],
  Raider: [
    '⚔️ You are inside our hunting ground. Congratulations?',
    '⚔️ We were just talking about how long it has been since a good fight.',
    '⚔️ Leave the loot and we call it a toll. Stay and we call it practice.',
    '⚔️ Fast hands, faster blades. Choose your pace.',
    '⚔️ The last visitor donated their gear. Generous soul.',
  ],
  Ghost: [
    '👻 You should not have found this place.',
    '👻 We saw you three tiles ago.',
    '👻 Nothing here is real, especially not the welcome.',
    '👻 The door was open because we let it be.',
    '👻 Whisper your business and go.',
  ],
  Balanced: [
    '⚖️ Reasonable folks, reasonable defenses. Turn around reasonably.',
    '⚖️ We trade, we raid, we remember faces.',
    '⚖️ Fully stocked, fully staffed, fully warned.',
    '⚖️ Equal parts welcome and warning. Your move.',
    '⚖️ The ledger is balanced. Do not unbalance it.',
  ],
  Boss: [
    '👑 You address the throne of the wastes. Speak quickly.',
    '👑 Kneel, pay tribute, or be catalogued.',
    '👑 The crown remembers every intruder. There are no repeat visitors.',
    '👑 My warband eats first. You are not the warband.',
    '👑 This is not a base. It is a verdict.',
  ],
};

/** Shared fallback for unknown/legacy specializations. */
const GENERIC_BOT_GREETINGS: readonly string[] = [
    '🏴 This ground is claimed. Move along.',
    '🏴 The watch is armed and bored. Do not fix the boredom.',
    '🏴 State your business or become the report.',
    '🏴 Supplies guarded, opinions guarded harder.',
    '🏴 You are being logged. That is not a figure of speech.',
];

function pick(pool: readonly string[]): string {
  return pool[Math.floor(Math.random() * pool.length)];
}

/** Greeting for a hostile base at claim time. */
export function generateBaseGreeting(options: {
  isBeerBase: boolean;
  specialization?: string | null;
}): string {
  if (options.isBeerBase) return pick(BEER_BASE_GREETINGS);
  const specPool = options.specialization
    ? SPECIALIST_GREETINGS[options.specialization]
    : undefined;
  return pick(specPool ?? GENERIC_BOT_GREETINGS);
}
