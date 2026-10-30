// Premove rules: which squares a piece can be queued to, and what the board will look like after the queued moves.
import { Position, moveFrom, moveTo, K, P, Q } from './rules';

/** How long a queued move waits once it is your turn: 0.1 seconds of your clock per premove. */
export const PREMOVE_DELAY_MS = 100;

/** The squares a piece could reach if it were its side's turn, ignoring checks and pins (for queuing a premove).
 *  Your own pieces count as targets too: if the opponent takes on that square, your premove becomes a recapture. */
export function premoveTargets(pos: Position, from: number): number[] {
  const piece = pos.board[from];
  if (!piece) return [];
  const color = piece > 0 ? 0 : 1;
  const base = pos.clone(); base.turn = color; base.ep = -1;
  const out = new Set<number>();
  for (const m of base.pseudoMoves([])) if (moveFrom(m) === from) out.add(moveTo(m));
  if (Math.abs(piece) !== K) {
    // swap every other friendly piece (except the king) for an enemy pawn, so a move onto it shows up as a capture
    const alt = base.clone();
    const enemyPawn = color === 0 ? -P : P;
    for (let i = 0; i < 64; i++) { const v = alt.board[i]; if (i !== from && v !== 0 && (v > 0 ? 0 : 1) === color && Math.abs(v) !== K) alt.board[i] = enemyPawn; }
    for (const m of alt.pseudoMoves([])) if (moveFrom(m) === from) out.add(moveTo(m));
  }
  return [...out];
}

/** The board as it will look after the queued premoves (each one assumed to go through), for choosing the next one. */
export function applyPremoves(pos: Position, queue: Array<{ from: number; to: number }>): Position {
  const q = pos.clone();
  for (const { from, to } of queue) {
    const v = q.board[from];
    if (!v) continue;
    const t = Math.abs(v), f = from & 7, tf = to & 7;
    if (t === P && f !== tf && q.board[to] === 0) q.board[(from >> 3) * 8 + tf] = 0; // en passant
    if (t === K && Math.abs(tf - f) === 2) { // castling: bring the rook across
      const rank = (from >> 3) * 8, rf = tf > f ? 7 : 0, rt = tf > f ? 5 : 3;
      q.board[rank + rt] = q.board[rank + rf]; q.board[rank + rf] = 0;
    }
    q.board[to] = t === P && ((to >> 3) === 7 || (to >> 3) === 0) ? (v > 0 ? Q : -Q) : v;
    q.board[from] = 0;
    if (t === K) q.kingSq[v > 0 ? 0 : 1] = to;
  }
  return q;
}
