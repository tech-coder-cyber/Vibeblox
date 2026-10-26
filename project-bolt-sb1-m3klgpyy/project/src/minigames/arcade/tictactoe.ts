// Tic Tac Toe with three levels of computer opponent.
export type Cell = 0 | 1 | 2; // 0 empty, 1 = X, 2 = O
export type Board = Cell[];
export type Level = 'easy' | 'normal' | 'hard';
export const LINES = [[0, 1, 2], [3, 4, 5], [6, 7, 8], [0, 3, 6], [1, 4, 7], [2, 5, 8], [0, 4, 8], [2, 4, 6]];
export const emptyBoard = (): Board => new Array(9).fill(0) as Board;
export function winner(b: Board): { who: Cell; line: number[] | null } {
  for (const l of LINES) if (b[l[0]] && b[l[0]] === b[l[1]] && b[l[1]] === b[l[2]]) return { who: b[l[0]], line: l };
  return { who: 0, line: null };
}
export const isFull = (b: Board) => b.every((c) => c);
export const result = (b: Board): 'X' | 'O' | 'draw' | null => { const w = winner(b).who; return w === 1 ? 'X' : w === 2 ? 'O' : isFull(b) ? 'draw' : null; };
const free = (b: Board) => b.map((c, i) => (c ? -1 : i)).filter((i) => i >= 0);
const other = (p: Cell): Cell => (p === 1 ? 2 : 1);

function minimax(b: Board, turn: Cell, me: Cell, depth: number): number {
  const w = winner(b).who;
  if (w) return w === me ? 10 - depth : depth - 10;
  if (isFull(b)) return 0;
  let best = turn === me ? -Infinity : Infinity;
  for (const i of free(b)) {
    b[i] = turn;
    const s = minimax(b, other(turn), me, depth + 1);
    b[i] = 0;
    best = turn === me ? Math.max(best, s) : Math.min(best, s);
  }
  return best;
}
/** Best moves (all equally good) for `me`. */
export function bestMoves(b: Board, me: Cell): number[] {
  let best = -Infinity, out: number[] = [];
  for (const i of free(b)) {
    b[i] = me; const s = minimax(b, other(me), me, 1); b[i] = 0;
    if (s > best) { best = s; out = [i]; } else if (s === best) out.push(i);
  }
  return out;
}
const immediate = (b: Board, p: Cell): number | null => {
  for (const i of free(b)) { b[i] = p; const w = winner(b).who === p; b[i] = 0; if (w) return i; }
  return null;
};
/**
 * easy: plays a random square, but takes a win it sees about half the time.
 * normal: always wins or blocks when it can, otherwise takes the centre/corners or a random square.
 * hard: perfect play (never loses).
 */
export function aiMove(b: Board, me: Cell, level: Level, rand: () => number = Math.random): number {
  const moves = free(b);
  if (!moves.length) return -1;
  if (level === 'hard') { const m = bestMoves(b, me); return m[Math.floor(rand() * m.length)]; }
  const win = immediate(b, me);
  if (level === 'easy') {
    if (win !== null && rand() < 0.5) return win;
    return moves[Math.floor(rand() * moves.length)];
  }
  if (win !== null) return win;
  const block = immediate(b, other(me));
  if (block !== null && rand() < 0.9) return block;
  if (!b[4] && rand() < 0.7) return 4;
  const corners = [0, 2, 6, 8].filter((i) => !b[i]);
  if (corners.length && rand() < 0.6) return corners[Math.floor(rand() * corners.length)];
  return moves[Math.floor(rand() * moves.length)];
}
