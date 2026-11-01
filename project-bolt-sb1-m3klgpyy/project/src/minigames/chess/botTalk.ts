// More for the bots to say (queen trades, promotions, openings, their own blunders), a check for hanging pieces,
// how long a bot thinks, and the time controls for playing a bot.
import { Position, Game, moveFlags, moveFrom, moveTo, F_CAPTURE, PIECE_VALUES } from './rules';
import type { VoiceId } from '../botCore';

export type ExtraEvent = 'queenLost' | 'queenWon' | 'promotion' | 'blunder' | 'opening';
type Lines = Record<ExtraEvent, string[]>;
const L = (o: Lines) => o;
/** {o} is replaced by the opening's name */
const EXTRA: Record<VoiceId, Lines> = {
  cheerful: L({ queenLost: ['Not my queen!', 'Oh no, my queen!'], queenWon: ['I got your queen! Wow!', 'Yay, your queen!'], promotion: ['A new queen! Wow!', 'Promotion time!'], blunder: ['Oops! Did I just do that?', 'Uh oh, that was silly!'], opening: ['Ooh, the {o}!', 'A {o}! Fun!'] }),
  sleepy: L({ queenLost: ['Zzz... wait, that was my queen?', 'My queen... gone.'], queenWon: ['Oh... I took your queen.', 'A queen. Nice.'], promotion: ['A promotion... nice.', 'Oh, a pawn grew up.'], blunder: ['Hm... did I mess up?', 'Oops. Too sleepy.'], opening: ['The {o}... classic.', '{o}. Okay.'] }),
  grumpy: L({ queenLost: ['My queen?! Unbelievable.', 'Hmph. Lucky shot on my queen.'], queenWon: ['Your queen is mine.', 'Careful with your queen next time.'], promotion: ['Promotion. Great.', 'Tsk, a new piece.'], blunder: ['Ugh, I slipped.', "Don't say anything."], opening: ['The {o}. How original.', '{o}. Fine.'] }),
  formal: L({ queenLost: ['My queen, taken. Splendid play.', 'I seem to have lost my queen.'], queenWon: ['Your queen is captured, with regret.', 'I shall take your queen, thank you.'], promotion: ['A promotion. Most impressive.', 'A pawn reaches the end.'], blunder: ['That was an oversight.', 'I appear to have erred.'], opening: ['The {o}. A respectable choice.', 'Ah, the {o}.'] }),
  cocky: L({ queenLost: ["Okay, that was my queen. I'm still better.", 'You took my queen?! ...fine.'], queenWon: ['Your queen? Mine.', 'Say goodbye to your queen.'], promotion: ['Promotion! Told you.', 'Watch this pawn go.'], blunder: ['...that was on purpose.', 'A deliberate sacrifice. Obviously.'], opening: ['The {o}? I know it well.', '{o}? Easy.'] }),
  shy: L({ queenLost: ['Oh no, my queen...', "I'm sorry, queen..."], queenWon: ['Oh, I took your queen. Sorry!', 'I got your queen... sorry.'], promotion: ['A promotion! Eep.', 'The pawn made it!'], blunder: ['Oh no, I made a mistake...', 'Oops, sorry!'], opening: ['Um, the {o}...', 'Oh, the {o}!'] }),
  nerdy: L({ queenLost: ['Statistically, losing the queen is bad.', 'Queen down! Recalculating...'], queenWon: ['Material swing: +9!', 'Queen captured. Fascinating.'], promotion: ['Promotion! Pawn to piece.', 'Pawn on the last rank. Upgrade!'], blunder: ['Miscalculation detected.', 'Hm, that was suboptimal.'], opening: ["The {o}! I've read about it.", 'Ah, the {o}. Nice.'] }),
  pirate: L({ queenLost: ['Arr, me queen be walkin\' the plank!', "Shiver me timbers, ye took me queen!"], queenWon: ["Arr, yer queen be mine!", 'Yo ho, I plundered yer queen!'], promotion: ['A pawn made landfall, arr!', 'Promoted, arr!'], blunder: ['Arr, I slipped on the deck!', 'Shiver me timbers, a blunder!'], opening: ['The {o}, arr!', 'Set sail with the {o}!'] }),
  coach: L({ queenLost: ['That was my queen! Good capture.', 'Well spotted. My queen is gone.'], queenWon: ["I took your queen. Watch your queen's safety.", 'Your queen was loose. Learn from it.'], promotion: ['Promotion! Always watch for passed pawns.', 'A pawn reaches the end. Well done.'], blunder: ['That was a mistake. Learn from it.', 'Oops, I missed a tactic.'], opening: ['The {o}. A good, principled start.', "That's the {o}. Control the centre."] }),
  robot: L({ queenLost: ['QUEEN LOST. RECALCULATING.', 'ERROR: QUEEN MISSING.'], queenWon: ['QUEEN CAPTURED.', 'TARGET ACQUIRED: QUEEN.'], promotion: ['PAWN UPGRADED.', 'PROMOTION COMPLETE.'], blunder: ['ERROR DETECTED.', 'BLUNDER.EXE'], opening: ['OPENING: {o}.', '{o} DETECTED.'] }),
};
export function botSaysExtra(voice: VoiceId, ev: ExtraEvent, opening?: string, rand: () => number = Math.random): string {
  const list = (EXTRA[voice] ?? EXTRA.cheerful)[ev];
  return list[Math.floor(rand() * list.length)].replace('{o}', opening ?? 'opening');
}

