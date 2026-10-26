// The checkers bots: 6 in each tier, each with a way of playing.
import { Checkers, CheckersGame, type Move } from './rules';
import { CheckersSearcher, checkersBotMove, NORMAL_CHECKERS, type CheckersStyle } from './engine';
import { skillForRating } from '../chess/bots';
import type { Skill } from '../chess/engine';
import type { BotInfo } from '../botCore';

export type CheckersBot = BotInfo & { style: CheckersStyle; tweak?: Partial<Skill>; plays: string; drawLove: number; resignBelow: number };
const S = (o: Partial<CheckersStyle>): CheckersStyle => ({ ...NORMAL_CHECKERS, ...o });

export const CHECKERS_BOTS: CheckersBot[] = [
  // Beginner
  { id: 'ck-biscuit', name: 'Biscuit', rating: 300, tier: 'beginner', emoji: '🍪', color: '#e0b36a', voice: 'cheerful', bio: 'Just learned the jump rule. Sometimes forgets it.', plays: 'Random-looking moves.', style: NORMAL_CHECKERS, tweak: { lapse: 0.6 }, drawLove: 0.9, resignBelow: 0 },
  { id: 'ck-dozy', name: 'Dozy', rating: 400, tier: 'beginner', emoji: '😴', color: '#9bb0c9', voice: 'sleepy', bio: 'Plays one piece at a time, slowly.', plays: 'Moves the same pieces over and over.', style: S({ advance: 0.3, center: 0.3 }), drawLove: 0.8, resignBelow: 0 },
  { id: 'ck-pepper', name: 'Pepper', rating: 500, tier: 'beginner', emoji: '🌶️', color: '#e5533d', voice: 'cocky', bio: 'Rushes forward without looking back.', plays: 'Runs for a king.', style: S({ advance: 2.2, backRow: 0.2, kings: 2 }), drawLove: 0.3, resignBelow: 0 },
  { id: 'ck-wobble', name: 'Wobble', rating: 600, tier: 'beginner', emoji: '🐧', color: '#6fa8dc', voice: 'shy', bio: 'Shy, never leaves the back row.', plays: 'Stays home and defends.', style: S({ backRow: 2.5, advance: 0.3 }), drawLove: 0.7, resignBelow: 0 },
  { id: 'ck-bolt', name: 'Bolt', rating: 700, tier: 'beginner', emoji: '⚡', color: '#f2c230', voice: 'robot', bio: 'Jumps whenever it can, thinks later.', plays: 'Loves trades.', style: S({ trades: 2 }), drawLove: 0.4, resignBelow: 0 },
  { id: 'ck-gus', name: 'Gus', rating: 800, tier: 'beginner', emoji: '🧓', color: '#a9a9a9', voice: 'grumpy', bio: 'Plays on the porch every afternoon.', plays: 'Careful edge play.', style: S({ center: 0.4 }), drawLove: 0.6, resignBelow: 0 },
  // Intermediate
  { id: 'ck-nell', name: 'Nell', rating: 900, tier: 'intermediate', emoji: '🧶', color: '#d884b0', voice: 'coach', bio: 'A club regular who teaches the basics.', plays: 'Solid, centre-first checkers.', style: S({ center: 1.5 }), drawLove: 0.5, resignBelow: 0 },
  { id: 'ck-otto', name: 'Otto', rating: 1000, tier: 'intermediate', emoji: '🔧', color: '#8f9aa5', voice: 'nerdy', bio: 'Counts every move before making it.', plays: 'Patient, exact exchanges.', style: S({ trades: 1.6, backRow: 1.3 }), drawLove: 0.5, resignBelow: -900 },
  { id: 'ck-ruby', name: 'Ruby', rating: 1100, tier: 'intermediate', emoji: '💎', color: '#e0457b', voice: 'cocky', bio: 'Always the first to crown a king.', plays: 'Fast kings.', style: S({ kings: 2.5, advance: 1.6 }), drawLove: 0.3, resignBelow: -900 },
  { id: 'ck-tobias', name: 'Tobias', rating: 1200, tier: 'intermediate', emoji: '🧱', color: '#a66a4a', voice: 'formal', bio: 'Builds a wall and waits.', plays: 'Wall of men, slow attack.', style: S({ backRow: 1.6, center: 1.4, advance: 0.7 }), drawLove: 0.5, resignBelow: -900 },
  { id: 'ck-pia', name: 'Pia', rating: 1250, tier: 'intermediate', emoji: '🐞', color: '#d9534f', voice: 'nerdy', bio: 'Collects tricks from old checkers books.', plays: 'Plays known shots.', style: S({ advance: 1.2, trades: 1.3 }), drawLove: 0.4, resignBelow: -900 },
  { id: 'ck-lena', name: 'Lena', rating: 1300, tier: 'intermediate', emoji: '🦋', color: '#9b8cff', voice: 'cheerful', bio: 'Loves sneaky two-for-one shots.', plays: 'Sets up tricks.', style: S({ advance: 1.3, center: 1.2 }), drawLove: 0.3, resignBelow: -900 },
  // Advanced
  { id: 'ck-marco', name: 'Marco', rating: 1450, tier: 'advanced', emoji: '🎯', color: '#4fc3c8', voice: 'pirate', bio: 'Sharp eye for a winning jump.', plays: 'Tactical and direct.', style: S({ advance: 1.2 }), drawLove: 0.3, resignBelow: -800 },
  { id: 'ck-ingrid', name: 'Ingrid', rating: 1600, tier: 'advanced', emoji: '❄️', color: '#9fd3ff', voice: 'formal', bio: 'Cold, calm and exact.', plays: 'Clean positional play.', style: S({ center: 1.3, backRow: 1.2 }), drawLove: 0.4, resignBelow: -800 },
  { id: 'ck-dante', name: 'Dante', rating: 1750, tier: 'advanced', emoji: '🔥', color: '#ff7a45', voice: 'cocky', bio: 'Attacks in every game.', plays: 'Constant attack.', style: S({ advance: 1.7, kings: 1.5, backRow: 0.7 }), drawLove: 0.1, resignBelow: -800 },
  { id: 'ck-yuki', name: 'Yuki', rating: 1900, tier: 'advanced', emoji: '🌸', color: '#f4a6c0', voice: 'shy', bio: 'Quiet. Wins endgames from nowhere.', plays: 'Endgame specialist.', style: S({ trades: 1.8, kings: 1.3 }), drawLove: 0.4, resignBelow: -800 },
  { id: 'ck-felix', name: 'Felix', rating: 2000, tier: 'advanced', emoji: '🐈', color: '#c98a4b', voice: 'nerdy', bio: 'Remembers opening lines by heart.', plays: 'Book-like and accurate.', style: NORMAL_CHECKERS, drawLove: 0.3, resignBelow: -700 },
  { id: 'ck-sasha', name: 'Sasha', rating: 2100, tier: 'advanced', emoji: '🗝️', color: '#7b9e5f', voice: 'coach', bio: 'A calm teacher you cannot beat easily.', plays: 'Balanced and strong.', style: S({ center: 1.2, trades: 1.2 }), drawLove: 0.3, resignBelow: -700 },
  // Master
  { id: 'ck-orion', name: 'Orion', rating: 2200, tier: 'master', emoji: '🏹', color: '#5aa9e6', voice: 'formal', bio: 'A veteran with perfect manners.', plays: 'Deep and positional.', style: S({ center: 1.2 }), drawLove: 0.3, resignBelow: -600 },
  { id: 'ck-zora', name: 'Zora', rating: 2300, tier: 'master', emoji: '🌪️', color: '#79d2de', voice: 'cheerful', bio: 'Quick, fearless and full of tricks.', plays: 'Aggressive tactics.', style: S({ advance: 1.4, kings: 1.4 }), drawLove: 0.2, resignBelow: -600 },
  { id: 'ck-barnaby', name: 'Barnaby', rating: 2400, tier: 'master', emoji: '🐻', color: '#8b5e3c', voice: 'grumpy', bio: 'Slow, heavy and very hard to break.', plays: 'Tight defense.', style: S({ backRow: 1.5, trades: 1.4 }), drawLove: 0.3, resignBelow: -600 },
  { id: 'ck-selene', name: 'Selene', rating: 2500, tier: 'master', emoji: '🌙', color: '#b6a6ff', voice: 'coach', bio: 'Sees five moves ahead.', plays: 'Long plans.', style: NORMAL_CHECKERS, drawLove: 0.2, resignBelow: -500 },
  { id: 'ck-vega', name: 'Vega', rating: 2600, tier: 'master', emoji: '⭐', color: '#ffd166', voice: 'robot', bio: 'A machine. Never blunders.', plays: 'Machine-like.', style: NORMAL_CHECKERS, tweak: { depth: 12, timeMs: 2500 }, drawLove: 0.1, resignBelow: -400 },
  { id: 'ck-atlas', name: 'Atlas', rating: 2700, tier: 'master', emoji: '🗿', color: '#7a7f87', voice: 'robot', bio: 'The strongest checkers bot here.', plays: 'Full strength.', style: NORMAL_CHECKERS, tweak: { depth: 14, timeMs: 4000 }, drawLove: 0.05, resignBelow: -400 },
];
export const checkersBot = (id: string) => CHECKERS_BOTS.find((b) => b.id === id) ?? CHECKERS_BOTS[0];

/** Checkers search is cheaper per ply than chess, so the same rating gets more depth. */
export function checkersSkill(bot: CheckersBot): Skill {
  const base = skillForRating(bot.rating);
  const skill: Skill = { ...base, depth: Math.max(1, Math.round(base.depth * 1.8)), margin: Math.round(base.margin * 0.5), temperature: Math.round(base.temperature * 0.5 * 10) / 10 };
  return { ...skill, ...(bot.tweak ?? {}) };
}
export function chooseCheckersMove(bot: CheckersBot, game: CheckersGame, searcher: CheckersSearcher): Move | null {
  const r = checkersBotMove(searcher, game.pos, checkersSkill(bot), bot.style);
  return r?.move ?? null;
}
void Checkers;
