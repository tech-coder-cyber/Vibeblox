// Fair play: tells apart a player who is cheating from a player who is just having a very good game.
// It never bans anyone. At most it puts a game in a queue for a human to look at ("review"), and it needs several different
// kinds of evidence before it does. One strange number (a long think, a tab switch, one lucky game) is never enough.

export type MoveRecord = {
  ply: number;
  /** the time the player took, in ms */ ms: number;
  /** how long the tab was hidden / window out of focus during this move, in ms */ blurMs: number;
  /** how many times it was left */ blurs: number;
  /** centipawns lost compared with the engine's best move (capped at 300) */ cpLoss: number;
  /** was it the engine's first choice */ best: boolean;
  /** was it one of the top 3 */ top3: boolean;
  /** how much better the best move is than the second (cp, capped at 300). Small = many good moves, big = only move */ gap: number;
  legal: number;
  /** from the opening book or a forced reply: these are ignored */ ignore?: boolean;
};
export type History = {
  /** rated games played */ games: number;
  /** average centipawn loss over past games, or null */ acpl: number | null;
  /** share of non-trivial moves that were the engine's top choice, or null */ match: number | null;
  /** median seconds per move in past games, or null */ medianSec: number | null;
  /** past games that went to review */ reviews: number;
};
export type Assessment = {
  /** 0..100 */ score: number;
  level: 'clear' | 'watch' | 'review';
  signals: Array<{ id: 'focus' | 'timing' | 'accuracy' | 'jump'; points: number; text: string }>;
  stats: { moves: number; acpl: number; match: number; top3: number; blurMoves: number };
};

/** Average centipawn loss a player of this rating normally has (moves capped at 300 cp lost). */
export function expectedAcpl(r: number): number {
  const pts: Array<[number, number]> = [[400, 150], [800, 112], [1200, 82], [1600, 58], [2000, 40], [2400, 26], [2800, 16]];
  if (r <= pts[0][0]) return pts[0][1];
  for (let i = 1; i < pts.length; i++) if (r <= pts[i][0]) { const [r1, a] = pts[i - 1], [r2, b] = pts[i]; return a + ((b - a) * (r - r1)) / (r2 - r1); }
  return pts[pts.length - 1][1];
}
/** Share of non-trivial moves a player of this rating matches with the engine's first choice. */
export function expectedMatch(r: number): number { return Math.min(0.78, Math.max(0.2, 0.2 + (r - 400) / 3700)); }

const median = (a: number[]) => { if (!a.length) return 0; const s = [...a].sort((x, y) => x - y); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };

/**
 * Looks at one finished game of one player.
 * `rating` is the player's rating before the game; `hist` is their past record; `opts.disconnects` counts connection drops
 * (a drop explains a slow move, so those moves are not held against anyone).
 */
