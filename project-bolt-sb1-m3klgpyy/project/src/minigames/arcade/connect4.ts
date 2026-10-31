// Connect 4: 7 columns, 6 rows. The computer looks ahead with minimax. Works offline.
export const COLS = 7, ROWS = 6;
export type Cell = 0 | 1 | 2; // 1 = red (goes first), 2 = yellow
export type Board = Cell[];   // index = row * 7 + col, row 0 is the top
export type Level = 'easy' | 'normal' | 'hard';
export type Rand = () => number;

export const emptyBoard = (): Board => new Array(COLS * ROWS).fill(0);
/** The row a disc dropped in this column lands on, or -1 if the column is full. */
export function landing(b: Board, col: number): number {
  for (let r = ROWS - 1; r >= 0; r--) if (!b[r * COLS + col]) return r;
  return -1;
}
export function drop(b: Board, col: number, who: 1 | 2): Board | null {
  const r = landing(b, col);
  if (r < 0) return null;
  const n = b.slice(); n[r * COLS + col] = who;
  return n;
}
const DIRS: Array<[number, number]> = [[0, 1], [1, 0], [1, 1], [1, -1]];
/** The four winning squares, if someone has four in a row. */
export function winningLine(b: Board): number[] | null {
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
    const v = b[r * COLS + c]; if (!v) continue;
    for (const [dr, dc] of DIRS) {
      const line = [r * COLS + c]; let ok = true;
      for (let k = 1; k < 4; k++) {
        const rr = r + dr * k, cc = c + dc * k;
        if (rr < 0 || rr >= ROWS || cc < 0 || cc >= COLS || b[rr * COLS + cc] !== v) { ok = false; break; }
        line.push(rr * COLS + cc);
      }
      if (ok) return line;
    }
  }
  return null;
}
export const isFull = (b: Board) => b.every((v) => v);
export const result = (b: Board): 'win' | 'draw' | null => (winningLine(b) ? 'win' : isFull(b) ? 'draw' : null);

const ORDER = [3, 2, 4, 1, 5, 0, 6]; // centre first: better pruning, and the centre is the best column
function score(b: Board, me: 1 | 2): number {
  const opp: 1 | 2 = me === 1 ? 2 : 1;
  let s = 0;
  for (let r = 0; r < ROWS; r++) if (b[r * COLS + 3] === me) s += 3;
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) for (const [dr, dc] of DIRS) {
    let mine = 0, theirs = 0, ok = true;
    for (let k = 0; k < 4; k++) {
      const rr = r + dr * k, cc = c + dc * k;
      if (rr < 0 || rr >= ROWS || cc < 0 || cc >= COLS) { ok = false; break; }
      const v = b[rr * COLS + cc]; if (v === me) mine++; else if (v === opp) theirs++;
    }
    if (!ok || (mine && theirs)) continue;
    if (mine === 3) s += 5; else if (mine === 2) s += 2;
    if (theirs === 3) s -= 4; else if (theirs === 2) s -= 1;
  }
  return s;
}
function search(b: Board, depth: number, alpha: number, beta: number, turn: 1 | 2, me: 1 | 2): number {
  if (winningLine(b)) return turn === me ? -100000 - depth : 100000 + depth; // the player who just moved won
  if (isFull(b)) return 0;
  if (depth === 0) return score(b, me);
  const next: 1 | 2 = turn === 1 ? 2 : 1;
  if (turn === me) {
    let best = -Infinity;
    for (const c of ORDER) { const n = drop(b, c, turn); if (!n) continue; best = Math.max(best, search(n, depth - 1, alpha, beta, next, me)); alpha = Math.max(alpha, best); if (alpha >= beta) break; }
    return best;
  }
  let best = Infinity;
  for (const c of ORDER) { const n = drop(b, c, turn); if (!n) continue; best = Math.min(best, search(n, depth - 1, alpha, beta, next, me)); beta = Math.min(beta, best); if (alpha >= beta) break; }
  return best;
}
/** The computer's column. Easy sometimes plays a random column, normal looks 4 moves ahead, hard looks 7 moves ahead. */
export function aiMove(b: Board, me: 1 | 2, level: Level, rand: Rand = Math.random): number {
  const open = ORDER.filter((c) => landing(b, c) >= 0);
  const opp: 1 | 2 = me === 1 ? 2 : 1;
  // always take a win, and always stop an obvious loss (even on easy it is only a one-move check)
  for (const c of open) { const n = drop(b, c, me); if (n && winningLine(n)) return c; }
  if (level !== 'easy' || rand() < 0.7) for (const c of open) { const n = drop(b, c, opp); if (n && winningLine(n)) return c; }
  if (level === 'easy' && rand() < 0.35) return open[Math.floor(rand() * open.length)];
  const depth = level === 'easy' ? 2 : level === 'normal' ? 4 : 7;
  let bestScore = -Infinity, bestCols: number[] = [];
  for (const c of open) {
    const n = drop(b, c, me)!;
    const v = search(n, depth - 1, -Infinity, Infinity, opp, me);
    if (v > bestScore) { bestScore = v; bestCols = [c]; } else if (v === bestScore) bestCols.push(c);
  }
  return bestCols[Math.floor(rand() * bestCols.length)] ?? open[0];
}
