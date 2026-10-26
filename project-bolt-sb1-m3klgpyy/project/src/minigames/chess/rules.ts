// Chess rules: positions, legal moves, check/mate/draw detection, FEN, move notation (SAN/UCI) and PGN.
// Written from scratch for VibeBlox. Squares are numbered 0..63 with a1 = 0, b1 = 1 ... h1 = 7, a2 = 8 ... h8 = 63.
// Pieces: white 1..6, black -1..-6 (pawn, knight, bishop, rook, queen, king), 0 = empty.
// A move is one integer: from | to << 6 | promotion << 12 | flags << 16.

export const P = 1, N = 2, B = 3, R = 4, Q = 5, K = 6;
export type Color = 0 | 1; // 0 = white, 1 = black
export const WHITE: Color = 0, BLACK: Color = 1;

export const F_CAPTURE = 1, F_EP = 2, F_CASTLE_K = 4, F_CASTLE_Q = 8, F_DOUBLE = 16;
export const moveFrom = (m: number) => m & 63;
export const moveTo = (m: number) => (m >> 6) & 63;
export const movePromo = (m: number) => (m >> 12) & 7;
export const moveFlags = (m: number) => m >> 16;
export const mkMove = (from: number, to: number, promo = 0, flags = 0) => from | (to << 6) | (promo << 12) | (flags << 16);

export const fileOf = (sq: number) => sq & 7;
export const rankOf = (sq: number) => sq >> 3;
export const sqName = (sq: number) => 'abcdefgh'[sq & 7] + (1 + (sq >> 3));
export const parseSq = (s: string): number => {
  if (!/^[a-h][1-8]$/.test(s)) return -1;
  return (s.charCodeAt(0) - 97) + (s.charCodeAt(1) - 49) * 8;
};
export const pieceColor = (p: number): Color => (p > 0 ? 0 : 1);
const PIECE_CHARS = ' PNBRQK';
export const pieceChar = (p: number) => (p > 0 ? PIECE_CHARS[p] : PIECE_CHARS[-p].toLowerCase());

export const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

// ---------- tables ----------
const KNIGHT_D = [[1, 2], [2, 1], [2, -1], [1, -2], [-1, -2], [-2, -1], [-2, 1], [-1, 2]];
const KING_D = [[1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1]];
const KNIGHT_MOVES: number[][] = [], KING_MOVES: number[][] = [];
/** RAYS[sq][dir] lists the squares going outward; dirs 0-3 are rook-like, 4-7 bishop-like. */
const RAYS: number[][][] = [];
const ROOK_DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]], BISHOP_DIRS = [[1, 1], [1, -1], [-1, 1], [-1, -1]];
for (let sq = 0; sq < 64; sq++) {
  const f = sq & 7, r = sq >> 3;
  KNIGHT_MOVES.push(KNIGHT_D.map(([a, b]) => [f + a, r + b]).filter(([x, y]) => x >= 0 && x < 8 && y >= 0 && y < 8).map(([x, y]) => y * 8 + x));
  KING_MOVES.push(KING_D.map(([a, b]) => [f + a, r + b]).filter(([x, y]) => x >= 0 && x < 8 && y >= 0 && y < 8).map(([x, y]) => y * 8 + x));
  RAYS.push([...ROOK_DIRS, ...BISHOP_DIRS].map(([a, b]) => {
    const line: number[] = [];
    let x = f + a, y = r + b;
    while (x >= 0 && x < 8 && y >= 0 && y < 8) { line.push(y * 8 + x); x += a; y += b; }
    return line;
  }));
}

// ---------- zobrist hashing (two 32-bit halves) ----------
let seed = 0x9e3779b9;
const rnd32 = () => { seed ^= seed << 13; seed >>>= 0; seed ^= seed >>> 17; seed ^= seed << 5; seed >>>= 0; return seed >>> 0; };
const Z_PIECE_LO: number[][] = [], Z_PIECE_HI: number[][] = []; // [piece index 0..12][sq]
for (let i = 0; i < 13; i++) { Z_PIECE_LO.push([]); Z_PIECE_HI.push([]); for (let s = 0; s < 64; s++) { Z_PIECE_LO[i].push(rnd32()); Z_PIECE_HI[i].push(rnd32() & 0x1fffff); } }
const Z_SIDE_LO = rnd32(), Z_SIDE_HI = rnd32() & 0x1fffff;
const Z_CASTLE_LO = Array.from({ length: 16 }, rnd32), Z_CASTLE_HI = Array.from({ length: 16 }, () => rnd32() & 0x1fffff);
const Z_EP_LO = Array.from({ length: 8 }, rnd32), Z_EP_HI = Array.from({ length: 8 }, () => rnd32() & 0x1fffff);
const pIdx = (p: number) => (p > 0 ? p : 6 - p); // 1..6 white, 7..12 black

