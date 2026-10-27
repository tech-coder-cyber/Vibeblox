// Game analysis: scores every move of a game, names the mistakes, and gives an accuracy percentage.
import { Position, Game } from './rules';
import { MATE, type SearchLine } from './engine';
import type { MoveRecord } from '../fairplay';
import { inBook } from './openings';
import { PIECE_VALUES } from './rules';

/** Anything that can score a position: the built-in engine or Stockfish. Scores are from the side to move. */
export interface AnalysisEngine {
  id: string;
  name: string;
  /** the best `n` lines of a position */
  lines(fen: string, n: number, depth: number, timeMs: number): Promise<SearchLine[]>;
  /** score of a position after a move, searched on its own; used when the played move is not among the top lines */
  stop?(): void;
  dispose?(): void;
}

export type MoveClass = 'brilliant' | 'great' | 'book' | 'best' | 'excellent' | 'good' | 'inaccuracy' | 'mistake' | 'blunder';
export const CLASS_LABEL: Record<MoveClass, string> = { brilliant: 'Brilliant', great: 'Great', book: 'Book', best: 'Best', excellent: 'Excellent', good: 'Good', inaccuracy: 'Inaccuracy', mistake: 'Mistake', blunder: 'Blunder' };
export const CLASS_SYMBOL: Record<MoveClass, string> = { brilliant: '!!', great: '!', book: '📖', best: '★', excellent: '!', good: '', inaccuracy: '?!', mistake: '?', blunder: '??' };

export type PlyAnalysis = {
  ply: number; // 1-based
  color: 0 | 1;
  san: string; move: number;
  /** evaluation after the move, centipawns from White's point of view */ evalAfter: number;
  /** evaluation before the move, from White's point of view */ evalBefore: number;
  best: number; bestSan: string;
  /** the engine's top lines before the move */ lines: Array<{ move: number; san: string; score: number }>;
  /** centipawns lost by the mover (>= 0, capped at 300) */ cpLoss: number;
  /** win-chance lost by the mover, in percent points */ winLoss: number;
  cls: MoveClass;
  legal: number;
  /** gap between the best and second best line (cp, capped at 300) */ gap: number;
};

/** Chance of winning (0..100) for a score in centipawns for the side we are looking at. */
export function winChance(cp: number): number {
  if (cp >= MATE - 200) return 100;
  if (cp <= -MATE + 200) return 0;
  return 50 + 50 * (2 / (1 + Math.exp(-0.00368208 * cp)) - 1);
}
export function classify(winLoss: number, isBest: boolean, isBook: boolean): MoveClass {
  if (isBook) return 'book';
  if (isBest || winLoss < 0.5) return 'best';
  if (winLoss < 2) return 'excellent';
  if (winLoss < 5) return 'good';
  if (winLoss < 10) return 'inaccuracy';
  if (winLoss < 20) return 'mistake';
  return 'blunder';
}
/** Accuracy percentage for a list of per-move win-chance losses (the formula Lichess publishes). */
export function accuracy(winLosses: number[]): number {
  if (!winLosses.length) return 100;
  const avg = winLosses.reduce((a, b) => a + b, 0) / winLosses.length;
  return Math.max(0, Math.min(100, 103.1668 * Math.exp(-0.04354 * avg) - 3.1669));
}
const toWhite = (score: number, turn: number) => (turn === 0 ? score : -score);
const yieldNow = () => new Promise<void>((r) => setTimeout(r, 0));

export type AnalysisOptions = { depth: number; timeMs: number; lines?: number; bookPlies?: number; onProgress?: (done: number, total: number) => void; signal?: { cancelled: boolean } };

/** Analyse a whole game. Every position is searched once for its top lines; a played move outside them gets its own search. */
export async function analyzeGame(game: Game, engine: AnalysisEngine, opts: AnalysisOptions): Promise<PlyAnalysis[]> {
  const out: PlyAnalysis[] = [];
  const pos = Position.fromFen(game.startFen);
  const total = game.plies.length;
  const nLines = opts.lines ?? 3;
  const sans: string[] = [];
  let leftBook = false;
  for (let i = 0; i < total; i++) {
    if (opts.signal?.cancelled) break;
    const played = game.plies[i].move;
    const fen = pos.toFen();
    const turn = pos.turn as 0 | 1;
    const legal = pos.moves();
    let lines = await engine.lines(fen, Math.min(nLines, Math.max(1, legal.length)), opts.depth, opts.timeMs);
    if (!lines.length) lines = legal.length ? [{ move: legal[0], score: 0, pv: [legal[0]] }] : [];
    const best = lines[0];
    const gap = lines.length > 1 ? Math.min(300, Math.max(0, best.score - lines[1].score)) : 300;
    let playedScore: number;
    const hit = lines.find((l) => l.move === played);
    if (hit) playedScore = hit.score;
    else {
      pos.make(played);
      if (!pos.hasLegalMove()) playedScore = pos.inCheck() ? MATE - 1 : 0;
      else {
        const rep = await engine.lines(pos.toFen(), 1, Math.max(1, opts.depth - 1), opts.timeMs);
        playedScore = rep.length ? -rep[0].score : 0;
      }
      pos.unmake();
    }
    const san = pos.san(played);
    const sorted = lines.map((l) => ({ move: l.move, san: pos.san(l.move), score: l.score }));
    sans.push(san);
    const isBook = !leftBook && i < 30 && inBook(sans);
    if (!isBook) leftBook = true;
    const wlBefore = winChance(best.score), wlAfter = winChance(playedScore);
    const winLoss = Math.max(0, wlBefore - wlAfter);
    const cpLoss = Math.max(0, Math.min(300, best.score - playedScore));
    let cls = classify(winLoss, played === best.move, isBook);
    if (!isBook && winLoss < 2) {
      const a = brilliance(pos, played, best.score, playedScore, lines);
      if (a) cls = a;
    }
    out.push({
      ply: i + 1, color: turn, san, move: played,
      evalBefore: toWhite(best.score, turn), evalAfter: toWhite(playedScore, turn),
      best: best.move, bestSan: pos.san(best.move), lines: sorted, cpLoss, winLoss, cls, legal: legal.length, gap,
    });
    pos.make(played);
    opts.onProgress?.(i + 1, total);
    if (i % 2 === 1) await yieldNow();
  }
  return out;
}

