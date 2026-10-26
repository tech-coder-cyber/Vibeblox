// Puzzle play: you are given a position and must find the winning moves. Puzzles come from puzzles.data.ts (made by the engine).
import { Position, type Color } from './rules';
import { PUZZLE_DATA, type PuzzleRaw } from './puzzles.data';

export type Puzzle = PuzzleRaw & { moves: string[]; themes: string[]; side: 'White' | 'Black' };
const THEME_NAMES: Record<string, string> = { mate1: 'Mate in 1', mate2: 'Mate in 2', mate3: 'Mate in 3', mate4: 'Mate in 4', material: 'Win material' };
export const themeName = (k: string) => THEME_NAMES[k] ?? 'Tactic';

export const PUZZLES: Puzzle[] = PUZZLE_DATA.map((p) => ({
  ...p, moves: p.sol.split(' '), themes: [p.kind], side: p.fen.split(' ')[1] === 'b' ? 'Black' : 'White',
}));
export const puzzleById = (id: number) => PUZZLES.find((p) => p.id === id);

/** The next puzzle for someone with this rating: the closest unsolved one, a little random. */
export function pickPuzzle(rating: number, solved: number[], rand: () => number = Math.random): Puzzle {
  const left = PUZZLES.filter((p) => !solved.includes(p.id));
  const pool = (left.length ? left : PUZZLES).slice().sort((a, b) => Math.abs(a.rating - rating) - Math.abs(b.rating - rating));
  const top = pool.slice(0, Math.min(5, pool.length));
  return top[Math.floor(rand() * top.length)];
}

export type Attempt = 'correct' | 'solved' | 'wrong';
/** A puzzle in progress. */
export class PuzzleRun {
  pos: Position;
  step = 0; // index into moves
  hints = 0; mistakes = 0; done = false; failed = false;
  /** the reply the board should show after the player's last correct move, or null */
  reply: string | null = null;
  readonly toMove: Color;
  constructor(readonly puzzle: Puzzle) { this.pos = Position.fromFen(puzzle.fen); this.toMove = this.pos.turn as Color; }

  /** Try the move (uci, e.g. "e2e4" or "e7e8q"). Any move that checkmates also counts when the puzzle is a mate. */
  attempt(uci: string): Attempt {
    if (this.done) return 'solved';
    const m = this.pos.parseUci(uci);
    if (!m) return 'wrong';
    const expected = this.puzzle.moves[this.step];
    let ok = uci === expected;
    if (!ok && /^mate\d/.test(this.puzzle.kind)) {
      this.pos.make(m);
      const mate = !this.pos.hasLegalMove() && this.pos.inCheck();
      this.pos.unmake();
      if (mate) ok = true;
    }
    if (!ok) { this.mistakes++; if (this.mistakes >= 1) this.failed = true; return 'wrong'; }
    this.pos.make(m);
    this.step++;
    if (this.step >= this.puzzle.moves.length || (!this.pos.hasLegalMove())) { this.done = true; this.reply = null; return 'solved'; }
    const rep = this.puzzle.moves[this.step];
    const r = this.pos.parseUci(rep);
    this.reply = rep;
    if (r) { this.pos.make(r); this.step++; }
    if (this.step >= this.puzzle.moves.length) { this.done = true; return 'solved'; }
    return 'correct';
  }
  /** First hint: the square of the piece to move. Second: the whole move. */
  hint(): { from: string; to?: string } {
    this.hints++;
    const mv = this.puzzle.moves[this.step];
    return this.hints === 1 ? { from: mv.slice(0, 2) } : { from: mv.slice(0, 2), to: mv.slice(2, 4) };
  }
  /** 1 = solved cleanly, 0.5 = solved with a hint, 0 = failed. */
  get score(): number { return this.failed ? 0 : this.hints > 0 ? 0.5 : 1; }
}
