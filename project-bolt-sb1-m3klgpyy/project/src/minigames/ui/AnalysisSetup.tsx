// Start an analysis: paste a PGN or a FEN, set up any position on a board, or pick one of your games.
import { useMemo, useState } from 'react';
import { Game, Position, START_FEN } from '../chess/rules';
import { loadProgress, type Prefs } from '../store';
import Board from './Board';
import { PieceSvg } from './pieces';
import { Seg } from './kit';
import type { ReviewRequest } from './ChessBotGame';

const EMPTY_BOARD = '8/8/8/8/8/8/8/8 w - - 0 1';
const CH = ' PNBRQK';

/** Piece values (index 0 = a1) from the board part of a FEN; works without kings. Null when malformed. */
export function boardFromFen(fen: string): number[] | null {
  const rows = (fen.trim().split(/\s+/)[0] ?? '').split('/');
  if (rows.length !== 8) return null;
  const b: number[] = new Array(64).fill(0);
  for (let r = 0; r < 8; r++) {
    let f = 0;
    for (const ch of rows[7 - r]) {
      if (/[1-8]/.test(ch)) { f += Number(ch); continue; }
      const t = CH.indexOf(ch.toUpperCase());
      if (t < 1 || f > 7) return null;
      b[r * 8 + f] = ch === ch.toUpperCase() ? t : -t; f++;
    }
    if (f !== 8) return null;
  }
  return b;
}