/**
 * After a move: can the side that now moves win material for free, or mate in one?
 * (One look ahead; it is only used for the bot's reaction to its own mistakes, not to pick moves.)
 */
export function hangsMaterial(pos: Position): { mate: boolean; gain: number } {
  const p = pos.clone();
  let gain = 0, mate = false;
  for (const m of p.moves()) {
    const to = moveTo(m), from = moveFrom(m);
    const victim = Math.abs(p.board[to]) || ((moveFlags(m) & F_CAPTURE) ? 1 : 0);
    const attacker = Math.abs(p.board[from]);
    p.make(m);
    if (p.inCheck() && !p.hasLegalMove()) mate = true;
    if (victim) {
      const defended = p.attacked(to, p.turn); // after the move the other side is to play: can it take back?
      gain = Math.max(gain, defended ? PIECE_VALUES[victim] - PIECE_VALUES[attacker] : PIECE_VALUES[victim]);
    }
    p.unmake();
  }
  return { mate, gain };
}
export const isBlunder = (pos: Position) => { const h = hangsMaterial(pos); return h.mate || h.gain >= 250; };

// ---------- time controls ----------
export type TimeCtl = { id: string; label: string; /** seconds each */ base: number; /** seconds added per move */ inc: number };
export const TIME_CONTROLS: TimeCtl[] = [
  { id: 'none', label: 'No timer', base: 0, inc: 0 },
  { id: '1+0', label: '1 min', base: 60, inc: 0 },
  { id: '3+0', label: '3 min', base: 180, inc: 0 },
  { id: '3+2', label: '3 | 2', base: 180, inc: 2 },
  { id: '5+0', label: '5 min', base: 300, inc: 0 },
  { id: '10+0', label: '10 min', base: 600, inc: 0 },
  { id: '15+10', label: '15 | 10', base: 900, inc: 10 },
];
export const timeCtl = (id: string | null | undefined): TimeCtl => TIME_CONTROLS.find((t) => t.id === id) ?? TIME_CONTROLS[0];
export function clockText(ms: number): string {
  const s = Math.max(0, ms) / 1000;
  if (s < 10) return s.toFixed(1);
  const m = Math.floor(s / 60), r = Math.floor(s % 60);
  return `${m}:${String(r).padStart(2, '0')}`;
}
/** Fast time controls make bots play a little worse (rating points taken off). */
export function ratingPenalty(tc: TimeCtl): number { return !tc.base ? 0 : tc.base <= 60 ? 220 : tc.base <= 180 ? 120 : tc.base <= 300 ? 60 : 0; }

/**
 * How long the bot waits before it moves. About 2 to 3 seconds when there is no timer, longer in tricky positions and
 * shorter when there are few moves to choose from. With a fast timer it moves in about 1 to 2 seconds.
 */
export function botThinkMs(game: Game, voice: VoiceId, tc: TimeCtl, botClockMs: number | null, rand: () => number = Math.random): number {
  const moves = game.legalMoves();
  if (moves.length <= 1) return 500 + rand() * 400; // only one move
  const caps = moves.filter((m) => moveFlags(m) & F_CAPTURE).length;
  const tricky = Math.min(1, Math.max(0, (moves.length - 12) / 28)) + (game.pos.inCheck() ? 0.25 : 0) + (caps ? 0.15 : 0) + (caps > 3 ? 0.15 : 0);
  const early = game.plies.length < 8 ? 0.7 : 1; // the first moves come quicker
  let ms: number;
  if (tc.base && tc.base <= 300) ms = (1000 + rand() * 900 + tricky * 700) * early;           // 1 to 2 seconds, a little more when it is hard
  else ms = (2000 + rand() * 1000 + tricky * 1500) * early;                                    // 2 to 3 seconds, more when it is hard
  if (voice === 'sleepy') ms += 700;
  if (voice === 'robot') ms *= 0.85;
  if (botClockMs !== null) ms = Math.min(ms, Math.max(250, botClockMs * 0.1)); // low on time: hurry up
  return ms;
}

/** When a bot says yes to a draw: never when it is better, and only sometimes when it is equal or worse. */
export function drawDecision(botScore: number, plies: number, drawLove: number, rating: number, rand: () => number = Math.random): boolean {
  if (plies < 24) return false;
  if (botScore > 40) return false; // it is better: no draw
  if (botScore > -40) return rating < 1400 ? rand() < drawLove * 0.8 : rand() < drawLove * 0.35; // about equal
  return rand() < Math.min(1, 0.55 + drawLove); // it is worse: it is glad to take a draw
}
