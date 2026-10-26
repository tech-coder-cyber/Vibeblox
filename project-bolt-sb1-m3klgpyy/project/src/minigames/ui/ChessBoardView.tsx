// A chess board wired to a Game: pick a piece, see where it can go, move by click or drag, choose a promotion.
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Game, Position, moveFrom, moveTo, movePromo, moveFlags, F_CAPTURE, F_EP, K, sqName, parseSq } from '../chess/rules';
import Board, { type Arrow, type Fx } from './Board';
import { PieceSvg } from './pieces';
import { BOARD_THEMES, type Prefs } from '../store';

export function positionAt(game: Game, ply: number | null): Position {
  if (ply === null || ply >= game.plies.length) return game.pos;
  return Position.fromFen(game.fenAt(ply));
}
export function kingSquare(pos: Position, color: 0 | 1): number {
  const want = color === 0 ? K : -K;
  for (let i = 0; i < 64; i++) if (pos.board[i] === want) return i;
  return -1;
}

export type ChessBoardViewProps = {
  game: Game; version: number;
  orientation: 0 | 1;
  /** which colour this player moves, or null if they only watch */ myColor: 0 | 1 | null;
  /** is it allowed to move right now (not thinking, not over, not reviewing) */ canMove: boolean;
  onUserMove: (uci: string) => void;
  viewPly: number | null;
  prefs: Prefs;
  hint?: { from: number; to?: number } | null;
  arrows?: Arrow[];
  squareColors?: Record<number, string>;
  fx?: Fx;
  children?: ReactNode;
};

export default function ChessBoardView(p: ChessBoardViewProps) {
  const [sel, setSel] = useState<number | null>(null);
  const [promo, setPromo] = useState<{ from: number; to: number } | null>(null);
  const reviewing = p.viewPly !== null && p.viewPly < p.game.plies.length;
  const pos = useMemo(() => positionAt(p.game, reviewing ? p.viewPly : null), [p.game, p.version, p.viewPly, reviewing]);
  const interactive = p.canMove && !reviewing && p.myColor !== null && !p.game.over;

  useEffect(() => { setSel(null); setPromo(null); }, [p.version, p.viewPly]);

  const pieces = useMemo(() => { const out: Array<{ sq: number; v: number }> = []; for (let i = 0; i < 64; i++) if (pos.board[i]) out.push({ sq: i, v: pos.board[i] }); return out; }, [pos, p.version]);
  const moves = useMemo(() => (sel !== null && interactive ? pos.movesFrom(sel) : []), [sel, pos, interactive, p.version]);
  const targets = useMemo(() => [...new Set(moves.map(moveTo))], [moves]);
  const captures = useMemo(() => moves.filter((m) => moveFlags(m) & (F_CAPTURE | F_EP)).map(moveTo), [moves]);
  const lastIdx = (reviewing ? p.viewPly! : p.game.plies.length) - 1;
  const last = lastIdx >= 0 ? p.game.plies[lastIdx]?.move : undefined;
  const lastMove: [number, number] | null = last ? [moveFrom(last), moveTo(last)] : null;
  const check = pos.inCheck() ? kingSquare(pos, pos.turn as 0 | 1) : null;

  const tryMove = (from: number, to: number) => {
    const cands = pos.movesFrom(from).filter((m) => moveTo(m) === to);
    if (!cands.length) return false;
    if (cands.some((m) => movePromo(m))) {
      if (p.prefs.autoQueen) { p.onUserMove(sqName(from) + sqName(to) + 'q'); } else setPromo({ from, to });
    } else p.onUserMove(sqName(from) + sqName(to));
    setSel(null);
    return true;
  };
  const mine = (sq: number) => { const v = pos.board[sq]; return v !== 0 && (v > 0 ? 0 : 1) === p.myColor && pos.turn === p.myColor; };
  const onSquare = (sq: number) => {
    if (!interactive) return;
    if (sel !== null && sel !== sq && tryMove(sel, sq)) return;
    setSel(mine(sq) && sel !== sq ? sq : null);
  };
  const onMove = (from: number, to: number) => { if (interactive && mine(from)) tryMove(from, to); };

  return (
    <Board kind="chess" pieces={pieces} orientation={p.orientation} theme={p.prefs.boardTheme} set={p.prefs.pieceSet} coords={p.prefs.coords}
      lastMove={p.prefs.highlightLast ? lastMove : null} selected={sel} targets={targets} captureTargets={captures} checkSq={check}
      hint={p.hint} arrows={p.arrows} squareColors={p.squareColors} interactive={interactive} canDrag={mine} onSquare={onSquare} onMove={onMove}
      clearKey={p.version} fx={p.fx} animate={p.prefs.animate && !reviewing} showLegalDots={p.prefs.legalDots} label="Chess board">
      {promo && (
        <div className="absolute inset-0 z-20 flex items-center justify-center" style={{ background: 'rgba(10,12,16,.55)' }} data-testid="promo">
          <div className="mg-card p-3 flex gap-2">
            {[5, 4, 3, 2].map((t) => (
              <button key={t} className="w-16 h-16 rounded-lg p-1.5 hover:brightness-125" style={{ background: BOARD_THEMES[p.prefs.boardTheme].dark }} data-testid={`promo-${'  nbrq'[t]}`}
                onClick={() => { p.onUserMove(sqName(promo.from) + sqName(promo.to) + 'nbrq'[t - 2]); setPromo(null); setSel(null); }}>
                <PieceSvg set={p.prefs.pieceSet} type={t} white={p.myColor === 0} id={'pr' + t} />
              </button>
            ))}
            <button className="mg-btn mg-btn-ghost" onClick={() => setPromo(null)}>Cancel</button>
          </div>
        </div>
      )}
      {p.children}
    </Board>
  );
}
export const uciSquares = (uci: string): { from: number; to: number } => ({ from: parseSq(uci.slice(0, 2)), to: parseSq(uci.slice(2, 4)) });