export function assessGame(moves: MoveRecord[], rating: number, hist: History, opts: { disconnects?: number; mobile?: boolean } = {}): Assessment {
  const used = moves.filter((m) => !m.ignore);
  const real = used.filter((m) => m.legal > 1);
  // non-trivial: several playable moves, the position is not just a forced capture
  const hard = real.filter((m) => m.gap < 150 && m.legal >= 8);
  const stats = {
    moves: used.length,
    acpl: used.length ? used.reduce((a, m) => a + m.cpLoss, 0) / used.length : 0,
    match: hard.length ? hard.filter((m) => m.best).length / hard.length : 0,
    top3: hard.length ? hard.filter((m) => m.top3).length / hard.length : 0,
    blurMoves: used.filter((m) => m.blurMs > 2500).length,
  };
  const signals: Assessment['signals'] = [];
  const tooFew = used.length < 20 || hard.length < 12; // short games prove nothing
  if (tooFew) return { score: 0, level: 'clear', signals, stats };

  const expA = expectedAcpl(rating), expM = expectedMatch(rating);

  // 1. Accuracy far above what this rating plays like
  const accRatio = stats.acpl / expA;
  const matchOver = stats.match - expM;
  if (accRatio < 0.4 && matchOver > 0.22) {
    const pts = Math.min(40, Math.round((0.4 - accRatio) * 70 + (matchOver - 0.22) * 90) + 14);
    signals.push({ id: 'accuracy', points: pts, text: `Played like a much stronger player (average loss ${stats.acpl.toFixed(0)} cp, normal for this rating is about ${expA.toFixed(0)}; matched the engine on ${(stats.match * 100).toFixed(0)}% of hard moves).` });
  }

  // 2. Better than their own past games
  if (hist.games >= 5 && hist.acpl !== null) {
    const jump = hist.acpl / Math.max(1, stats.acpl);
    if (jump > 2.2 && accRatio < 0.6) signals.push({ id: 'jump', points: Math.min(25, Math.round((jump - 2.2) * 12) + 10), text: `Much better than their usual games (average loss ${stats.acpl.toFixed(0)} cp now, ${hist.acpl.toFixed(0)} cp before).` });
  }

  // 3. Leaving the tab, on the moves that mattered
  const blurMoves = used.filter((m) => m.blurMs > 2500 && m.blurs > 0);
  if (blurMoves.length >= 3) {
    const goodAfter = blurMoves.filter((m) => m.top3 && m.cpLoss <= 15 && m.gap < 200).length;
    const share = goodAfter / blurMoves.length;
    const blurRatio = blurMoves.length / used.length;
    if (share >= 0.8 && blurRatio >= 0.15) signals.push({ id: 'focus', points: Math.min(35, Math.round(blurMoves.length * 3 + share * 10)), text: `Left the tab on ${blurMoves.length} moves and played the engine's choice almost every time after.` });
  }

  // 4. Long pauses followed by a perfect move, when that is not how this player usually plays
  const secs = used.map((m) => m.ms / 1000);
  const med = hist.medianSec ?? median(secs);
  const longs = used.filter((m) => m.ms / 1000 > Math.max(25, med * 4) && m.blurMs < 1500 && !(opts.disconnects && opts.disconnects > 0));
  if (longs.length >= 3) {
    const sharp = longs.filter((m) => m.best && m.cpLoss <= 5 && m.gap >= 40).length;
    const normalMoves = used.filter((m) => !longs.includes(m));
    const accN = normalMoves.length ? normalMoves.reduce((a, m) => a + m.cpLoss, 0) / normalMoves.length : 0;
    const accL = longs.reduce((a, m) => a + m.cpLoss, 0) / longs.length;
    if (sharp / longs.length >= 0.75 && accN > accL * 3 + 15) signals.push({ id: 'timing', points: Math.min(30, 8 + longs.length * 4), text: `${longs.length} very long pauses, each followed by the best move, while the other moves were far worse.` });
  }

  // you need independent evidence, not one strong number
  const kinds = new Set(signals.map((s) => s.id));
  let score = Math.min(100, signals.reduce((a, s) => a + s.points, 0));
  // one kind of evidence alone is capped below the review line
  if (kinds.size < 2) score = Math.min(score, 45);
  // a history of clean play counts for the player
  if (hist.games >= 30 && hist.reviews === 0) score = Math.round(score * 0.8);
  // phones and tablets switch apps on every notification
  if (opts.mobile) for (const s of signals) if (s.id === 'focus') score -= Math.round(s.points * 0.6);
  score = Math.max(0, Math.min(100, score));
  // the extreme case: nearly perfect play at a low rating, over a long game, is enough on its own for a look
  const extreme = used.length >= 30 && stats.match >= 0.9 && rating < 1800 && accRatio < 0.2;
  const level: Assessment['level'] = score >= 60 || extreme ? 'review' : score >= 35 ? 'watch' : 'clear';
  return { score: extreme ? Math.max(score, 60) : score, level, signals, stats };
}

/** One player over many games: reviews only count again when they keep coming. */
export function accountStatus(past: Array<Assessment['level']>): 'ok' | 'watching' | 'under review' {
  const recent = past.slice(-10);
  const reviews = recent.filter((l) => l === 'review').length;
  if (reviews >= 2) return 'under review';
  if (reviews >= 1 || recent.filter((l) => l === 'watch').length >= 3) return 'watching';
  return 'ok';
}

// ---------- tracking inside the game (used by the board) ----------
/** Tracks how long each move took and how often the tab was left during it. */
export class MoveClock {
  private startAt = 0;
  private hiddenAt = 0;
  private blurMs = 0;
  private blurs = 0;
  private running = false;
  start(now = Date.now(), hidden = false) { this.startAt = now; this.blurMs = 0; this.blurs = 0; this.hiddenAt = hidden ? now : 0; this.running = true; }
  setHidden(hidden: boolean, now = Date.now()) {
    if (!this.running) return;
    if (hidden && !this.hiddenAt) { this.hiddenAt = now; this.blurs++; }
    else if (!hidden && this.hiddenAt) { this.blurMs += now - this.hiddenAt; this.hiddenAt = 0; }
  }
  stop(now = Date.now()) {
    if (!this.running) return { ms: 0, blurMs: 0, blurs: 0 };
    this.setHidden(false, now);
    this.running = false;
    return { ms: Math.max(0, now - this.startAt), blurMs: this.blurMs, blurs: this.blurs };
  }
}