type Undo = { move: number; captured: number; castling: number; ep: number; half: number; lo: number; hi: number };

export class Position {
  board = new Int8Array(64);
  turn: Color = 0;
  castling = 0; // 1 = white short, 2 = white long, 4 = black short, 8 = black long
  ep = -1; // the square a pawn could capture onto en passant
  half = 0;
  full = 1;
  lo = 0; hi = 0;
  kingSq: [number, number] = [4, 60];
  private stack: Undo[] = [];

  static start(): Position { return Position.fromFen(START_FEN); }

  static fromFen(fen: string): Position {
    const pos = new Position();
    const parts = fen.trim().split(/\s+/);
    const rows = parts[0].split('/');
    if (rows.length !== 8) throw new Error('Bad FEN: ranks');
    for (let r = 0; r < 8; r++) {
      let f = 0;
      for (const ch of rows[7 - r]) {
        if (/[1-8]/.test(ch)) f += Number(ch);
        else {
          const t = PIECE_CHARS.indexOf(ch.toUpperCase());
          if (t < 1 || f > 7) throw new Error('Bad FEN: piece');
          pos.board[r * 8 + f] = ch === ch.toUpperCase() ? t : -t;
          f++;
        }
      }
      if (f !== 8) throw new Error('Bad FEN: rank length');
    }
    pos.turn = parts[1] === 'b' ? 1 : 0;
    const c = parts[2] ?? '-';
    pos.castling = (c.includes('K') ? 1 : 0) | (c.includes('Q') ? 2 : 0) | (c.includes('k') ? 4 : 0) | (c.includes('q') ? 8 : 0);
    pos.ep = parts[3] && parts[3] !== '-' ? parseSq(parts[3]) : -1;
    pos.half = Number(parts[4] ?? 0) || 0;
    pos.full = Number(parts[5] ?? 1) || 1;
    let wk = -1, bk = -1;
    for (let s = 0; s < 64; s++) { if (pos.board[s] === K) wk = s; else if (pos.board[s] === -K) bk = s; }
    if (wk < 0 || bk < 0) throw new Error('Bad FEN: kings');
    pos.kingSq = [wk, bk];
    pos.computeHash();
    return pos;
  }

  clone(): Position {
    const p = new Position();
    p.board.set(this.board);
    p.turn = this.turn; p.castling = this.castling; p.ep = this.ep; p.half = this.half; p.full = this.full;
    p.lo = this.lo; p.hi = this.hi; p.kingSq = [this.kingSq[0], this.kingSq[1]];
    return p;
  }

  private computeHash() {
    let lo = 0, hi = 0;
    for (let s = 0; s < 64; s++) { const p = this.board[s]; if (p) { lo ^= Z_PIECE_LO[pIdx(p)][s]; hi ^= Z_PIECE_HI[pIdx(p)][s]; } }
    if (this.turn) { lo ^= Z_SIDE_LO; hi ^= Z_SIDE_HI; }
    lo ^= Z_CASTLE_LO[this.castling]; hi ^= Z_CASTLE_HI[this.castling];
    if (this.ep >= 0 && this.epCapturable()) { lo ^= Z_EP_LO[this.ep & 7]; hi ^= Z_EP_HI[this.ep & 7]; }
    this.lo = lo >>> 0; this.hi = hi;
  }
  /** A number that is the same for the same position (pieces, side to move, castling, en passant). */
  key(): number { return this.hi * 4294967296 + this.lo; }

  private epCapturable(): boolean {
    // only counts for the hash when a pawn of the side to move can really take it
    const t = this.turn, ep = this.ep;
    const pawn = t === 0 ? P : -P;
    const r = rankOf(ep), f = fileOf(ep);
    const fromRank = t === 0 ? r - 1 : r + 1;
    for (const df of [-1, 1]) { const ff = f + df; if (ff >= 0 && ff < 8 && this.board[fromRank * 8 + ff] === pawn) return true; }
    return false;
  }

