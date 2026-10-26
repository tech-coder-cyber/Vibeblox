// American checkers (English draughts): 8x8, men move and jump forward, kings both ways, jumping is compulsory,
// a man that reaches the far row becomes a king and the move ends. Squares are numbered 1-32 from the first player's side.
export type Side = 0 | 1; // 0 = Red (moves first, starts at the bottom), 1 = White
export const RED: Side = 0, WHITE: Side = 1;
export const MAN = 1, KING = 2;
/** board[i] > 0 is Red, < 0 is White; |value| is MAN or KING. i = rank * 8 + file, a1 = 0. */
export type Board = Int8Array;
export type Move = { from: number; to: number; path: number[]; caps: number[] };

export const isDark = (sq: number) => ((sq >> 3) + (sq & 7)) % 2 === 0;
export const sqToNum = (sq: number): number => (sq >> 3) * 4 + ((sq & 7) >> 1) + 1;
export const numToSq = (n: number): number => { const r = (n - 1) >> 2, k = (n - 1) & 3; return r * 8 + (r % 2 === 0 ? k * 2 : k * 2 + 1); };
export const sqName = (sq: number) => 'abcdefgh'[sq & 7] + ((sq >> 3) + 1);

const FWD: Array<[number, number]>[] = [[[1, 1], [1, -1]], [[-1, 1], [-1, -1]]]; // [rank step, file step] for each side
const ALL: Array<[number, number]> = [[1, 1], [1, -1], [-1, 1], [-1, -1]];

export class Checkers {
  board: Board = new Int8Array(64);
  turn: Side = RED;
  /** plies since the last capture or man move */ half = 0;
  private keys: string[] = [];

  static start(): Checkers {
    const c = new Checkers();
    for (let sq = 0; sq < 64; sq++) if (isDark(sq)) { const r = sq >> 3; if (r < 3) c.board[sq] = MAN; else if (r > 4) c.board[sq] = -MAN; }
    c.keys.push(c.key());
    return c;
  }
  static fromRows(rows: string[], turn: Side = RED): Checkers {
    // rows from rank 8 (top) to rank 1: r/R red man/king, w/W white man/king, . empty
    const c = new Checkers();
    rows.forEach((row, i) => { const r = 7 - i; for (let f = 0; f < 8; f++) { const ch = row[f]; const sq = r * 8 + f; c.board[sq] = ch === 'r' ? MAN : ch === 'R' ? KING : ch === 'w' ? -MAN : ch === 'W' ? -KING : 0; } });
    c.turn = turn; c.keys = [c.key()];
    return c;
  }
  clone(): Checkers { const c = new Checkers(); c.board = this.board.slice(); c.turn = this.turn; c.half = this.half; c.keys = [...this.keys]; return c; }
  key(): string { return String.fromCharCode(...Array.from(this.board, (x) => x + 3)) + this.turn; }
  sideOf(v: number): Side | -1 { return v > 0 ? RED : v < 0 ? WHITE : -1; }

  private jumps(from: number, piece: number, side: Side, caps: number[], path: number[], out: Move[]): void {
    const b = this.board;
    const dirs = Math.abs(piece) === KING ? ALL : FWD[side];
    let any = false;
    for (const [dr, df] of dirs) {
      const r = (from >> 3) + dr, f = (from & 7) + df, r2 = r + dr, f2 = f + df;
      if (r2 < 0 || r2 > 7 || f2 < 0 || f2 > 7) continue;
      const mid = r * 8 + f, land = r2 * 8 + f2;
      const mv = b[mid];
      if (!mv || this.sideOf(mv) === side || caps.includes(mid) || b[land]) continue;
      any = true;
      const crowned = Math.abs(piece) === MAN && ((side === RED && r2 === 7) || (side === WHITE && r2 === 0));
      caps.push(mid); path.push(land);
      if (crowned) out.push({ from: path[0], to: land, path: [...path], caps: [...caps] });
      else {
        const before = out.length;
        this.jumps(land, piece, side, caps, path, out);
        if (out.length === before) out.push({ from: path[0], to: land, path: [...path], caps: [...caps] });
      }
      caps.pop(); path.pop();
    }
    void any;
  }

  moves(): Move[] {
    const side = this.turn, b = this.board;
    const caps: Move[] = [], steps: Move[] = [];
    for (let sq = 0; sq < 64; sq++) {
      const v = b[sq];
      if (!v || this.sideOf(v) !== side) continue;
      // jumps: lift the piece so its own start square counts as empty
      b[sq] = 0;
      this.jumps(sq, v, side, [], [sq], caps);
      b[sq] = v;
      if (caps.length) continue;
      const dirs = Math.abs(v) === KING ? ALL : FWD[side];
      for (const [dr, df] of dirs) {
        const r = (sq >> 3) + dr, f = (sq & 7) + df;
        if (r < 0 || r > 7 || f < 0 || f > 7) continue;
        const to = r * 8 + f;
        if (!b[to]) steps.push({ from: sq, to, path: [sq, to], caps: [] });
      }
    }
    return caps.length ? caps : steps;
  }

