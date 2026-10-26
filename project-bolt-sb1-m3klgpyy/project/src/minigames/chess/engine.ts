// A chess engine for the bots, hints and analysis: alpha-beta search with a transposition table, quiescence search,
// killer / history move ordering, null-move pruning and a hand-tuned evaluation. Bot strength and personality come from
// SearchStyle (what the evaluation likes) and Skill (how deep it looks and how often it errs).
import { Position, moveFrom, moveTo, movePromo, moveFlags, F_CAPTURE, F_EP, fileOf, rankOf, P, N, B, R, Q, K, type Color } from './rules';

export const MATE = 30000;
const INF = 32000;
const VAL_MG = [0, 82, 337, 365, 477, 1025, 0], VAL_EG = [0, 94, 281, 297, 512, 936, 0];

/** What the bot's evaluation likes. All values are around 1 (normal). */
export type SearchStyle = {
  /** more points for pieces near the enemy king and pushed pawns */ aggression: number;
  /** more points for a safe king and a pawn shield */ safety: number;
  /** more points for good pawn structure and well-placed pieces */ positional: number;
  /** how much a piece is worth (lower than 1: sacrifices for activity) */ material: number;
  /** a liking for trading pieces when ahead and keeping them when behind */ trades: number;
  /** prefers knights (>1) or bishops (<1) */ knights: number;
  /** bonus for moving the queen early / actively */ queenLust: number;
  /** a bonus for pawns that went forward (space) */ space: number;
};
export const NORMAL_STYLE: SearchStyle = { aggression: 1, safety: 1, positional: 1, material: 1, trades: 1, knights: 1, queenLust: 1, space: 1 };

/** How a bot picks its move. */
export type Skill = {
  depth: number; // search depth (plies)
  timeMs: number; // time cap per move
  /** moves within this many centipawns of the best are all candidates */ margin: number;
  /** randomness among the candidates in centipawns (0 = always the best candidate) */ temperature: number;
  /** chance (0..1) of a lapse: the bot looks only one move ahead for this move */ lapse: number;
};

// ---------- evaluation ----------
const PHASE_W = [0, 0, 1, 1, 2, 4, 0];
const CENTER_DIST = Array.from({ length: 64 }, (_, s) => { const f = fileOf(s), r = rankOf(s); return Math.max(Math.abs(f - 3.5), Math.abs(r - 3.5)) - 0.5; }); // 0 in the middle ... 3 in a corner

const KING_ZONE: number[][] = Array.from({ length: 64 }, (_, s) => {
  const out: number[] = [];
  for (let t = 0; t < 64; t++) if (Math.max(Math.abs(fileOf(t) - fileOf(s)), Math.abs(rankOf(t) - rankOf(s))) <= 2) out.push(t);
  return out;
});

const DIRS: Array<[number, number]> = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
function slideCount(b: Int8Array, sq: number, d0: number, d1: number, sign: number): number {
  let n = 0;
  const f = sq & 7, r = sq >> 3;
  for (let d = d0; d < d1; d++) {
    let x = f + DIRS[d][0], y = r + DIRS[d][1];
    while (x >= 0 && x < 8 && y >= 0 && y < 8) {
      const p = b[y * 8 + x];
      if (!p) n++; else { if (p * sign < 0) n++; break; }
      x += DIRS[d][0]; y += DIRS[d][1];
    }
  }
  return n;
}