  toFen(): string {
    let s = '';
    for (let r = 7; r >= 0; r--) {
      let empty = 0;
      for (let f = 0; f < 8; f++) {
        const p = this.board[r * 8 + f];
        if (!p) empty++;
        else { if (empty) { s += empty; empty = 0; } s += pieceChar(p); }
      }
      if (empty) s += empty;
      if (r) s += '/';
    }
    const c = (this.castling & 1 ? 'K' : '') + (this.castling & 2 ? 'Q' : '') + (this.castling & 4 ? 'k' : '') + (this.castling & 8 ? 'q' : '');
    return `${s} ${this.turn ? 'b' : 'w'} ${c || '-'} ${this.ep >= 0 ? sqName(this.ep) : '-'} ${this.half} ${this.full}`;
  }

  // ---------- attacks ----------
  /** Is `sq` attacked by any piece of colour `by`? */
  attacked(sq: number, by: Color): boolean {
    const b = this.board;
    const sign = by === 0 ? 1 : -1;
    // pawns
    const f = sq & 7, r = sq >> 3;
    const pr = by === 0 ? r - 1 : r + 1;
    if (pr >= 0 && pr < 8) {
      if (f > 0 && b[pr * 8 + f - 1] === sign * P) return true;
      if (f < 7 && b[pr * 8 + f + 1] === sign * P) return true;
    }
    for (const t of KNIGHT_MOVES[sq]) if (b[t] === sign * N) return true;
    for (const t of KING_MOVES[sq]) if (b[t] === sign * K) return true;
    const rays = RAYS[sq];
    for (let d = 0; d < 8; d++) {
      const ray = rays[d];
      for (let i = 0; i < ray.length; i++) {
        const p = b[ray[i]];
        if (!p) continue;
        if (p * sign > 0) { const t = Math.abs(p); if (t === Q || (d < 4 ? t === R : t === B)) return true; }
        break;
      }
    }
    return false;
  }
  inCheck(color: Color = this.turn): boolean { return this.attacked(this.kingSq[color], (1 - color) as Color); }

  // ---------- move generation ----------
  /** Moves that follow the piece rules but may leave the own king in check. */
  pseudoMoves(out: number[] = [], capturesOnly = false): number[] {
    const b = this.board, us = this.turn, sign = us === 0 ? 1 : -1;
    for (let from = 0; from < 64; from++) {
      const p = b[from];
      if (!p || p * sign < 0) continue;
      const t = Math.abs(p);
      if (t === P) {
        const f = from & 7, r = from >> 3;
        const dir = us === 0 ? 1 : -1, promoRank = us === 0 ? 7 : 0, startRank = us === 0 ? 1 : 6;
        const nr = r + dir;
        if (nr < 0 || nr > 7) continue;
        const addPawn = (to: number, flags: number) => {
          if ((to >> 3) === promoRank) { for (const pr of [Q, R, B, N]) out.push(mkMove(from, to, pr, flags)); }
          else out.push(mkMove(from, to, 0, flags));
        };
        const one = nr * 8 + f;
        if (!b[one] && (!capturesOnly || nr === promoRank)) {
          addPawn(one, 0);
          if (r === startRank && !b[one + dir * 8] && !capturesOnly) out.push(mkMove(from, one + dir * 8, 0, F_DOUBLE));
        }
        for (const df of [-1, 1]) {
          const ff = f + df;
          if (ff < 0 || ff > 7) continue;
          const to = nr * 8 + ff;
          if (b[to] * sign < 0) addPawn(to, F_CAPTURE);
          else if (to === this.ep && !b[to]) out.push(mkMove(from, to, 0, F_EP | F_CAPTURE));
        }
        continue;
      }
      if (t === N || t === K) {
        for (const to of (t === N ? KNIGHT_MOVES : KING_MOVES)[from]) {
          const q = b[to];
          if (q * sign > 0) continue;
          if (q) out.push(mkMove(from, to, 0, F_CAPTURE));
          else if (!capturesOnly) out.push(mkMove(from, to));
        }
        if (t === K && !capturesOnly) this.castleMoves(from, out);
        continue;
      }
      const d0 = t === B ? 4 : 0, d1 = t === R ? 4 : 8;
      for (let d = d0; d < d1; d++) {
        for (const to of RAYS[from][d]) {
          const q = b[to];
          if (!q) { if (!capturesOnly) out.push(mkMove(from, to)); continue; }
          if (q * sign < 0) out.push(mkMove(from, to, 0, F_CAPTURE));
          break;
        }
      }
    }
    return out;
  }

