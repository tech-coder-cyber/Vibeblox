// The chess bots: 8 in each of 4 tiers, every one with its own way of playing.
import { Position, Game, type Color } from './rules';
import { Searcher, botMove, NORMAL_STYLE, type Skill, type SearchStyle } from './engine';
import { bookMove } from './openings';
import { type BotInfo, type Tier } from '../botCore';

export type ChessBot = BotInfo & {
  /** how it plays: what the evaluation likes */ style: SearchStyle;
  /** changes on top of the skill that comes from its rating */ tweak?: Partial<Skill>;
  /** opening ids it likes to play (see openings.ts) */ book: string[];
  /** a one-line description of how it plays, shown on its card */ plays: string;
  /** a bot below this evaluation (centipawns) resigns, 0 = never */ resignBelow: number;
  /** how easily it agrees to a draw (0..1) */ drawLove: number;
};

const S = (o: Partial<SearchStyle>): SearchStyle => ({ ...NORMAL_STYLE, ...o });

export const CHESS_BOTS: ChessBot[] = [
  // ---- Beginner ----
  { id: 'pip', name: 'Pip', rating: 250, tier: 'beginner', emoji: '🐣', color: '#f7d56b', voice: 'cheerful', bio: 'Learned how the pieces move this morning.', plays: 'Moves almost at random.', style: NORMAL_STYLE, tweak: { lapse: 0.7 }, book: [], resignBelow: 0, drawLove: 0.9 },
  { id: 'mossy', name: 'Mossy', rating: 350, tier: 'beginner', emoji: '🐢', color: '#8fbf7a', voice: 'sleepy', bio: 'Slow, calm and often forgets a piece is there.', plays: 'Pushes pawns and forgets about defense.', style: S({ space: 1.5, safety: 0.6 }), book: [], resignBelow: 0, drawLove: 0.8 },
  { id: 'clover', name: 'Clover', rating: 450, tier: 'beginner', emoji: '🍀', color: '#59c27a', voice: 'cheerful', bio: 'Takes any piece she can, without thinking what happens next.', plays: 'Grabs material, even when it is a trap.', style: S({ material: 1.3 }), tweak: { depth: 1, lapse: 0.45 }, book: [], resignBelow: 0, drawLove: 0.4 },
  { id: 'bumble', name: 'Bumble', rating: 550, tier: 'beginner', emoji: '🐝', color: '#f2c230', voice: 'nerdy', bio: 'Loves knights and jumps them everywhere.', plays: 'Moves its knights again and again.', style: S({ knights: 1.8 }), book: ['four-knights'], resignBelow: 0, drawLove: 0.5 },
  { id: 'rusty', name: 'Rusty', rating: 600, tier: 'beginner', emoji: '🤖', color: '#9aa5b3', voice: 'robot', bio: 'An old robot with a few loose screws.', plays: 'Pawn pushes and straight lines.', style: S({ space: 1.8, positional: 0.5 }), book: [], resignBelow: 0, drawLove: 0.5 },
  { id: 'ember', name: 'Ember', rating: 650, tier: 'beginner', emoji: '🔥', color: '#ff7a45', voice: 'cocky', bio: 'Brings the queen out on move two and hopes for the best.', plays: 'Early queen attacks.', style: S({ aggression: 1.8, queenLust: 3 }), book: [], resignBelow: 0, drawLove: 0.2 },
  { id: 'sprout', name: 'Sprout', rating: 700, tier: 'beginner', emoji: '🌱', color: '#8ad06a', voice: 'shy', bio: 'Careful and shy. Hates trading pieces.', plays: 'Keeps everything defended and avoids trades.', style: S({ safety: 1.8, trades: 0.5, aggression: 0.5 }), book: [], resignBelow: 0, drawLove: 0.7 },
  { id: 'nibbles', name: 'Nibbles', rating: 750, tier: 'beginner', emoji: '🐭', color: '#c9b79c', voice: 'grumpy', bio: 'Grumpy little mouse. Nibbles away at your pawns.', plays: 'Goes after pawns first.', style: S({ material: 1.15, space: 1.3 }), book: [], resignBelow: 0, drawLove: 0.3 },
  // ---- Intermediate ----
  { id: 'maya', name: 'Maya', rating: 850, tier: 'intermediate', emoji: '🎒', color: '#58a6ff', voice: 'coach', bio: 'A friendly club player who loves the classic openings.', plays: 'Develops, castles, plays simple chess.', style: S({ positional: 1.2, safety: 1.2 }), book: ['italian', 'london'], resignBelow: 0, drawLove: 0.5 },
  { id: 'theo', name: 'Theo', rating: 950, tier: 'intermediate', emoji: '🥤', color: '#ff9f43', voice: 'cocky', bio: 'Trades everything once he is ahead.', plays: 'Swaps pieces to simplify.', style: S({ trades: 1.8 }), book: ['scotch'], resignBelow: -900, drawLove: 0.3 },
  { id: 'rosa', name: 'Rosa', rating: 1050, tier: 'intermediate', emoji: '🌹', color: '#ee6b8b', voice: 'formal', bio: 'Patient and polite, with a love for solid pawn structures.', plays: 'Slow positional play.', style: S({ positional: 1.7, aggression: 0.7 }), book: ['qgd', 'slav'], resignBelow: -900, drawLove: 0.5 },
  { id: 'finn', name: 'Finn', rating: 1150, tier: 'intermediate', emoji: '🎣', color: '#4fc3c8', voice: 'cheerful', bio: 'Loves a gambit and a good trap.', plays: 'Sacrifices a pawn for activity.', style: S({ aggression: 1.7, material: 0.85, queenLust: 2 }), book: ['kings-gambit', 'evans'], resignBelow: -900, drawLove: 0.2 },
  { id: 'odette', name: 'Odette', rating: 1250, tier: 'intermediate', emoji: '🦢', color: '#d7c2ff', voice: 'shy', bio: 'Graceful and defensive. Wins when you get impatient.', plays: 'Solid defense and counter-punches.', style: S({ safety: 1.7, trades: 0.8, aggression: 0.7 }), book: ['french', 'caro-kann'], resignBelow: -900, drawLove: 0.6 },
  { id: 'jasper', name: 'Jasper', rating: 1300, tier: 'intermediate', emoji: '🧭', color: '#b08d57', voice: 'pirate', bio: 'Sails into open positions and loves attacking the king.', plays: 'Attacks on the kingside.', style: S({ aggression: 1.8, safety: 0.8 }), book: ['sicilian', 'italian'], resignBelow: -900, drawLove: 0.2 },
  { id: 'priya', name: 'Priya', rating: 1350, tier: 'intermediate', emoji: '📐', color: '#6fd1a5', voice: 'nerdy', bio: 'Reads theory for fun. Keeps her pieces active.', plays: 'Principled development.', style: S({ positional: 1.4 }), book: ['qgd', 'ruy'], resignBelow: -900, drawLove: 0.4 },
  { id: 'bram', name: 'Bram', rating: 1450, tier: 'intermediate', emoji: '🪓', color: '#a0715a', voice: 'grumpy', bio: 'Direct and blunt. Goes straight at your king.', plays: 'Open, tactical games.', style: S({ aggression: 1.5, queenLust: 1.5 }), book: ['scotch', 'kings-gambit'], resignBelow: -900, drawLove: 0.2 },
  // ---- Advanced ----
  { id: 'ines', name: 'Ines', rating: 1550, tier: 'advanced', emoji: '🦊', color: '#ff8a4c', voice: 'cocky', bio: 'Sharp tactician who sets small traps in every game.', plays: 'Tactics and quick attacks.', style: S({ aggression: 1.4 }), book: ['sicilian', 'italian'], resignBelow: -800, drawLove: 0.2 },
  { id: 'gideon', name: 'Gideon', rating: 1650, tier: 'advanced', emoji: '🏛️', color: '#c0a062', voice: 'formal', bio: 'A classical thinker: centre, development, then attack.', plays: 'Strong centre and classical plans.', style: S({ positional: 1.5, space: 1.3 }), book: ['ruy', 'qgd'], resignBelow: -800, drawLove: 0.4 },
  { id: 'mara', name: 'Mara', rating: 1750, tier: 'advanced', emoji: '🕸️', color: '#8f7be0', voice: 'coach', bio: 'Waits for your mistake and then punishes it.', plays: 'Patient defender, counterattacker.', style: S({ safety: 1.5, trades: 1.2 }), book: ['caro-kann', 'nimzo'], resignBelow: -800, drawLove: 0.4 },
  { id: 'cassian', name: 'Cassian', rating: 1850, tier: 'advanced', emoji: '🗡️', color: '#d9534f', voice: 'cocky', bio: 'Loves sacrifices when they lead to a mating attack.', plays: 'Sacrifices for attack.', style: S({ aggression: 1.9, material: 0.85, safety: 0.8 }), book: ['kings-gambit', 'evans', 'sicilian'], resignBelow: -800, drawLove: 0.1 },
  { id: 'hana', name: 'Hana', rating: 1950, tier: 'advanced', emoji: '🌸', color: '#f4a6c0', voice: 'shy', bio: 'Quiet and precise. Strong in endgames.', plays: 'Positional squeeze and endgame skill.', style: S({ positional: 1.7, trades: 1.4 }), book: ['london', 'english'], resignBelow: -800, drawLove: 0.4 },
  { id: 'rowan', name: 'Rowan', rating: 2050, tier: 'advanced', emoji: '🦉', color: '#7b9e5f', voice: 'nerdy', bio: 'Studies openings all day. Hard to surprise.', plays: 'Deep opening preparation.', style: S({ positional: 1.3 }), book: ['ruy', 'nimzo', 'kid'], resignBelow: -700, drawLove: 0.3 },
  { id: 'dax', name: 'Dax', rating: 2150, tier: 'advanced', emoji: '🐺', color: '#6c7a89', voice: 'grumpy', bio: 'Lone wolf. Relentless pressure from the first move.', plays: 'Constant initiative.', style: S({ aggression: 1.4, space: 1.2 }), book: ['sicilian', 'kid'], resignBelow: -700, drawLove: 0.1 },
  { id: 'liora', name: 'Liora', rating: 2250, tier: 'advanced', emoji: '🌙', color: '#9b8cff', voice: 'formal', bio: 'Calm and exact. Rarely makes a loose move.', plays: 'Accurate all-round chess.', style: NORMAL_STYLE, book: ['qgd', 'ruy', 'nimzo'], resignBelow: -700, drawLove: 0.3 },
  // ---- Master ----
  { id: 'vesper', name: 'Vesper', rating: 2300, tier: 'master', emoji: '🌆', color: '#e08a5c', voice: 'coach', bio: 'A seasoned master who teaches by beating you.', plays: 'Mature, balanced chess.', style: S({ positional: 1.2 }), book: ['ruy', 'qgd', 'english'], resignBelow: -600, drawLove: 0.3 },
  { id: 'oriel', name: 'Oriel', rating: 2350, tier: 'master', emoji: '🔭', color: '#5aa9e6', voice: 'nerdy', bio: 'Calculates deeper than you think.', plays: 'Deep calculation and quiet moves.', style: S({ positional: 1.3, safety: 1.2 }), book: ['nimzo', 'ruy'], resignBelow: -600, drawLove: 0.3 },
  { id: 'brann', name: 'Brann', rating: 2400, tier: 'master', emoji: '🛡️', color: '#8c9aa8', voice: 'grumpy', bio: 'A wall. You will have to earn every point.', plays: 'Rock-solid defense, wins the endgame.', style: S({ safety: 1.6, trades: 1.4, aggression: 0.7 }), book: ['caro-kann', 'london'], resignBelow: -600, drawLove: 0.3 },
  { id: 'zephyr', name: 'Zephyr', rating: 2450, tier: 'master', emoji: '🌬️', color: '#79d2de', voice: 'cheerful', bio: 'Light-footed and creative. Loves open positions.', plays: 'Creative and fast.', style: S({ aggression: 1.3, space: 1.2 }), book: ['kings-gambit', 'sicilian', 'scotch'], resignBelow: -600, drawLove: 0.2 },
  { id: 'astra', name: 'Astra', rating: 2500, tier: 'master', emoji: '✨', color: '#ffd166', voice: 'formal', bio: 'Elegant and precise: the model of classical play.', plays: 'Classical and precise.', style: S({ positional: 1.4 }), book: ['qgd', 'ruy', 'italian'], resignBelow: -500, drawLove: 0.3 },
  { id: 'kestrel', name: 'Kestrel', rating: 2550, tier: 'master', emoji: '🦅', color: '#c98a4b', voice: 'cocky', bio: 'Strikes without warning from a quiet position.', plays: 'Sudden tactical strikes.', style: S({ aggression: 1.4 }), book: ['sicilian', 'kid', 'scotch'], resignBelow: -500, drawLove: 0.2 },
  { id: 'nova', name: 'Nova', rating: 2600, tier: 'master', emoji: '🌟', color: '#ff6fb5', voice: 'robot', bio: 'A machine that never forgets a tactic.', plays: 'Machine-like accuracy.', style: NORMAL_STYLE, book: ['ruy', 'qgd', 'sicilian'], resignBelow: -500, drawLove: 0.1 },
  { id: 'titan', name: 'Titan', rating: 2700, tier: 'master', emoji: '🗿', color: '#7a7f87', voice: 'robot', bio: 'The strongest bot here. Plays at full strength.', plays: 'Full strength.', style: NORMAL_STYLE, tweak: { depth: 9, timeMs: 3000 }, book: ['ruy', 'qgd', 'sicilian', 'nimzo'], resignBelow: -400, drawLove: 0.05 },
];
export const chessBot = (id: string) => CHESS_BOTS.find((b) => b.id === id) ?? CHESS_BOTS[0];