/** Evaluation in centipawns from WHITE's point of view. */
export function evaluate(pos: Position, st: SearchStyle = NORMAL_STYLE): number {
  const b = pos.board;
  let mg = 0, eg = 0, phase = 0;
  const pawnsOn: number[][] = [[0, 0, 0, 0, 0, 0, 0, 0], [0, 0, 0, 0, 0, 0, 0, 0]]; // pawns per file
  for (let s = 0; s < 64; s++) {
    const p = b[s];
    if (p === P) pawnsOn[0][s & 7]++;
    else if (p === -P) pawnsOn[1][s & 7]++;
  }
  let wBishops = 0, bBishops = 0;
  const matMul = st.material;
  const ek = [pos.kingSq[1], pos.kingSq[0]]; // the king each side attacks: white attacks black's king
  for (let s = 0; s < 64; s++) {
    const p = b[s];
    if (!p) continue;
    const t = Math.abs(p), white = p > 0, sign = white ? 1 : -1;
    const f = s & 7, r = white ? s >> 3 : 7 - (s >> 3); // r = rank from the owner's side
    phase += PHASE_W[t];
    let m = VAL_MG[t] * (t === K ? 1 : matMul), e = VAL_EG[t] * (t === K ? 1 : matMul);
    const cd = CENTER_DIST[s];
    const enemyKing = white ? ek[0] : ek[1];
    const dKing = Math.max(Math.abs(f - fileOf(enemyKing)), Math.abs((s >> 3) - rankOf(enemyKing)));
    if (t === P) {
      m += r * 4 * st.space + (3 - Math.abs(f - 3.5) + 0.5) * (r >= 2 ? 3 : 0);
      e += r * r * 1.6;
      // passed pawn: no enemy pawn ahead on this or the neighbouring files
      let passed = true;
      for (let ff = Math.max(0, f - 1); ff <= Math.min(7, f + 1) && passed; ff++) {
        for (let rr = (s >> 3) + (white ? 1 : -1); rr >= 0 && rr < 8; rr += white ? 1 : -1) if (b[rr * 8 + ff] === (white ? -P : P)) { passed = false; break; }
      }
      if (passed) { m += r * r * 1.2 * st.positional; e += r * r * 4.5 * st.positional; }
      if (pawnsOn[white ? 0 : 1][f] > 1) { m -= 7 * st.positional; e -= 11 * st.positional; } // doubled
      const nb = (f > 0 ? pawnsOn[white ? 0 : 1][f - 1] : 0) + (f < 7 ? pawnsOn[white ? 0 : 1][f + 1] : 0);
      if (!nb) { m -= 9 * st.positional; e -= 12 * st.positional; } // isolated
      if (dKing <= 3 && r >= 3) m += (4 - dKing) * 2.5 * (st.aggression - 0.7); // pawn storm
    } else if (t === N) {
      m += -cd * 11 * st.positional - 4; e += -cd * 8 + 0;
      m += 6 * (st.knights - 1) * 3; e += 4 * (st.knights - 1) * 3;
      if (r >= 3 && r <= 5 && f >= 2 && f <= 5) { // an outpost: protected by a pawn and not chased by an enemy pawn
        const behind = white ? s - 8 : s + 8;
        const guard = (f > 0 && b[behind - 1] === (white ? P : -P)) || (f < 7 && b[behind + 1] === (white ? P : -P));
        if (guard) m += 12 * st.positional;
      }
      m += (6 - dKing) * 1.4 * (st.aggression - 0.6);
    } else if (t === B) {
      if (white) wBishops++; else bBishops++;
      const mob = slideCount(b, s, 4, 8, sign);
      m += (mob - 6) * 4.2 * st.positional; e += (mob - 6) * 4.5;
      m -= (st.knights - 1) * 14;
      m += (6 - dKing) * 1.2 * (st.aggression - 0.6);
    } else if (t === R) {
      const mob = slideCount(b, s, 0, 4, sign);
      m += (mob - 7) * 1.6 * st.positional; e += (mob - 7) * 3.2;
      const own = pawnsOn[white ? 0 : 1][f], their = pawnsOn[white ? 1 : 0][f];
      if (!own && !their) m += 17 * st.positional; else if (!own) m += 8 * st.positional;
      if (r === 6) { m += 18 * st.positional; e += 22; } // the seventh rank
      m += (7 - dKing) * 0.8 * (st.aggression - 0.6);
    } else if (t === Q) {
      const mob = slideCount(b, s, 0, 8, sign);
      m += (mob - 14) * 0.9; e += (mob - 14) * 2.2;
      if (r > 0 && (s !== (white ? 3 : 59))) m += st.queenLust * 4 - 4;
      m += (7 - dKing) * 1.6 * (st.aggression - 0.5);
    } else { // king
      const shieldDir = white ? 1 : -1;
      let shield = 0, open = 0;
      for (let ff = Math.max(0, f - 1); ff <= Math.min(7, f + 1); ff++) {
        const r1 = (s >> 3) + shieldDir, r2 = (s >> 3) + 2 * shieldDir;
        if (r1 >= 0 && r1 < 8 && b[r1 * 8 + ff] === (white ? P : -P)) shield += 2;
        else if (r2 >= 0 && r2 < 8 && b[r2 * 8 + ff] === (white ? P : -P)) shield += 1;
        if (!pawnsOn[white ? 0 : 1][ff]) open++;
      }
      m += (shield * 7 - open * 11) * st.safety;
      e += -cd * 18 + 0; // the king belongs in the middle in the endgame
      m += -cd * -5 + (r === 0 ? 14 : -r * 12) * st.safety; // the middlegame king stays home
    }
    // piece-square: pieces like the middle
    if (t !== P && t !== K && t !== N) { m += -cd * 4 * st.positional; e += -cd * 3; }
    if (white) { mg += m; eg += e; } else { mg -= m; eg -= e; }
  }
  if (wBishops >= 2) { mg += 30; eg += 45; }
  if (bBishops >= 2) { mg -= 30; eg -= 45; }
  const ph = Math.min(24, phase) / 24;
  let score = mg * ph + eg * (1 - ph);
  // trades: the side that is ahead likes fewer pieces, the other side does not
  if (st.trades !== 1) {
    const nonPawn = Math.min(24, phase);
    score += (score > 0 ? 1 : -1) * (24 - nonPawn) * (st.trades - 1) * 1.6;
  }
  return Math.round(score);
}