  /** Plays a move; returns what is needed to take it back. */
  make(m: Move): { piece: number; captured: number[]; half: number } {
    const b = this.board, piece = b[m.from];
    const captured = m.caps.map((c) => b[c]);
    b[m.from] = 0;
    for (const c of m.caps) b[c] = 0;
    const crown = Math.abs(piece) === MAN && ((this.turn === RED && m.to >> 3 === 7) || (this.turn === WHITE && m.to >> 3 === 0));
    b[m.to] = crown ? (piece > 0 ? KING : -KING) : piece;
    const undo = { piece, captured, half: this.half };
    this.half = m.caps.length || Math.abs(piece) === MAN ? 0 : this.half + 1;
    this.turn = this.turn === RED ? WHITE : RED;
    this.keys.push(this.key());
    return undo;
  }
  unmake(m: Move, u: { piece: number; captured: number[]; half: number }): void {
    const b = this.board;
    this.keys.pop();
    this.turn = this.turn === RED ? WHITE : RED;
    b[m.to] = 0;
    b[m.from] = u.piece;
    m.caps.forEach((c, i) => { b[c] = u.captured[i]; });
    this.half = u.half;
  }
  repetitions(): number { const k = this.keys[this.keys.length - 1]; return this.keys.filter((x) => x === k).length; }
  counts() { let r = 0, w = 0, rk = 0, wk = 0; for (const v of this.board) { if (v > 0) { r++; if (v === KING) rk++; } else if (v < 0) { w++; if (v === -KING) wk++; } } return { red: r, white: w, redKings: rk, whiteKings: wk }; }
  perft(d: number): number {
    if (d === 0) return 1;
    let n = 0;
    for (const m of this.moves()) { const u = this.make(m); n += d === 1 ? 1 : this.perft(d - 1); this.unmake(m, u); }
    return n;
  }
  /** "11-15" for a step, "22x15" or "22x13x6" for jumps (square numbers). */
  notation(m: Move): string { return m.caps.length ? m.path.map(sqToNum).join('x') : sqToNum(m.from) + '-' + sqToNum(m.to); }
  findMove(from: number, to: number, via?: number[]): Move | null {
    const list = this.moves().filter((m) => m.from === from && m.to === to);
    if (list.length <= 1) return list[0] ?? null;
    if (via) return list.find((m) => m.path.slice(1, -1).join() === via.join()) ?? list[0];
    return list[0];
  }
}

export type CheckersResult = '*' | '1-0' | '0-1' | '1/2-1/2';
export type CheckersEnd = 'none' | 'no-moves' | 'resign' | 'agreed' | 'repetition' | 'forty-move' | 'timeout' | 'abandoned';

/** One game with history. Red = "1-0". */
export class CheckersGame {
  pos = Checkers.start();
  startRows: string | null = null;
  moves: Array<{ move: Move; text: string }> = [];
  result: CheckersResult = '*';
  reason: CheckersEnd = 'none';
  get over() { return this.result !== '*'; }
  play(m: Move | string): boolean {
    if (this.over) return false;
    let mv: Move | undefined;
    if (typeof m === 'string') mv = this.pos.moves().find((x) => this.pos.notation(x) === m);
    else mv = this.pos.moves().find((x) => x.from === m.from && x.to === m.to && x.caps.join() === m.caps.join());
    if (!mv) return false;
    const text = this.pos.notation(mv);
    this.pos.make(mv);
    this.moves.push({ move: mv, text });
    this.checkEnd();
    return true;
  }
  private checkEnd() {
    if (!this.pos.moves().length) { this.finish(this.pos.turn === RED ? '0-1' : '1-0', 'no-moves'); return; }
    if (this.pos.repetitions() >= 3) this.finish('1/2-1/2', 'repetition');
    else if (this.pos.half >= 80) this.finish('1/2-1/2', 'forty-move');
  }
  finish(result: CheckersResult, reason: CheckersEnd) { this.result = result; this.reason = reason; }
  undo(): boolean {
    if (!this.moves.length) return false;
    const rebuilt = Checkers.start();
    const list = this.moves.slice(0, -1);
    for (const x of list) rebuilt.make(x.move);
    this.pos = rebuilt; this.moves = list; this.result = '*'; this.reason = 'none';
    return true;
  }
  sanList() { return this.moves.map((m) => m.text); }
}
