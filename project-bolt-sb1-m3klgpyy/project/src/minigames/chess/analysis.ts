// Game analysis: scores every move of a game, names the mistakes, and gives an accuracy percentage.
import { Position, Game } from './rules';
import { MATE, type SearchLine } from './engine';
import type { MoveRecord } from '../fairplay';

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

export type MoveClass = 'book' | 'best' | 'excellent' | 'good' | 'inaccuracy' | 'mistake' | 'blunder';
export const CLASS_LABEL: Record<MoveClass, string> = { book: 'Book', best: 'Best', excellent: 'Excellent', good: 'Good', inaccuracy: 'Inaccuracy', mistake: 'Mistake', blunder: 'Blunder' };
export const CLASS_SYMBOL: Record<MoveClass, string> = { book: '', best: '★', excellent: '!', good: '', inaccuracy: '?!', mistake: '?', blunder: '??' };

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
    const isBook = i < (opts.bookPlies ?? 0);
    const wlBefore = winChance(best.score), wlAfter = winChance(playedScore);
    const winLoss = Math.max(0, wlBefore - wlAfter);
    const cpLoss = Math.max(0, Math.min(300, best.score - playedScore));
    const cls = classify(winLoss, played === best.move, isBook);
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
  const c: Record<MoveClass, number> = { book: 0, best: 0, excellent: 0, good: 0, inaccuracy: 0, mistake: 0, blunder: 0 };
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