// ---------- transposition table ----------
const TT_BITS = 19, TT_SIZE = 1 << TT_BITS, TT_MASK = TT_SIZE - 1;
class TT {
  lo = new Int32Array(TT_SIZE); hi = new Int32Array(TT_SIZE); score = new Int16Array(TT_SIZE);
  depth = new Int8Array(TT_SIZE); flag = new Int8Array(TT_SIZE); move = new Int32Array(TT_SIZE);
  clear() { this.lo.fill(0); this.hi.fill(0); this.depth.fill(-1); }
}

export type SearchLine = { move: number; score: number; pv: number[] };
export type SearchResult = { move: number; score: number; depth: number; nodes: number; pv: number[]; lines?: SearchLine[] };
const mateAdjust = (score: number, ply: number) => (score > MATE - 200 ? score + ply : score < -MATE + 200 ? score - ply : score);
const mateUnadjust = (score: number, ply: number) => (score > MATE - 200 ? score - ply : score < -MATE + 200 ? score + ply : score);

const MVV = [0, 100, 320, 330, 500, 900, 20000];
export class Searcher {
  private tt = new TT();
  private nodes = 0;
  private stop = false;
  private deadline = 0;
  private killers: number[][] = Array.from({ length: 128 }, () => [0, 0]);
  private history = new Int32Array(64 * 64 * 2);
  private path: number[] = [];
  private style: SearchStyle = NORMAL_STYLE;
  private pos!: Position;
  private rootExclude: Set<number> = new Set();

  newGame() { this.tt.clear(); this.history.fill(0); }

  private evalStm(): number {
    const e = evaluate(this.pos, this.style);
    return this.pos.turn === 0 ? e : -e;
  }
  private isRepeat(): boolean {
    const n = this.path.length;
    const k = this.path[n - 1];
    const lim = Math.min(this.pos.half, n - 1);
    for (let i = 4; i <= lim; i += 2) if (this.path[n - 1 - i] === k) return true;
    return false;
  }

  private score(m: number, ttMove: number, ply: number): number {
    if (m === ttMove) return 1e7;
    const b = this.pos.board;
    const flags = moveFlags(m);
    if (flags & F_CAPTURE) {
      const victim = flags & F_EP ? P : Math.abs(b[moveTo(m)]);
      return 1e6 + MVV[victim] * 10 - MVV[Math.abs(b[moveFrom(m)])] / 10 + (movePromo(m) ? 5000 : 0);
    }
    if (movePromo(m)) return 9e5 + movePromo(m);
    const k = this.killers[ply];
    if (m === k[0]) return 8e5;
    if (m === k[1]) return 7e5;
    return this.history[(this.pos.turn * 64 + moveFrom(m)) * 64 + moveTo(m)];
  }

  private quiesce(alpha: number, beta: number, ply: number): number {
    if ((++this.nodes & 2047) === 0 && Date.now() > this.deadline) this.stop = true;
    if (this.stop) return 0;
    const stand = this.evalStm();
    if (stand >= beta) return stand;
    if (stand > alpha) alpha = stand;
    if (ply > 60) return stand;
    const pos = this.pos, us = pos.turn;
    const moves = pos.pseudoMoves([], true);
    const sc = moves.map((m) => this.score(m, 0, ply));
    for (let i = 0; i < moves.length; i++) {
      let bi = i;
      for (let j = i + 1; j < moves.length; j++) if (sc[j] > sc[bi]) bi = j;
      if (bi !== i) { [moves[i], moves[bi]] = [moves[bi], moves[i]]; [sc[i], sc[bi]] = [sc[bi], sc[i]]; }
      const m = moves[i];
      // delta pruning: even winning the piece cannot raise alpha
      const victim = moveFlags(m) & F_EP ? P : Math.abs(pos.board[moveTo(m)]);
      if (!movePromo(m) && stand + MVV[victim] + 200 < alpha) continue;
      pos.make(m);
      if (pos.attacked(pos.kingSq[us], (1 - us) as Color)) { pos.unmake(); continue; }
      this.path.push(pos.key());
      const s = -this.quiesce(-beta, -alpha, ply + 1);
      this.path.pop();
      pos.unmake();
      if (this.stop) return 0;
      if (s >= beta) return s;
      if (s > alpha) alpha = s;
    }
    return alpha;
  }