export function sideAccuracy(a: PlyAnalysis[], color: 0 | 1): number { return accuracy(a.filter((x) => x.color === color && x.cls !== 'book').map((x) => x.winLoss)); }
export function classCounts(a: PlyAnalysis[], color: 0 | 1): Record<MoveClass, number> {
  const c: Record<MoveClass, number> = { brilliant: 0, great: 0, book: 0, best: 0, excellent: 0, good: 0, inaccuracy: 0, mistake: 0, blunder: 0 };
  for (const x of a) if (x.color === color) c[x.cls]++;
  return c;
}
/** The evaluation after each move (White's point of view), starting with the position before the first move. */
export function evalSeries(a: PlyAnalysis[]): number[] { return a.length ? [a[0].evalBefore, ...a.map((x) => x.evalAfter)] : [0]; }
/** The moves that changed the game most, for the "key moments" list. */
export function keyMoments(a: PlyAnalysis[], n = 3): PlyAnalysis[] { return [...a].filter((x) => x.cls === 'mistake' || x.cls === 'blunder').sort((x, y) => y.winLoss - x.winLoss).slice(0, n).sort((x, y) => x.ply - y.ply); }

/** Per-move records for the fair-play check, from an analysis and the times the board kept. */
export function toMoveRecords(a: PlyAnalysis[], color: 0 | 1, times: Array<{ ms: number; blurMs: number; blurs: number } | undefined>, bookPlies = 0): MoveRecord[] {
  return a.filter((x) => x.color === color).map((x) => {
    const t = times[x.ply - 1] ?? { ms: 0, blurMs: 0, blurs: 0 };
    return { ply: x.ply, ms: t.ms, blurMs: t.blurMs, blurs: t.blurs, cpLoss: x.cpLoss, best: x.move === x.best, top3: x.lines.some((l) => l.move === x.move), gap: x.gap, legal: x.legal, ignore: x.ply <= bookPlies || x.legal <= 1 };
  });
}

/** The built-in engine as an AnalysisEngine (runs on the calling thread; the board wraps it in chunks). */
export function builtinEngine(searcher: { analyze(pos: Position, n: number, o: { depth: number; timeMs: number }): SearchLine[] }, name = 'VibeBlox engine'): AnalysisEngine {
  return {
    id: 'builtin', name,
    async lines(fen, n, depth, timeMs) { return searcher.analyze(Position.fromFen(fen), n, { depth, timeMs }); },
  };
}

/** "Brilliant": a good move that gives up material (a piece left hanging or traded down) in a position that was not already won.
 *  "Great": the only move that holds or wins, when the next best choices are clearly worse. Both are given sparingly. */
export function brilliance(pos: Position, move: number, bestScore: number, playedScore: number, lines: Array<{ move: number; score: number }>): MoveClass | null {
  const from = move & 63, to = (move >> 6) & 63, piece = Math.abs(pos.board[from]), victim = Math.abs(pos.board[to]);
  const me = pos.board[from] > 0 ? 0 : 1, them = (me ^ 1) as 0 | 1;
  const before = winChance(bestScore), after = winChance(playedScore);
  if (before > 92 || after < 40) return null; // already decided, or not good enough
  if (piece >= 2 && piece <= 5) {
    pos.make(move);
    let sac = false;
    try {
      const hung = pos.attacked(to, them) && !pos.attacked(to, me as 0 | 1);
      const pawnHit = piece >= 2 && pos.attacked(to, them) && lowAttacker(pos, to, them, PIECE_VALUES[piece]);
      sac = (hung || pawnHit) && PIECE_VALUES[piece] - PIECE_VALUES[victim] >= 200;
    } finally { pos.unmake(); }
    if (sac && after >= before - 3) return 'brilliant';
  }
  if (lines.length > 1 && lines[0].move === move) {
    const second = winChance(lines[1].score);
    if (before - second >= 14 && before >= 35 && before <= 90 && (victim === 0 || PIECE_VALUES[victim] < PIECE_VALUES[piece] || before - second >= 25)) return 'great';
  }
  return null;
}
/** Does a cheaper piece than `value` attack the square? (A pawn or a minor piece hitting a rook or queen, etc.) */
function lowAttacker(pos: Position, sq: number, by: 0 | 1, value: number): boolean {
  const f = sq & 7, r = sq >> 3, dir = by === 0 ? -1 : 1;
  for (const df of [-1, 1]) {
    const ff = f + df, rr = r + dir;
    if (ff < 0 || ff > 7 || rr < 0 || rr > 7) continue;
    const v = pos.board[rr * 8 + ff];
    if (v === (by === 0 ? 1 : -1) && PIECE_VALUES[1] < value - 100) return true;
  }
  return false;
}