  private castleMoves(from: number, out: number[]) {
    const us = this.turn, them = (1 - us) as Color, b = this.board;
    const home = us === 0 ? 4 : 60;
    if (from !== home || this.attacked(home, them)) return;
    const kBit = us === 0 ? 1 : 4, qBit = us === 0 ? 2 : 8, rook = us === 0 ? R : -R;
    if ((this.castling & kBit) && b[home + 3] === rook && !b[home + 1] && !b[home + 2] && !this.attacked(home + 1, them) && !this.attacked(home + 2, them)) out.push(mkMove(home, home + 2, 0, F_CASTLE_K));
    if ((this.castling & qBit) && b[home - 4] === rook && !b[home - 1] && !b[home - 2] && !b[home - 3] && !this.attacked(home - 1, them) && !this.attacked(home - 2, them)) out.push(mkMove(home, home - 2, 0, F_CASTLE_Q));
  }

  /** Every legal move for the side to move. */
  moves(): number[] {
    const all = this.pseudoMoves();
    const us = this.turn;
    const legal: number[] = [];
    for (const m of all) {
      this.make(m);
      if (!this.attacked(this.kingSq[us], (1 - us) as Color)) legal.push(m);
      this.unmake();
    }
    return legal;
  }
  movesFrom(sq: number): number[] { return this.moves().filter((m) => moveFrom(m) === sq); }
  hasLegalMove(): boolean {
    const us = this.turn;
    for (const m of this.pseudoMoves()) {
      this.make(m);
      const ok = !this.attacked(this.kingSq[us], (1 - us) as Color);
      this.unmake();
      if (ok) return true;
    }
    return false;
  }

  // ---------- make / unmake ----------
  make(m: number) {
    const b = this.board, from = moveFrom(m), to = moveTo(m), promo = movePromo(m), flags = moveFlags(m);
    const piece = b[from], us = this.turn;
    let captured = b[to];
    this.stack.push({ move: m, captured: 0, castling: this.castling, ep: this.ep, half: this.half, lo: this.lo, hi: this.hi });
    const u = this.stack[this.stack.length - 1];
    let lo = this.lo, hi = this.hi;
    // remove the old en passant / castling hash parts
    if (this.ep >= 0 && this.epCapturable()) { lo ^= Z_EP_LO[this.ep & 7]; hi ^= Z_EP_HI[this.ep & 7]; }
    lo ^= Z_CASTLE_LO[this.castling]; hi ^= Z_CASTLE_HI[this.castling];
    lo ^= Z_PIECE_LO[pIdx(piece)][from]; hi ^= Z_PIECE_HI[pIdx(piece)][from];
    if (flags & F_EP) {
      const capSq = us === 0 ? to - 8 : to + 8;
      captured = b[capSq];
      b[capSq] = 0;
      lo ^= Z_PIECE_LO[pIdx(captured)][capSq]; hi ^= Z_PIECE_HI[pIdx(captured)][capSq];
    } else if (captured) { lo ^= Z_PIECE_LO[pIdx(captured)][to]; hi ^= Z_PIECE_HI[pIdx(captured)][to]; }
    u.captured = captured;
    b[from] = 0;
    const placed = promo ? (us === 0 ? promo : -promo) : piece;
    b[to] = placed;
    lo ^= Z_PIECE_LO[pIdx(placed)][to]; hi ^= Z_PIECE_HI[pIdx(placed)][to];
    if (Math.abs(piece) === K) this.kingSq[us] = to;
    if (flags & (F_CASTLE_K | F_CASTLE_Q)) {
      const rf = flags & F_CASTLE_K ? to + 1 : to - 2, rt = flags & F_CASTLE_K ? to - 1 : to + 1;
      const rook = b[rf];
      b[rf] = 0; b[rt] = rook;
      lo ^= Z_PIECE_LO[pIdx(rook)][rf] ^ Z_PIECE_LO[pIdx(rook)][rt]; hi ^= Z_PIECE_HI[pIdx(rook)][rf] ^ Z_PIECE_HI[pIdx(rook)][rt];
    }
    // castling rights
    let c = this.castling;
    if (Math.abs(piece) === K) c &= us === 0 ? ~3 : ~12;
    if (from === 0 || to === 0) c &= ~2;
    if (from === 7 || to === 7) c &= ~1;
    if (from === 56 || to === 56) c &= ~8;
    if (from === 63 || to === 63) c &= ~4;
    this.castling = c;
    this.ep = flags & F_DOUBLE ? (from + to) >> 1 : -1;
    this.half = Math.abs(piece) === P || captured ? 0 : this.half + 1;
    if (us === 1) this.full++;
    this.turn = (1 - us) as Color;
    lo ^= Z_SIDE_LO; hi ^= Z_SIDE_HI;
    lo ^= Z_CASTLE_LO[this.castling]; hi ^= Z_CASTLE_HI[this.castling];
    if (this.ep >= 0 && this.epCapturable()) { lo ^= Z_EP_LO[this.ep & 7]; hi ^= Z_EP_HI[this.ep & 7]; }
    this.lo = lo >>> 0; this.hi = hi;
  }