// ---------- strength from rating ----------
const ANCHORS: Array<[number, Skill]> = [
  [250, { depth: 1, timeMs: 60, margin: 700, temperature: 500, lapse: 0.7 }],
  [500, { depth: 1, timeMs: 60, margin: 450, temperature: 230, lapse: 0.45 }],
  [800, { depth: 2, timeMs: 120, margin: 300, temperature: 130, lapse: 0.25 }],
  [1100, { depth: 2, timeMs: 180, margin: 200, temperature: 80, lapse: 0.14 }],
  [1400, { depth: 3, timeMs: 250, margin: 150, temperature: 50, lapse: 0.08 }],
  [1700, { depth: 4, timeMs: 400, margin: 90, temperature: 30, lapse: 0.04 }],
  [2000, { depth: 5, timeMs: 700, margin: 50, temperature: 15, lapse: 0.01 }],
  [2300, { depth: 6, timeMs: 1100, margin: 25, temperature: 8, lapse: 0 }],
  [2600, { depth: 8, timeMs: 2000, margin: 0, temperature: 0, lapse: 0 }],
];
export function skillForRating(r: number): Skill {
  if (r <= ANCHORS[0][0]) return { ...ANCHORS[0][1] };
  for (let i = 1; i < ANCHORS.length; i++) {
    const [r1, a] = ANCHORS[i - 1], [r2, b] = ANCHORS[i];
    if (r <= r2) {
      const t = (r - r1) / (r2 - r1);
      const lerp = (x: number, y: number) => x + (y - x) * t;
      return { depth: Math.round(lerp(a.depth, b.depth)), timeMs: Math.round(lerp(a.timeMs, b.timeMs)), margin: Math.round(lerp(a.margin, b.margin)), temperature: Math.round(lerp(a.temperature, b.temperature) * 10) / 10, lapse: Math.round(lerp(a.lapse, b.lapse) * 1000) / 1000 };
    }
  }
  return { ...ANCHORS[ANCHORS.length - 1][1] };
}
export const botSkill = (bot: ChessBot): Skill => ({ ...skillForRating(bot.rating), ...(bot.tweak ?? {}) });

