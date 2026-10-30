// A chess board wired to a Game: pick a piece, see where it can go, move by click or drag, queue a premove, choose a promotion.
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Game, Position, moveFrom, moveTo, movePromo, moveFlags, F_CAPTURE, F_EP, K, sqName, parseSq } from '../chess/rules';
import { premoveTargets, applyPremoves, PREMOVE_DELAY_MS } from '../chess/premoves';
import Board, { type Arrow, type Fx } from './Board';
import { PieceSvg } from './pieces';
import { BOARD_THEMES, type BoardTheme, type Celebration, type Prefs } from '../store';

export function positionAt(game: Game, ply: number | null): Position {
  if (ply === null || ply >= game.plies.length) return game.pos;
  return Position.fromFen(game.fenAt(ply));
}
export function kingSquare(pos: Position, color: 0 | 1): number {
  const want = color === 0 ? K : -K;
  for (let i = 0; i < 64; i++) if (pos.board[i] === want) return i;
  return -1;
}
export { premoveTargets, applyPremoves, PREMOVE_DELAY_MS };

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
  /** turn premoves off for this board (puzzles, analysis) */ noPremove?: boolean;
  /** show another board colour than the player's own (bot themes) */ theme?: BoardTheme;
  celebrate?: { id: number; kind: Celebration } | null;
  fallSq?: number | null;
  children?: ReactNode;
};