/** A FEN from a board of 64 piece values (index 0 = a1), the side to move and castling rights. */
export function fenFromBoard(board: number[], turn: 0 | 1, castle: string): string {
  const rows: string[] = [];
  for (let r = 7; r >= 0; r--) {
    let s = '', n = 0;
    for (let f = 0; f < 8; f++) {
      const v = board[r * 8 + f];
      if (!v) { n++; continue; }
      if (n) { s += n; n = 0; }
      s += v > 0 ? CH[v] : CH[-v].toLowerCase();
    }
    if (n) s += n;
    rows.push(s);
  }
  return `${rows.join('/')} ${turn === 0 ? 'w' : 'b'} ${castle || '-'} - 0 1`;
}
/** Castling rights that match where the kings and rooks stand. */
export function sanitizeCastle(board: number[], castle: string): string {
  let out = '';
  const has = (sq: number, v: number) => board[sq] === v;
  if (castle.includes('K') && has(4, 6) && has(7, 4)) out += 'K';
  if (castle.includes('Q') && has(4, 6) && has(0, 4)) out += 'Q';
  if (castle.includes('k') && has(60, -6) && has(63, -4)) out += 'k';
  if (castle.includes('q') && has(60, -6) && has(56, -4)) out += 'q';
  return out;
}
/** Is this position fine to analyse? Returns a message when it is not. */
export function checkFen(fen: string): { ok: true; fen: string } | { ok: false; msg: string } {
  const raw = boardFromFen(fen);
  if (!raw) return { ok: false, msg: 'That is not a valid FEN.' };
  const kings = [raw.filter((v) => v === 6).length, raw.filter((v) => v === -6).length];
  if (kings[0] !== 1 || kings[1] !== 1) return { ok: false, msg: 'Each side needs exactly one king.' };
  let pos: Position;
  try { pos = Position.fromFen(fen.trim()); } catch { return { ok: false, msg: 'That is not a valid FEN.' }; }
  let wk = 0, bk = 0, bad = false;
  for (let i = 0; i < 64; i++) {
    const v = pos.board[i];
    if (v === 6) wk++; else if (v === -6) bk++;
    if ((v === 1 || v === -1) && (i < 8 || i > 55)) bad = true;
  }
  if (wk !== 1 || bk !== 1) return { ok: false, msg: 'Each side needs exactly one king.' };
  if (bad) return { ok: false, msg: 'Pawns cannot stand on the first or last row.' };
  const parts = pos.toFen().split(' ');
  parts[1] = pos.turn === 0 ? 'b' : 'w'; parts[3] = '-';
  try { if (Position.fromFen(parts.join(' ')).inCheck()) return { ok: false, msg: 'The side that just moved cannot be in check.' }; } catch { /* ignore */ }
  return { ok: true, fen: pos.toFen() };
}
/** Text that is a FEN rather than a list of moves? */
export const looksLikeFen = (t: string) => /^\s*([pnbrqkPNBRQK1-8]+\/){7}[pnbrqkPNBRQK1-8]+(\s+[wb]\b.*)?\s*$/.test(t.trim().split('\n')[0] ?? '') && !/\[/.test(t);

export default function AnalysisSetup({ prefs, onLoad, onBack, left }: { prefs: Prefs; onLoad: (r: ReviewRequest) => void; onBack: () => void; left: number }) {
  const [tab, setTab] = useState<'paste' | 'editor' | 'games'>('paste');
  const [text, setText] = useState('');
  const [err, setErr] = useState('');
  const recent = loadProgress().history.filter((h) => h.game === 'chess').slice(0, 8);

  // editor state
  const [board, setBoard] = useState<number[]>(() => boardFromFen(START_FEN)!);
  const [turn, setTurn] = useState<0 | 1>(0);
  const [castle, setCastle] = useState('KQkq');
  const [tool, setTool] = useState<number | null>(null);
  const [flip, setFlip] = useState(false);
  const [fenText, setFenText] = useState(START_FEN);
  const fen = useMemo(() => fenFromBoard(board, turn, sanitizeCastle(board, castle)), [board, turn, castle]);

  const sync = (b: number[], t: 0 | 1, c: string) => setFenText(fenFromBoard(b, t, sanitizeCastle(b, c)));
  const place = (sq: number) => {
    if (tool === null) return;
    const b = board.slice(); b[sq] = tool === 0 ? 0 : (b[sq] === tool ? 0 : tool);
    setBoard(b); sync(b, turn, castle);
  };
  const loadFen = (f: string) => {
    const r = checkFen(f);
    if (!r.ok) { setErr(r.msg); return false; }
    const p = Position.fromFen(r.fen);
    const b = Array.from(p.board); setBoard(b); setTurn(p.turn as 0 | 1);
    const c = r.fen.split(' ')[2]; setCastle(c === '-' ? '' : c); setFenText(r.fen); setErr('');
    return true;
  };
  const analyseFen = (f: string, title: string) => {
    const r = checkFen(f);
    if (!r.ok) { setErr(r.msg); return; }
    onLoad({ moves: [], startFen: r.fen, orientation: Position.fromFen(r.fen).turn as 0 | 1, title, explore: true });
  };
  const goPaste = () => {
    const t = text.trim();
    if (!t) { setErr('Paste a PGN, a list of moves or a FEN first.'); return; }
    if (looksLikeFen(t)) { analyseFen(t.split('\n')[0], 'Position'); return; }
    const g = Game.fromPgn(t);
    if (!g || !g.plies.length) { setErr('That is not a FEN or a list of chess moves. Try 1. e4 e5 2. Nf3 Nc6, or a FEN like rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'); return; }
    onLoad({ moves: g.uciList(), startFen: g.startFen, orientation: 0, title: 'Pasted game' });
  };

  const pal = [6, 5, 4, 3, 2, 1];
  return (
    <div className="max-w-3xl mx-auto space-y-3" data-testid="load-analysis">
      <div className="flex items-center gap-3 flex-wrap"><h2 className="mg-h1 flex-1">Analysis</h2>
        <span className="mg-chip" data-testid="reviews-left" title="Game reviews left today. Exploring a position is always free.">{left === Infinity ? 'Unlimited reviews' : `${left} game review${left === 1 ? '' : 's'} left today`}</span></div>
      <Seg value={tab} onChange={(v) => { setTab(v); setErr(''); }} options={[{ id: 'paste', label: 'Paste PGN or FEN' }, { id: 'editor', label: 'Set up a position' }, { id: 'games', label: 'My games' }]} testid="an-tab" />

      {tab === 'paste' && (
        <div className="mg-card p-4 space-y-2">
          <div className="text-sm">Paste moves, a PGN or a FEN:</div>
          <textarea className="mg-input" rows={5} value={text} onChange={(e) => { setText(e.target.value); setErr(''); }} placeholder="1. e4 e5 2. Nf3 Nc6 3. Bb5 a6    or    rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1" data-testid="pgn-input" />
          {err && <div className="text-sm" style={{ color: 'var(--mg-bad)' }} data-testid="pgn-error">{err}</div>}
          <button className="mg-btn mg-btn-primary" onClick={goPaste} data-testid="pgn-go">Analyse</button>
        </div>
      )}

      {tab === 'editor' && (
        <div className="mg-card p-4" data-testid="board-editor">
          <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_220px]">
            <div>
              <Board kind="chess" pieces={board.map((v, sq) => ({ sq, v })).filter((x) => x.v)} orientation={flip ? 1 : 0} theme={prefs.boardTheme} set={prefs.pieceSet} coords={prefs.coords}
                interactive onSquare={place} inputMode="click" animate={false} label="Position editor" clearKey={0} />
            </div>
            <div className="space-y-3 text-sm">
              <div>
                <div className="text-xs mg-mute mb-1">Pick a piece, then click squares. Click again to remove.</div>
                {[0, 1].map((c) => (
                  <div key={c} className="flex gap-1 mb-1">
                    {pal.map((t) => {
                      const v = c === 0 ? t : -t;
                      return <button key={v} onClick={() => setTool(tool === v ? null : v)} aria-pressed={tool === v} data-testid={`pal-${v}`} aria-label={`${c === 0 ? 'White' : 'Black'} ${['', 'pawn', 'knight', 'bishop', 'rook', 'queen', 'king'][t]}`}
                        className="w-9 h-9 rounded-md p-0.5" style={{ background: tool === v ? 'var(--mg-accent)' : 'var(--mg-panel2)', border: '1px solid var(--mg-line)' }}><PieceSvg set={prefs.pieceSet} type={t} white={c === 0} id={`pal${v}`} /></button>;
                    })}
                  </div>
                ))}
                <div className="flex gap-1 flex-wrap">
                  <button className="mg-btn mg-btn-sm" aria-pressed={tool === 0} onClick={() => setTool(tool === 0 ? null : 0)} data-testid="pal-erase">Eraser</button>
                  <button className="mg-btn mg-btn-sm" onClick={() => { const b = boardFromFen(START_FEN)!; setBoard(b); setTurn(0); setCastle('KQkq'); sync(b, 0, 'KQkq'); }} data-testid="ed-start">Start position</button>
                  <button className="mg-btn mg-btn-sm" onClick={() => { const b = boardFromFen(EMPTY_BOARD)!; setBoard(b); setCastle(''); sync(b, turn, ''); }} data-testid="ed-clear">Clear</button>
                  <button className="mg-btn mg-btn-sm" onClick={() => setFlip((f) => !f)}>Flip</button>
                </div>
              </div>
              <div><div className="text-xs mg-mute mb-1">Who moves next</div>
                <Seg value={String(turn)} onChange={(v) => { const t = v === '0' ? 0 : 1; setTurn(t); sync(board, t, castle); }} options={[{ id: '0', label: 'White' }, { id: '1', label: 'Black' }]} testid="ed-turn" /></div>
              <div><div className="text-xs mg-mute mb-1">Castling still allowed</div>
                <div className="flex gap-2 flex-wrap">{[['K', 'White short'], ['Q', 'White long'], ['k', 'Black short'], ['q', 'Black long']].map(([c, l]) => (
                  <label key={c} className="flex items-center gap-1 text-xs"><input type="checkbox" checked={castle.includes(c)} data-testid={`ed-castle-${c}`} onChange={(e) => { const n = e.target.checked ? castle + c : castle.replace(c, ''); setCastle(n); sync(board, turn, n); }} />{l}</label>
                ))}</div></div>
            </div>
          </div>
          <div className="mt-3">
            <div className="text-xs mg-mute mb-1">FEN (edit it, or paste one and press Load)</div>
            <div className="flex gap-2"><input className="mg-input flex-1" value={fenText} onChange={(e) => { setFenText(e.target.value); setErr(''); }} data-testid="ed-fen" spellCheck={false} />
              <button className="mg-btn" onClick={() => loadFen(fenText)} data-testid="ed-load">Load</button></div>
            {err && <div className="text-sm mt-1" style={{ color: 'var(--mg-bad)' }} data-testid="ed-error">{err}</div>}
            <button className="mg-btn mg-btn-primary mt-3" onClick={() => analyseFen(fen, 'Custom position')} data-testid="ed-analyse">Analyse this position</button>
          </div>
        </div>
      )}

      {tab === 'games' && (
        <div className="mg-card p-4">
          {!recent.length && <p className="text-sm mg-mute">Games you play against bots or people show up here.</p>}
          {recent.map((h) => <button key={h.id} className="mg-btn w-full justify-between mb-2" onClick={() => onLoad({ moves: h.moves, startFen: h.startFen, orientation: h.color, title: `vs ${h.opp}` })}><span>vs {h.opp}</span><span className="mg-mute">{h.result} · {h.moves.length} moves</span></button>)}
        </div>
      )}
      <button className="mg-btn mg-btn-ghost" onClick={onBack}>Back</button>
    </div>
  );
}