  private negamax(depth: number, alpha: number, beta: number, ply: number, canNull: boolean): number {
    if ((++this.nodes & 2047) === 0 && Date.now() > this.deadline) this.stop = true;
    if (this.stop) return 0;
    const pos = this.pos, us = pos.turn;
    if (ply > 0 && (pos.half >= 100 || this.isRepeat())) return 0;
    const inCheck = pos.inCheck();
    if (inCheck) depth++;
    if (depth <= 0) return this.quiesce(alpha, beta, ply);
    if (ply > 100) return this.evalStm();

    // transposition table
    const idx = pos.lo & TT_MASK;
    let ttMove = 0;
    if (this.tt.lo[idx] === (pos.lo | 0) && this.tt.hi[idx] === pos.hi && this.tt.depth[idx] >= 0) {
      ttMove = this.tt.move[idx];
      if (this.tt.depth[idx] >= depth && ply > 0) {
        const s = mateUnadjust(this.tt.score[idx], ply), f = this.tt.flag[idx];
        if (f === 0) return s;
        if (f === 1 && s >= beta) return s;
        if (f === 2 && s <= alpha) return s;
      }
    }
    const pv = beta - alpha > 1;
    // null move: give the opponent a free move; if we are still fine, this node is a cutoff
    if (canNull && !pv && !inCheck && depth >= 3 && this.hasPieces(us)) {
      const ev = this.evalStm();
      if (ev >= beta) {
        const saved = pos.makeNull();
        this.path.push(pos.key());
        const s = -this.negamax(depth - 3, -beta, -beta + 1, ply + 1, false);
        this.path.pop();
        pos.unmakeNull(saved);
        if (this.stop) return 0;
        if (s >= beta) return s >= MATE - 200 ? beta : s;
      }
    }
    const moves = pos.pseudoMoves();
    const sc = moves.map((m) => this.score(m, ttMove, ply));
    let best = -INF, bestMove = 0, legal = 0;
    const origAlpha = alpha;
    for (let i = 0; i < moves.length; i++) {
      let bi = i;
      for (let j = i + 1; j < moves.length; j++) if (sc[j] > sc[bi]) bi = j;
      if (bi !== i) { [moves[i], moves[bi]] = [moves[bi], moves[i]]; [sc[i], sc[bi]] = [sc[bi], sc[i]]; }
      const m = moves[i];
      pos.make(m);
      if (pos.attacked(pos.kingSq[us], (1 - us) as Color)) { pos.unmake(); continue; }
      legal++;
      this.path.push(pos.key());
      const quiet = !(moveFlags(m) & F_CAPTURE) && !movePromo(m);
      let s: number;
      const gives = pos.inCheck();
      if (legal === 1) s = -this.negamax(depth - 1, -beta, -alpha, ply + 1, true);
      else {
        // later quiet moves are searched a bit shallower first (late move reductions)
        const red = quiet && !inCheck && !gives && depth >= 3 && legal > 4 ? 1 : 0;
        s = -this.negamax(depth - 1 - red, -alpha - 1, -alpha, ply + 1, true);
        if (s > alpha && (red || s < beta)) s = -this.negamax(depth - 1, -beta, -alpha, ply + 1, true);
      }
      this.path.pop();
      pos.unmake();
      if (this.stop) return 0;
      if (s > best) { best = s; bestMove = m; }
      if (s > alpha) {
        alpha = s;
        if (alpha >= beta) {
          if (quiet) {
            const k = this.killers[ply];
            if (k[0] !== m) { k[1] = k[0]; k[0] = m; }
            this.history[(us * 64 + moveFrom(m)) * 64 + moveTo(m)] += depth * depth;
          }
          break;
        }
      }
    }
    if (!legal) return inCheck ? -MATE + ply : 0;
    const flag = best >= beta ? 1 : best > origAlpha ? 0 : 2;
    this.tt.lo[idx] = pos.lo | 0; this.tt.hi[idx] = pos.hi; this.tt.score[idx] = mateAdjust(best, ply);
    this.tt.depth[idx] = depth; this.tt.flag[idx] = flag; this.tt.move[idx] = bestMove;
    return best;
  }

