// Ratings. Same maths as the clubs use: Elo expected score, FIDE-style K factors, and a performance-rating estimate
// for the first 5 games against real players. Named classes follow USCF's 200-point bands; titles are strength labels only.

export type RatingState = {
  /** the rating shown */ r: number;
  /** rated games played against real players */ n: number;
  /** sum of opponents' ratings */ sumOpp: number;
  /** points scored (1 / 0.5 / 0) */ pts: number;
  /** highest rating reached */ peak: number;
};
export const START_RATING = 1200;
export const PROVISIONAL_GAMES = 5;
export const RATING_FLOOR = 100;
export const RATING_CEIL = 3200;

export const newRating = (): RatingState => ({ r: START_RATING, n: 0, sumOpp: 0, pts: 0, peak: START_RATING });
export const isProvisional = (s: Pick<RatingState, 'n'>) => s.n < PROVISIONAL_GAMES;
export const expectedScore = (a: number, b: number) => 1 / (1 + Math.pow(10, (b - a) / 400));
/** Rating difference for a score fraction (FIDE's dp, capped at 800). */
export function dp(p: number): number {
  if (p >= 0.995) return 800;
  if (p <= 0.005) return -800;
  return Math.max(-800, Math.min(800, 400 * Math.log10(p / (1 - p))));
}
/** K factor: 40 for the first 30 games, 20 below 2400, 10 at 2400 and above (FIDE). */
export const kFactor = (n: number, r: number) => (n < 30 ? 40 : r < 2400 ? 20 : 10);
const clamp = (r: number) => Math.round(Math.min(RATING_CEIL, Math.max(RATING_FLOOR, r)));

/** Apply a finished rated game against a real player. `score` is 1, 0.5 or 0. */
export function applyResult(s: RatingState, oppRating: number, score: number): RatingState {
  const n = s.n + 1;
  const sumOpp = s.sumOpp + oppRating;
  const pts = s.pts + score;
  let r: number;
  if (n <= PROVISIONAL_GAMES) {
    // performance rating, with one imaginary draw against a 1200 player so a single game cannot send you to the moon
    const games = n + 1;
    r = (sumOpp + START_RATING) / games + dp((pts + 0.5) / games);
  } else {
    r = s.r + kFactor(s.n, s.r) * (score - expectedScore(s.r, oppRating));
  }
  r = clamp(r);
  return { r, n, sumOpp, pts, peak: Math.max(s.peak, r) };
}
/** What your rating would change by (for showing "+8" before the game ends). */
export function ratingChange(s: RatingState, oppRating: number, score: number): number {
  return applyResult(s, oppRating, score).r - s.r;
}
export function displayRating(s: RatingState): { value: number; provisional: boolean; label: string; gamesLeft: number } {
  const provisional = isProvisional(s);
  return { value: s.r, provisional, label: provisional ? (s.n === 0 ? 'Unrated' : s.r + '?') : String(s.r), gamesLeft: Math.max(0, PROVISIONAL_GAMES - s.n) };
}

// ---------- puzzles ----------
export type PuzzleRating = { r: number; n: number };
export const newPuzzleRating = (): PuzzleRating => ({ r: 1000, n: 0 });
/** `score` 1 = solved clean, 0.5 = solved with a hint, 0 = failed. */
export function applyPuzzle(s: PuzzleRating, puzzleRating: number, score: number): PuzzleRating {
  const k = s.n < 10 ? 64 : s.n < 40 ? 40 : 24;
  return { r: clamp(s.r + k * (score - expectedScore(s.r, puzzleRating))), n: s.n + 1 };
}

// ---------- clubs ----------
const BANDS: Array<[number, string]> = [
  [2400, 'Senior Master'], [2200, 'Master'], [2000, 'Expert'], [1800, 'Class A'], [1600, 'Class B'], [1400, 'Class C'],
  [1200, 'Class D'], [1000, 'Class E'], [800, 'Class F'], [600, 'Class G'], [400, 'Class H'], [200, 'Class I'], [0, 'Class J'],
];
/** USCF-style class. */
export function clubClass(r: number): string { for (const [min, name] of BANDS) if (r >= min) return name; return 'Class J'; }
const TITLES: Array<[number, string]> = [[2700, 'Super-GM strength'], [2500, 'GM strength'], [2400, 'IM strength'], [2300, 'FM strength'], [2200, 'CM strength']];
/** FIDE title strength. This is only a label for how strong the rating is; real titles come from FIDE. */
export function titleStrength(r: number): string | null { for (const [min, name] of TITLES) if (r >= min) return name; return null; }
/** About where this rating sits on FIDE's scale (FIDE starts at 1000). Treat it as a rough guide. */
export function fideEstimate(r: number): number | null { return r < 1000 ? null : Math.round(r >= 1800 ? r - 25 : r); }
export function ratingLabel(r: number): string { const t = titleStrength(r); return t ? `${clubClass(r)} · ${t}` : clubClass(r); }

// ---------- crowns for beating bots ----------
/** 3 crowns: clean win. 2: won with one hint or one takeback. 1: won with several. 0: draw or loss. */
export function crownsFor(result: 'win' | 'draw' | 'loss', hints: number, takebacks: number): number {
  if (result !== 'win') return 0;
  const used = hints + takebacks;
  return used === 0 ? 3 : used === 1 ? 2 : 1;
}
/** Keep the best crown count per bot. */
export function bestCrowns(prev: number | undefined, now: number): number { return Math.max(prev ?? 0, now); }
export const crownText = (n: number) => '♛'.repeat(n) + '♕'.repeat(Math.max(0, 3 - n));