  unmake() {
    const u = this.stack.pop();
    if (!u) return;
    const b = this.board, m = u.move, from = moveFrom(m), to = moveTo(m), flags = moveFlags(m);
    const them = this.turn, us = (1 - them) as Color;
    if (us === 1) this.full--;
    const placed = b[to];
    const piece = movePromo(m) ? (us === 0 ? P : -P) : placed;
    b[from] = piece;
    b[to] = 0;
    if (flags & F_EP) { b[us === 0 ? to - 8 : to + 8] = u.captured; }
    else b[to] = u.captured;
    if (flags & (F_CASTLE_K | F_CASTLE_Q)) {
      const rf = flags & F_CASTLE_K ? to + 1 : to - 2, rt = flags & F_CASTLE_K ? to - 1 : to + 1;
      b[rf] = b[rt]; b[rt] = 0;
    }
    if (Math.abs(piece) === K) this.kingSq[us] = from;
    this.turn = us; this.castling = u.castling; this.ep = u.ep; this.half = u.half; this.lo = u.lo; this.hi = u.hi;
  }

  /** Make a null move (used by the search to skip a turn). Undo with unmakeNull. */
  makeNull(): number {
    const saved = this.ep;
    this.ep = -1;
    this.turn = (1 - this.turn) as Color;
    this.lo = (this.lo ^ Z_SIDE_LO) >>> 0; this.hi ^= Z_SIDE_HI;
    return saved;
  }
  unmakeNull(savedEp: number) {
    this.turn = (1 - this.turn) as Color;
    this.ep = savedEp;
    this.lo = (this.lo ^ Z_SIDE_LO) >>> 0; this.hi ^= Z_SIDE_HI;
  }

  // ---------- state of the game ----------
  insufficientMaterial(): boolean {
    const minors: Array<{ t: number; sqColor: number }> = [];
    for (let s = 0; s < 64; s++) {
      const p = Math.abs(this.board[s]);
      if (!p || p === K) continue;
      if (p === P || p === R || p === Q) return false;
      minors.push({ t: p, sqColor: ((s >> 3) + (s & 7)) & 1 });
    }
    if (minors.length <= 1) return true; // K vs K, K+minor vs K
    // only bishops, all on the same colour squares
    return minors.every((x) => x.t === B) && minors.every((x) => x.sqColor === minors[0].sqColor);
  }

  // ---------- notation ----------
  uci(m: number): string { return sqName(moveFrom(m)) + sqName(moveTo(m)) + (movePromo(m) ? 'nbrq'[movePromo(m) - 2] : ''); }
  parseUci(s: string): number {
    const from = parseSq(s.slice(0, 2)), to = parseSq(s.slice(2, 4));
    if (from < 0 || to < 0) return 0;
    const promo = s[4] ? 'nbrq'.indexOf(s[4].toLowerCase()) + 2 : 0;
    const m = this.moves().find((x) => moveFrom(x) === from && moveTo(x) === to && movePromo(x) === (promo > 1 ? promo : 0));
    return m ?? 0;
  }