  private hasPieces(color: Color): boolean {
    const b = this.pos.board, sign = color === 0 ? 1 : -1;
    for (let s = 0; s < 64; s++) { const p = b[s] * sign; if (p > 1 && p < 6) return true; }
    return false;
  }

  /** Reads the principal variation out of the table. */
  private pvFrom(first: number, max = 12): number[] {
    const pos = this.pos, line: number[] = [first];
    pos.make(first);
    let n = 1;
    for (; n < max; n++) {
      const idx = pos.lo & TT_MASK;
      if (this.tt.lo[idx] !== (pos.lo | 0) || this.tt.hi[idx] !== pos.hi || this.tt.depth[idx] < 0) break;
      const m = this.tt.move[idx];
      if (!m || !pos.moves().includes(m)) break;
      line.push(m); pos.make(m);
    }
    for (let i = 0; i < n; i++) pos.unmake();
    return line;
  }

  /**
   * Searches `pos` with iterative deepening. `keys` are the position keys of the game so far (for repetitions).
   * Returns the best move, its score (centipawns for the side to move, or +-(MATE - plies)) and the main line.
   */
  search(pos: Position, opts: { depth: number; timeMs: number; style?: SearchStyle; keys?: number[]; exclude?: number[]; onDepth?: (r: SearchResult) => void }): SearchResult {
    this.pos = pos.clone();
    this.style = opts.style ?? NORMAL_STYLE;
    this.path = [...(opts.keys ?? []), this.pos.key()];
    this.nodes = 0; this.stop = false; this.deadline = Date.now() + opts.timeMs;
    this.rootExclude = new Set(opts.exclude ?? []);
    for (const k of this.killers) { k[0] = 0; k[1] = 0; }
    const root = this.pos.moves().filter((m) => !this.rootExclude.has(m));
    if (!root.length) return { move: 0, score: this.pos.inCheck() ? -MATE : 0, depth: 0, nodes: 0, pv: [] };
    let result: SearchResult = { move: root[0], score: 0, depth: 0, nodes: 0, pv: [root[0]] };
    let order = root.slice();
    for (let d = 1; d <= opts.depth; d++) {
      let alpha = -INF, bestMove = 0, bestScore = -INF;
      const scores: number[] = [];
      const us = this.pos.turn;
      for (let i = 0; i < order.length; i++) {
        const m = order[i];
        this.pos.make(m);
        this.path.push(this.pos.key());
        let s: number;
        if (i === 0) s = -this.negamax(d - 1, -INF, -alpha, 1, true);
        else {
          s = -this.negamax(d - 1, -alpha - 1, -alpha, 1, true);
          if (s > alpha && !this.stop) s = -this.negamax(d - 1, -INF, -alpha, 1, true);
        }
        this.path.pop();
        this.pos.unmake();
        if (this.stop) break;
        scores.push(s);
        if (s > bestScore) { bestScore = s; bestMove = m; }
        if (s > alpha) alpha = s;
      }
      void us;
      if (this.stop) {
        if (bestMove && d > 1 && bestScore > result.score - 150) { /* a partly finished depth: keep the best found if it did not collapse */ result = { ...result, move: bestMove, score: bestScore, nodes: this.nodes, pv: this.pvFrom(bestMove) }; }
        break;
      }
      result = { move: bestMove, score: bestScore, depth: d, nodes: this.nodes, pv: this.pvFrom(bestMove) };
      // best move first on the next pass
      order = [bestMove, ...order.filter((m) => m !== bestMove)];
      opts.onDepth?.(result);
      if (Math.abs(bestScore) >= MATE - 100) break; // a forced mate is found
      if (Date.now() > this.deadline) break;
    }
    result.nodes = this.nodes;
    return result;
  }