export default function ChessBoardView(p: ChessBoardViewProps) {
  const [sel, setSel] = useState<number | null>(null);
  const [promo, setPromo] = useState<{ from: number; to: number } | null>(null);
  const [pre, setPre] = useState<Array<{ from: number; to: number }>>([]);
  /** the premove that is about to be played (still shown on its new square for that moment), and the one just queued (slides) */
  const [pending, setPending] = useState<{ from: number; to: number; ver: number } | null>(null);
  const [preview, setPreview] = useState<{ from: number; to: number; k: number } | null>(null);
  const playedKey = useRef('');
  const reviewing = p.viewPly !== null && p.viewPly < p.game.plies.length;
  const pos = useMemo(() => positionAt(p.game, reviewing ? p.viewPly : null), [p.game, p.version, p.viewPly, reviewing]);
  const myTurn = p.canMove && !reviewing && p.myColor !== null && !p.game.over && pos.turn === p.myColor;
  const interactive = p.canMove && !reviewing && p.myColor !== null && !p.game.over;
  const canPremove = !!p.prefs.premoves && !p.noPremove && p.myColor !== null && !p.game.over && !reviewing && pos.turn !== p.myColor;
  const mode = p.prefs.moveInput;

  useEffect(() => { setSel(null); setPromo(null); }, [p.version, p.viewPly]);
  useEffect(() => { if (p.game.over || !p.prefs.premoves) setPre([]); }, [p.game.over, p.prefs.premoves, p.version]);
  // Escape clears every queued move (right-click on the board does too)
  useEffect(() => {
    if (!pre.length) return;
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') { setPre([]); setSel(null); } };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, [pre.length]);

  // the oldest queued move is played as soon as it is our turn, if it is still legal (the rest wait for their turn).
  // Each one costs 0.1 seconds. If a move is no longer legal (say the opponent took something), the rest of the queue is dropped.
  const preRef = useRef(pre); preRef.current = pre;
  useEffect(() => {
    if (!myTurn || !preRef.current.length) return;
    const [{ from, to }, ...rest] = preRef.current;
    const cands = pos.movesFrom(from).filter((m) => moveTo(m) === to);
    if (!cands.length) { setPre([]); setPending(null); return; }
    setPre(rest);
    setPending({ from, to, ver: p.version }); playedKey.current = `${from}-${to}`;
    const uci = sqName(from) + sqName(to) + (cands.some((m) => movePromo(m)) ? 'q' : '');
    const id = window.setTimeout(() => { p.onUserMove(uci); window.setTimeout(() => { playedKey.current = ''; }, 800); }, PREMOVE_DELAY_MS);
    return () => window.clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [myTurn, p.version]);

  // what the board shows: the real position, with every queued premove (and the one about to be played) already made
  const shown = useMemo(() => {
    if (reviewing || p.game.over) return pos;
    const q = [...(pending && pending.ver === p.version ? [pending] : []), ...pre];
    return q.length ? applyPremoves(pos, q) : pos;
  }, [pos, pre, pending, reviewing, p.game.over, p.version]);
  const pieces = useMemo(() => { const out: Array<{ sq: number; v: number }> = []; for (let i = 0; i < 64; i++) if (shown.board[i]) out.push({ sq: i, v: shown.board[i] }); return out; }, [shown, p.version]);
  const moves = useMemo(() => (sel !== null && interactive && myTurn ? pos.movesFrom(sel) : []), [sel, pos, interactive, myTurn, p.version]);
  // while premoving, pick pieces and squares on the board as it will be after the queued moves
  const vpos = shown;
  const preTargets = useMemo(() => (sel !== null && canPremove ? premoveTargets(vpos, sel) : []), [sel, vpos, canPremove, p.version]);
  const targets = useMemo(() => (canPremove ? preTargets : [...new Set(moves.map(moveTo))]), [canPremove, preTargets, moves]);
  const captures = useMemo(() => (canPremove ? preTargets.filter((t) => vpos.board[t] !== 0 || pos.board[t] !== 0) : moves.filter((m) => moveFlags(m) & (F_CAPTURE | F_EP)).map(moveTo)), [canPremove, preTargets, moves, pos, vpos]);
  const lastIdx = (reviewing ? p.viewPly! : p.game.plies.length) - 1;
  const last = lastIdx >= 0 ? p.game.plies[lastIdx]?.move : undefined;
  const lastMove: [number, number] | null = last ? [moveFrom(last), moveTo(last)] : null;
  const check = pos.inCheck() ? kingSquare(pos, pos.turn as 0 | 1) : null;

  const own = (sq: number) => { const v = (canPremove ? vpos : pos).board[sq]; return v !== 0 && (v > 0 ? 0 : 1) === p.myColor; };
  const mine = (sq: number) => { const v = pos.board[sq]; return v !== 0 && (v > 0 ? 0 : 1) === p.myColor && pos.turn === p.myColor; };

  const tryMove = (from: number, to: number) => {
    const cands = pos.movesFrom(from).filter((m) => moveTo(m) === to);
    if (!cands.length) return false;
    if (cands.some((m) => movePromo(m))) {
      if (p.prefs.autoQueen) { p.onUserMove(sqName(from) + sqName(to) + 'q'); } else setPromo({ from, to });
    } else p.onUserMove(sqName(from) + sqName(to));
    setSel(null);
    return true;
  };
  const tryPremove = (from: number, to: number) => {
    if (!premoveTargets(vpos, from).includes(to)) return false;
    setPre((q) => [...q, { from, to }]); setSel(null); // no limit on how many
    setPreview({ from, to, k: Date.now() });
    return true;
  };
  const onSquare = (sq: number) => {
    if (interactive && myTurn) {
      if (sel !== null && sel !== sq && tryMove(sel, sq)) return;
      setSel(mine(sq) && sel !== sq ? sq : null);
    } else if (canPremove) {
      if (sel !== null && sel !== sq && tryPremove(sel, sq)) return;
      if (own(sq) && sel !== sq) setSel(sq); else setSel(null);
    }
  };
  const onPick = (sq: number | null) => { if (sq === null) { setSel(null); return; } setSel(myTurn ? (mine(sq) ? sq : null) : canPremove && own(sq) ? sq : null); };
  const onMove = (from: number, to: number) => {
    if (interactive && myTurn && mine(from)) tryMove(from, to);
    else if (canPremove && own(from)) tryPremove(from, to);
  };

  return (
    <Board kind="chess" pieces={pieces} orientation={p.orientation} theme={p.theme ?? p.prefs.boardTheme} set={p.prefs.pieceSet} coords={p.prefs.coords}
      lastMove={p.prefs.highlightLast ? lastMove : null} selected={sel} targets={targets} captureTargets={captures} checkSq={check}
      hint={p.hint} arrows={p.arrows} squareColors={p.squareColors} interactive={(interactive && myTurn) || canPremove} canDrag={(sq) => (myTurn ? mine(sq) : canPremove ? own(sq) : false)}
      onSquare={onSquare} onPick={onPick} onMove={onMove} inputMode={mode} premove={[...(pending && pending.ver === p.version ? [pending] : []), ...pre]} previewMove={preview} noSlideKey={playedKey.current} onCancelPremove={() => setPre([])}
      clearKey={p.version} fx={p.fx} animate={p.prefs.animate && !reviewing} animSpeed={p.prefs.animSpeed} showLegalDots={p.prefs.legalDots} label="Chess board"
      celebrate={p.prefs.resultAnims ? p.celebrate : null} fallSq={p.prefs.resultAnims ? p.fallSq : null}>
      {promo && (
        <div className="absolute inset-0 z-20 flex items-center justify-center" style={{ background: 'rgba(10,12,16,.55)' }} data-testid="promo">
          <div className="mg-card p-3 flex gap-2">
            {[5, 4, 3, 2].map((t) => (
              <button key={t} className="w-16 h-16 rounded-lg p-1.5 hover:brightness-125" style={{ background: BOARD_THEMES[p.theme ?? p.prefs.boardTheme].dark }} data-testid={`promo-${'  nbrq'[t]}`}
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