/** The move a bot plays in this game. Opening book first (more often for stronger bots), then the search. */
export function chooseBotMove(bot: ChessBot, game: Game, searcher: Searcher): { move: number; score: number; book: boolean } {
  const pos = game.pos;
  const strength = Math.max(0, Math.min(0.95, (bot.rating - 700) / 1500));
  if (game.plies.length < 16 && Math.random() < strength) {
    const san = bookMove(game.sanList(), bot.book);
    if (san) { const m = pos.parseSan(san); if (m) return { move: m, score: 0, book: true }; }
  }
  const keys = repetitionKeys(game);
  const r = botMove(searcher, pos, botSkill(bot), bot.style, keys);
  return { move: r.move, score: r.score, book: false };
}
/** Keys of the earlier positions of a game, so the search knows what a repetition is. */
export function repetitionKeys(game: Game): number[] {
  const p = Position.fromFen(game.startFen);
  const keys = [p.key()];
  for (const x of game.plies) { p.make(x.move); keys.push(p.key()); }
  keys.pop(); // the last one is the current position, which the search adds itself
  return keys;
}

/** Does a bot accept a draw offer? It likes a draw more when it is not better. `score` is from the bot's point of view. */
export function botAcceptsDraw(bot: ChessBot, score: number, plies: number, rand = Math.random()): boolean {
  if (plies < 20) return false;
  if (score > 150) return false;
  const pull = score < -150 ? 1 : score < -30 ? 0.6 : 0.25; // a bot in trouble is happy with a draw
  return rand < bot.drawLove * pull * 1.6;
}
export function botShouldResign(bot: ChessBot, score: number, plies: number): boolean {
  return !!bot.resignBelow && plies > 30 && score < bot.resignBelow;
}
export type { Tier, Color };