  /** The best `n` lines (like MultiPV): each line is searched with the earlier first moves left out. */
  analyze(pos: Position, n: number, opts: { depth: number; timeMs: number; style?: SearchStyle; keys?: number[] }): SearchLine[] {
    const lines: SearchLine[] = [];
    const exclude: number[] = [];
    for (let i = 0; i < n; i++) {
      const r = this.search(pos, { ...opts, exclude });
      if (!r.move) break;
      lines.push({ move: r.move, score: r.score, pv: r.pv });
      exclude.push(r.move);
    }
    return lines;
  }

  /**
   * Scores every legal move from the root with a search of the given depth: exact within `margin` of the best, an upper bound below.
   * Used by the bots to choose among nearly-equal moves.
   */
  scoreRootMoves(pos: Position, opts: { depth: number; timeMs: number; margin: number; style?: SearchStyle; keys?: number[] }): Array<{ move: number; score: number }> {
    const best = this.search(pos, { depth: opts.depth, timeMs: opts.timeMs, style: opts.style, keys: opts.keys });
    if (!best.move) return [];
    this.pos = pos.clone();
    this.path = [...(opts.keys ?? []), this.pos.key()];
    this.stop = false; this.deadline = Date.now() + Math.max(80, opts.timeMs * 0.8);
    const out: Array<{ move: number; score: number }> = [{ move: best.move, score: best.score }];
    const floor = best.score - opts.margin;
    for (const m of this.pos.moves()) {
      if (m === best.move) continue;
      this.pos.make(m);
      this.path.push(this.pos.key());
      // window just around the floor: a score above it comes back exact, anything lower fails low
      const s = -this.negamax(Math.max(0, opts.depth - 1), -best.score - 1, -(floor - 1), 1, true);
      this.path.pop();
      this.pos.unmake();
      if (this.stop) break;
      if (s >= floor) out.push({ move: m, score: s });
    }
    return out;
  }
}

// ---------- picking a move like a player of a given strength ----------
let rngSeed = (Date.now() ^ 0x5bd1e995) >>> 0;
export const setEngineSeed = (s: number) => { rngSeed = (s >>> 0) || 1; };
const rand = () => { rngSeed ^= rngSeed << 13; rngSeed >>>= 0; rngSeed ^= rngSeed >>> 17; rngSeed ^= rngSeed << 5; rngSeed >>>= 0; return rngSeed / 4294967296; };

/** Chooses the move a bot of this skill and style would play. */
export function botMove(searcher: Searcher, pos: Position, skill: Skill, style: SearchStyle, keys: number[] = []): { move: number; score: number; depth: number } {
  const lapse = rand() < skill.lapse;
  const depth = lapse ? 1 : skill.depth;
  const margin = lapse ? Math.max(skill.margin, 250) : skill.margin;
  if (margin <= 0 && skill.temperature <= 0) {
    const r = searcher.search(pos, { depth, timeMs: skill.timeMs, style, keys });
    return { move: r.move, score: r.score, depth: r.depth };
  }
  const cands = searcher.scoreRootMoves(pos, { depth, timeMs: skill.timeMs, margin, style, keys });
  if (!cands.length) return { move: 0, score: 0, depth: 0 };
  if (cands.length === 1 || skill.temperature <= 0) {
    const top = cands.reduce((a, c) => (c.score > a.score ? c : a));
    return { move: top.move, score: top.score, depth };
  }
  const top = Math.max(...cands.map((c) => c.score));
  const weights = cands.map((c) => Math.exp((c.score - top) / skill.temperature));
  let r = rand() * weights.reduce((a, b) => a + b, 0);
  for (let i = 0; i < cands.length; i++) { r -= weights[i]; if (r <= 0) return { move: cands[i].move, score: cands[i].score, depth }; }
  return { move: cands[0].move, score: cands[0].score, depth };
}

/** Score as text for the interface: "+1.3", "-0.4", "#3" (mate in 3), from White's point of view. */
export function scoreText(whiteScore: number): string {
  if (Math.abs(whiteScore) >= MATE - 200) {
    const n = Math.ceil((MATE - Math.abs(whiteScore)) / 2);
    return (whiteScore > 0 ? '#' : '-#') + Math.max(1, n);
  }
  const v = whiteScore / 100;
  return (v > 0 ? '+' : '') + v.toFixed(1);
}
/** Fraction of the eval bar that is white (0..1) for a score from White's point of view. */
export function barFraction(whiteScore: number): number {
  if (whiteScore >= MATE - 200) return 1;
  if (whiteScore <= -MATE + 200) return 0;
  return 1 / (1 + Math.exp(-whiteScore / 220));
}
export { K as KING };
void N; void B; void R; void Q;
