// Checkers search: alpha-beta with iterative deepening, a hash table and a forced-jump extension.
import { Checkers, RED, WHITE, MAN, KING, type Move } from './rules';
import type { Skill } from '../chess/engine';

export type CheckersStyle = {
  /** pushes men forward */ advance: number;
  /** keeps the back row guarded */ backRow: number;
  /** likes the centre */ center: number;
  /** wants kings fast */ kings: number;
  /** likes swapping when ahead (and avoiding it when behind) */ trades: number;
  /** values material */ material: number;
};
export const NORMAL_CHECKERS: CheckersStyle = { advance: 1, backRow: 1, center: 1, kings: 1, trades: 1, material: 1 };

const WIN = 30000;
/** Evaluation for the side to move's opponent... no: always from RED's point of view, in centipawns. */
export function evaluate(c: Checkers, st: CheckersStyle = NORMAL_CHECKERS): number {
  const b = c.board;
  let score = 0, red = 0, white = 0;
  for (let sq = 0; sq < 64; sq++) {
    const v = b[sq];
    if (!v) continue;
    const r = sq >> 3, f = sq & 7;
    const mine = v > 0 ? 1 : -1;
    const king = Math.abs(v) === KING;
    const centre = 3 - Math.max(Math.abs(f - 3.5), Math.abs(r - 3.5)) + 0.5; // 0..3
    let s = king ? 160 * st.material : 100 * st.material;
    s += centre * (king ? 4 : 3) * st.center;
    if (!king) {
      const adv = v > 0 ? r : 7 - r; // 0..7
      s += adv * 3.2 * st.advance + (adv >= 5 ? 4 * st.kings : 0);
      const home = v > 0 ? r === 0 : r === 7;
      if (home && (f === 2 || f === 6 || f === 1 || f === 5)) s += 7 * st.backRow;
      if (f === 0 || f === 7) s -= 2; // edge men have fewer options
    } else if (f === 0 || f === 7 || r === 0 || r === 7) s -= 6; // a king on the edge is easier to trap
    score += mine * s;
    if (v > 0) red++; else white++;
  }
  // trades: if one side is ahead, fewer pieces is better for it
  const lead = red - white;
  score += lead * (24 - red - white) * 0.9 * (st.trades - 0.0);
  return score;
}

type TTEntry = { depth: number; score: number; flag: 0 | 1 | 2; move: number };
export class CheckersSearcher {
  private tt = new Map<string, TTEntry>();
  private nodes = 0; private stop = false; private deadline = 0;
  private style = NORMAL_CHECKERS;
  private pos!: Checkers;
  newGame() { this.tt.clear(); }

  private negamax(depth: number, alpha: number, beta: number, ply: number, ext: number): number {
    if ((++this.nodes & 1023) === 0 && Date.now() > this.deadline) this.stop = true;
    if (this.stop) return 0;
    const p = this.pos;
    const moves = p.moves();
    if (!moves.length) return -WIN + ply;
    if (p.repetitions() >= 2 || p.half >= 80) return 0;
    const sign = p.turn === RED ? 1 : -1;
    const forced = moves[0].caps.length > 0;
    if (depth <= 0) {
      if (forced && ext < 6) { depth = 1; ext++; } else return sign * evaluate(p, this.style);
    }
    const key = p.key();
    const e = this.tt.get(key);
    let ttMove = -1;
    if (e) {
      ttMove = e.move;
      if (e.depth >= depth) {
        if (e.flag === 0) return e.score;
        if (e.flag === 1 && e.score >= beta) return e.score;
        if (e.flag === 2 && e.score <= alpha) return e.score;
      }
    }
    // order: the table move, then longer jumps
    const order = moves.map((m, i) => ({ m, i, k: (i === ttMove ? 1000 : 0) + m.caps.length * 10 + ((m.to >> 3 === 7 || m.to >> 3 === 0) ? 2 : 0) }));
    order.sort((a, b) => b.k - a.k);
    let best = -Infinity, bestI = 0; const a0 = alpha;
    for (const { m, i } of order) {
      const u = p.make(m);
      const s = -this.negamax(depth - 1, -beta, -alpha, ply + 1, ext);
      p.unmake(m, u);
      if (this.stop) return 0;
      if (s > best) { best = s; bestI = i; }
      if (s > alpha) alpha = s;
      if (alpha >= beta) break;
    }
    if (!this.stop) this.tt.set(key, { depth, score: best, flag: best <= a0 ? 2 : best >= beta ? 1 : 0, move: bestI });
    return best;
  }

  /** Scores every legal move (for the side to move). Returns them best first. */
  scoreMoves(pos: Checkers, depth: number, timeMs: number, style: CheckersStyle = NORMAL_CHECKERS, margin = 0): Array<{ move: Move; score: number }> {
    this.pos = pos.clone(); this.style = style; this.nodes = 0; this.stop = false; this.deadline = Date.now() + timeMs;
    if (this.tt.size > 400000) this.tt.clear();
    const moves = this.pos.moves();
    if (moves.length <= 1) return moves.map((move) => ({ move, score: 0 }));
    let last = moves.map((move) => ({ move, score: 0 }));
    for (let d = 1; d <= depth; d++) {
      const cur: Array<{ move: Move; score: number }> = [];
      let top = -Infinity;
      for (const { move } of last) {
        // moves within `margin` of the best get exact scores; worse ones may come back as upper bounds
        const lo = top === -Infinity ? -Infinity : top - margin - 1;
        const u = this.pos.make(move);
        const s = -this.negamax(d - 1, -Infinity, -lo, 1, 0);
        this.pos.unmake(move, u);
        if (this.stop) break;
        cur.push({ move, score: s });
        if (s > top) top = s;
      }
      if (this.stop) {
        if (d === 1) return last;
        break;
      }
      cur.sort((a, b) => b.score - a.score);
      last = cur;
      if (Math.abs(cur[0].score) > WIN - 100) break;
      if (Date.now() > this.deadline) break;
    }
    return last;
  }
}

let seed = (Date.now() ^ 0x9e3779b1) >>> 0;
export const setCheckersSeed = (s: number) => { seed = (s >>> 0) || 1; };
const rand = () => { seed ^= seed << 13; seed >>>= 0; seed ^= seed >>> 17; seed ^= seed << 5; seed >>>= 0; return seed / 4294967296; };

/** Pick a move the way a player of this skill and style would. Score is from the mover's view. */
export function checkersBotMove(searcher: CheckersSearcher, pos: Checkers, skill: Skill, style: CheckersStyle): { move: Move; score: number } | null {
  const lapse = rand() < skill.lapse;
  const depth = lapse ? 1 : skill.depth;
  const margin = lapse ? Math.max(skill.margin, 120) : skill.margin;
  const list = searcher.scoreMoves(pos, depth, skill.timeMs, style, margin);
  if (!list.length) return null;
  const top = list[0].score;
  const cands = list.filter((c) => c.score >= top - margin);
  if (cands.length === 1 || skill.temperature <= 0) return { move: cands[0].move, score: cands[0].score };
  const w = cands.map((c) => Math.exp((c.score - top) / skill.temperature));
  let r = rand() * w.reduce((a, b) => a + b, 0);
  for (let i = 0; i < cands.length; i++) { r -= w[i]; if (r <= 0) return { move: cands[i].move, score: cands[i].score }; }
  return { move: cands[0].move, score: cands[0].score };
}
void MAN; void WHITE;