  /** Standard algebraic notation for a legal move (Nf3, exd5, O-O, e8=Q+, Qxh7#). */
  san(m: number, legal: number[] = this.moves()): string {
    const flags = moveFlags(m), from = moveFrom(m), to = moveTo(m);
    let s: string;
    if (flags & F_CASTLE_K) s = 'O-O';
    else if (flags & F_CASTLE_Q) s = 'O-O-O';
    else {
      const piece = Math.abs(this.board[from]);
      if (piece === P) {
        s = (flags & F_CAPTURE ? 'abcdefgh'[from & 7] + 'x' : '') + sqName(to);
        if (movePromo(m)) s += '=' + PIECE_CHARS[movePromo(m)];
      } else {
        s = PIECE_CHARS[piece];
        const others = legal.filter((x) => x !== m && moveTo(x) === to && Math.abs(this.board[moveFrom(x)]) === piece && !movePromo(x));
        if (others.length) {
          const sameFile = others.some((x) => (moveFrom(x) & 7) === (from & 7)), sameRank = others.some((x) => (moveFrom(x) >> 3) === (from >> 3));
          if (!sameFile) s += 'abcdefgh'[from & 7];
          else if (!sameRank) s += String(1 + (from >> 3));
          else s += sqName(from);
        }
        if (flags & F_CAPTURE) s += 'x';
        s += sqName(to);
      }
    }
    this.make(m);
    if (this.inCheck()) s += this.hasLegalMove() ? '+' : '#';
    this.unmake();
    return s;
  }
  /** Finds the legal move written as SAN (extra marks like +, #, !, ? are ignored). Returns 0 if there is none. */
  parseSan(text: string): number {
    const want = text.replace(/[+#!?]/g, '').replace(/0/g, 'O').replace('e.p.', '');
    const legal = this.moves();
    for (const m of legal) if (this.san(m, legal).replace(/[+#]/g, '') === want) return m;
    return 0;
  }

  /** Counts leaf positions (to test the move generator). */
  perft(depth: number): number {
    if (depth === 0) return 1;
    const us = this.turn;
    let n = 0;
    for (const m of this.pseudoMoves()) {
      this.make(m);
      if (!this.attacked(this.kingSq[us], (1 - us) as Color)) n += depth === 1 ? 1 : this.perft(depth - 1);
      this.unmake();
    }
    return n;
  }
}

// ---------- a whole game ----------
export type GameResult = '1-0' | '0-1' | '1/2-1/2' | '*';
export type EndReason = 'checkmate' | 'stalemate' | 'insufficient' | 'fifty' | 'repetition' | 'agreement' | 'resign' | 'timeout' | 'abandon' | 'none';
export type PlyInfo = { move: number; san: string; fen: string; /** thinking time in ms, if known */ ms?: number };

export class Game {
  pos: Position;
  startFen: string;
  plies: PlyInfo[] = [];
  private seen = new Map<number, number>();
  result: GameResult = '*';
  reason: EndReason = 'none';

  constructor(fen: string = START_FEN) {
    this.startFen = fen;
    this.pos = Position.fromFen(fen);
    this.seen.set(this.pos.key(), 1);
  }

  get turn(): Color { return this.pos.turn; }
  get over(): boolean { return this.result !== '*'; }
  legalMoves(): number[] { return this.pos.moves(); }

  /** Plays a move (an integer, UCI text or SAN text). Returns the move played, or 0 if it is not legal. */
  play(move: number | string, ms?: number): number {
    if (this.over) return 0;
    let m: number;
    if (typeof move === 'number') m = this.pos.moves().includes(move) ? move : 0;
    else m = this.pos.parseUci(move) || this.pos.parseSan(move);
    if (!m) return 0;
    const san = this.pos.san(m);
    this.pos.make(m);
    this.plies.push({ move: m, san, fen: this.pos.toFen(), ...(ms !== undefined ? { ms } : {}) });
    const k = this.pos.key();
    this.seen.set(k, (this.seen.get(k) ?? 0) + 1);
    this.checkEnd();
    return m;
  }

  private checkEnd() {
    const p = this.pos;
    if (!p.hasLegalMove()) {
      if (p.inCheck()) { this.finish(p.turn === 0 ? '0-1' : '1-0', 'checkmate'); } else this.finish('1/2-1/2', 'stalemate');
    } else if (p.insufficientMaterial()) this.finish('1/2-1/2', 'insufficient');
    else if (p.half >= 100) this.finish('1/2-1/2', 'fifty');
    else if ((this.seen.get(p.key()) ?? 0) >= 3) this.finish('1/2-1/2', 'repetition');
  }
  finish(result: GameResult, reason: EndReason) { this.result = result; this.reason = reason; }
  resign(color: Color) { this.finish(color === 0 ? '0-1' : '1-0', 'resign'); }

  /** Take back the last move. */
  undo(): boolean {
    if (!this.plies.length) return false;
    const k = this.pos.key();
    this.seen.set(k, Math.max(0, (this.seen.get(k) ?? 1) - 1));
    this.pos.unmake();
    this.plies.pop();
    this.result = '*'; this.reason = 'none';
    return true;
  }

  /** Three moves from now the same position can come up for the third time: used to tell players a draw can be claimed. */
  repetitions(): number { return this.seen.get(this.pos.key()) ?? 1; }

  sanList(): string[] { return this.plies.map((p) => p.san); }
  uciList(): string[] {
    const p = Position.fromFen(this.startFen);
    return this.plies.map((x) => { const u = p.uci(x.move); p.make(x.move); return u; });
  }
  fenAt(ply: number): string { return ply <= 0 ? this.startFen : this.plies[Math.min(ply, this.plies.length) - 1].fen; }

  pgn(tags: Record<string, string> = {}): string {
    const t: Record<string, string> = { Event: 'VibeBlox game', Site: 'vibeblox.online', Date: new Date().toISOString().slice(0, 10).replace(/-/g, '.'), White: '?', Black: '?', Result: this.result, ...tags };
    if (this.startFen !== START_FEN) { t.SetUp = '1'; t.FEN = this.startFen; }
    const head = Object.entries(t).map(([k, v]) => `[${k} "${String(v).replace(/"/g, "'")}"]`).join('\n');
    const start = Position.fromFen(this.startFen);
    let n = start.full, out = '';
    this.plies.forEach((p, i) => {
      const white = (i + (start.turn === 1 ? 1 : 0)) % 2 === 0;
      if (white) out += `${n}. `; else if (i === 0) out += `${n}... `;
      out += p.san + ' ';
      if (!white) n++;
    });
    return `${head}\n\n${out}${this.result}`.trim();
  }

  /** Builds a game from SAN/UCI moves. Stops at the first move that is not legal and reports how many were played. */
  static fromMoves(moves: string[], fen: string = START_FEN): { game: Game; played: number } {
    const g = new Game(fen);
    let played = 0;
    for (const mv of moves) { if (!g.play(mv)) break; played++; }
    return { game: g, played };
  }

  /** Reads a PGN's moves (comments, variations and numbers are skipped). */
  static fromPgn(pgn: string): Game | null {
    const fenTag = /\[FEN\s+"([^"]+)"\]/.exec(pgn);
    const body = pgn.replace(/\[[^\]]*\]/g, ' ').replace(/\{[^}]*\}/g, ' ').replace(/\([^)]*\)/g, ' ').replace(/\$\d+/g, ' ').replace(/;[^\n]*/g, ' ');
    const tokens = body.split(/\s+/).map((t) => t.replace(/^\d+\.(\.\.)?/, '')).filter((t) => t && !/^(1-0|0-1|1\/2-1\/2|\*)$/.test(t));
    try {
      const { game, played } = Game.fromMoves(tokens, fenTag ? fenTag[1] : START_FEN);
      return played === tokens.length ? game : played > 0 ? game : null;
    } catch { return null; }
  }
}

// ---------- helpers for the interface ----------
export const PIECE_VALUES = [0, 100, 320, 330, 500, 900, 0];
export const unicodePiece = (p: number): string => (p ? '♙♘♗♖♕♔♟♞♝♜♛♚'[(p > 0 ? p : 6 - p) - 1] : '');
/** Captured material for each side, plus the points ahead (positive = white is ahead). */
export function materialBalance(board: ArrayLike<number>): { white: number[]; black: number[]; diff: number } {
  const count = [0, 0, 0, 0, 0, 0, 0].map(() => [0, 0]);
  for (let s = 0; s < 64; s++) { const p = board[s]; if (p) count[Math.abs(p)][p > 0 ? 0 : 1]++; }
  const start = [0, 8, 2, 2, 2, 1, 1];
  const white: number[] = [], black: number[] = []; // pieces each side has lost
  let diff = 0;
  const pts = [0, 1, 3, 3, 5, 9, 0];
  for (let t = 1; t <= 5; t++) {
    for (let i = 0; i < Math.max(0, start[t] - count[t][0]); i++) white.push(t);
    for (let i = 0; i < Math.max(0, start[t] - count[t][1]); i++) black.push(t);
    diff += (count[t][0] - count[t][1]) * pts[t];
  }
  return { white, black, diff };
}
