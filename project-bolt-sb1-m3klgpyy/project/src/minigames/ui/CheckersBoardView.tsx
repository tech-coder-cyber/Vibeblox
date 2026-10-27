// The checkers board wired to a CheckersGame: pick a piece, click where it goes (a multi-jump is played in one go).
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { CheckersGame, type Move, type Side } from '../checkers/rules';
import type { Prefs } from '../store';
import Board, { type Arrow, type Fx } from './Board';

export type CheckersBoardProps = {
  game: CheckersGame; version: number; orientation: 0 | 1;
  myColor: Side | null; canMove: boolean;
  onUserMove: (m: Move) => void;
  viewPly: number | null; prefs: Prefs;
  hint?: { from: number; to?: number } | null;
  arrows?: Arrow[]; fx?: Fx; children?: ReactNode;
};

/** The position after `ply` moves (null = now). */
export function checkersAt(game: CheckersGame, ply: number | null) {
  if (ply === null || ply >= game.moves.length) return game.pos;
  const g = new CheckersGame();
  for (let i = 0; i < ply; i++) g.pos.make(game.moves[i].move);
  return g.pos;
}

export default function CheckersBoardView(p: CheckersBoardProps) {
  const [sel, setSel] = useState<number | null>(null);
  const reviewing = p.viewPly !== null && p.viewPly < p.game.moves.length;
  const pos = useMemo(() => checkersAt(p.game, reviewing ? p.viewPly : null), [p.game, p.version, p.viewPly, reviewing]);
  const interactive = p.canMove && !reviewing && p.myColor !== null && !p.game.over && pos.turn === p.myColor;
  useEffect(() => { setSel(null); }, [p.version, p.viewPly]);

  const legal = useMemo(() => (interactive ? pos.moves() : []), [pos, interactive, p.version]);
  const movable = useMemo(() => new Set(legal.map((m) => m.from)), [legal]);
  const mine = (sq: number) => interactive && movable.has(sq);
  const fromSel = useMemo(() => (sel !== null ? legal.filter((m) => m.from === sel) : []), [sel, legal]);
  const targets = useMemo(() => [...new Set(fromSel.map((m) => m.to))], [fromSel]);
  const captures = useMemo(() => fromSel.filter((m) => m.caps.length).map((m) => m.to), [fromSel]);

  const pieces = useMemo(() => { const out: Array<{ sq: number; v: number }> = []; for (let i = 0; i < 64; i++) if (pos.board[i]) out.push({ sq: i, v: pos.board[i] }); return out; }, [pos, p.version]);
  const lastIdx = (reviewing ? p.viewPly! : p.game.moves.length) - 1;
  const last = lastIdx >= 0 ? p.game.moves[lastIdx].move : null;
  const lastMove: [number, number] | null = last ? [last.from, last.to] : null;

  const tryMove = (from: number, to: number) => {
    const m = legal.find((x) => x.from === from && x.to === to);
    if (!m) return false;
    p.onUserMove(m); setSel(null); return true;
  };
  const onSquare = (sq: number) => {
    if (!interactive) return;
    if (sel !== null && sel !== sq && tryMove(sel, sq)) return;
    setSel(mine(sq) && sel !== sq ? sq : null);
  };
  const onMove = (from: number, to: number) => { if (interactive && mine(from)) tryMove(from, to); };

  return (
    <Board kind="checkers" pieces={pieces} orientation={p.orientation} theme={p.prefs.boardTheme} set={p.prefs.pieceSet} coords={p.prefs.coords}
      lastMove={p.prefs.highlightLast ? lastMove : null} selected={sel} targets={targets} captureTargets={captures}
      hint={p.hint} arrows={p.arrows} interactive={interactive} canDrag={mine} onSquare={onSquare} onMove={onMove}
      clearKey={p.version} fx={p.fx} animate={p.prefs.animate && !reviewing} animSpeed={p.prefs.animSpeed} showLegalDots={p.prefs.legalDots} label="Checkers board">
      {p.children}
    </Board>
  );
}
