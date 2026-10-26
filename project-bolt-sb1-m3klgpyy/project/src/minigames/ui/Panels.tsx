// Leaderboards, game history, settings, and a simple replay for checkers games.
import { useEffect, useMemo, useState } from 'react';
import { CheckersGame } from '../checkers/rules';
import { BOARD_THEMES, PIECE_SETS, loadProgress, type BoardTheme, type HistoryEntry, type PieceSet, type Prefs } from '../store';
import { clubClass, displayRating, ratingLabel, fideEstimate } from '../ratings';
import * as api from '../api';
import Board from './Board';
import CheckersBoardView, { checkersAt } from './CheckersBoardView';
import { PieceSvg, Disc } from './pieces';
import { Crowns, MoveList, Seg, Toggle } from './kit';
import { hasStockfish } from '../engineClient';

type Board3 = 'chess' | 'checkers' | 'puzzle' | '2048' | 'tictactoe';
const BOARD_TABS: Array<{ id: Board3; label: string }> = [{ id: 'chess', label: 'Chess' }, { id: 'checkers', label: 'Checkers' }, { id: 'puzzle', label: 'Puzzles' }, { id: '2048', label: '2048' }, { id: 'tictactoe', label: 'Tic Tac Toe' }];

export function Leaderboards({ signedIn, onBack }: { signedIn: boolean; onBack: () => void }) {
  const [tab, setTab] = useState<Board3>('chess');
  const [rows, setRows] = useState<Array<{ name: string; rank: string; value: number; extra?: string }> | null>(null);
  const [err, setErr] = useState('');
  useEffect(() => {
    let live = true; setRows(null); setErr('');
    void (async () => {
      if (tab === '2048' || tab === 'tictactoe') {
        const r = await api.scoreBoard(tab); if (!live) return;
        if (!r.ok) setErr(r.error); else setRows(r.value.map((x) => ({ name: x.username, rank: x.rank, value: x.score })));
      } else {
        const r = await api.leaderboard(tab); if (!live) return;
        if (!r.ok) setErr(r.error); else setRows(r.value.map((x) => ({ name: x.username, rank: x.rank, value: x.rating, extra: `${x.games} games · ${x.wins}-${x.draws}-${x.losses}` })));
      }
    })();
    return () => { live = false; };
  }, [tab]);
  const unit = tab === '2048' ? 'points' : tab === 'tictactoe' ? 'score' : 'rating';
  return (
    <div data-testid="boards">
      <div className="flex items-center gap-3 mb-4 flex-wrap"><h2 className="mg-h1 flex-1">Leaderboards</h2><button className="mg-btn mg-btn-ghost" onClick={onBack}>Back to games</button></div>
      <div className="flex gap-1 flex-wrap mb-3" role="tablist">{BOARD_TABS.map((t) => <button key={t.id} role="tab" className="mg-tab" aria-selected={tab === t.id} onClick={() => setTab(t.id)} data-testid={`lb-${t.id}`}>{t.label}</button>)}</div>
      <div className="mg-card overflow-hidden">
        {err && <div className="p-4 text-sm mg-mute" data-testid="lb-error">{err}</div>}
        {!err && rows === null && <div className="p-4 text-sm mg-mute">Loading...</div>}
        {!err && rows && !rows.length && <div className="p-4 text-sm mg-mute" data-testid="lb-empty">Nobody is on this board yet. {tab === 'chess' || tab === 'checkers' ? 'Finish 5 rated games to appear.' : 'Play a game and be the first!'}</div>}
        {rows && rows.map((r, i) => (
          <div key={r.name + i} className="flex items-center gap-3 px-4 py-2.5 border-b last:border-0" style={{ borderColor: 'var(--mg-line)' }} data-testid="lb-row">
            <div className="w-7 text-center font-bold" style={{ color: i < 3 ? 'var(--mg-accent)' : 'var(--mg-mute)' }}>{i + 1}</div>
            <div className="flex-1 min-w-0"><div className="font-semibold truncate">{r.name}</div>{r.extra && <div className="text-xs mg-mute">{r.extra}</div>}</div>
            <div className="text-right"><div className="font-bold">{r.value}</div><div className="text-[10px] mg-mute">{unit}</div></div>
          </div>
        ))}
      </div>
      {!signedIn && <p className="text-xs mg-mute mt-2">Sign in (Social tab) to appear on the boards.</p>}
    </div>
  );
}

export function RatingCard({ signedIn }: { signedIn: boolean }) {
  const p = loadProgress();
  const c = displayRating(p.chessRating), k = displayRating(p.checkersRating);
  const row = (name: string, d: ReturnType<typeof displayRating>, n: number) => (
    <div className="flex items-center justify-between py-1.5">
      <div><div className="text-sm font-semibold">{name}</div><div className="text-xs mg-mute">{d.provisional ? (n === 0 ? 'Play 5 rated games to get a rating' : `${d.gamesLeft} more rated game${d.gamesLeft === 1 ? '' : 's'} to settle`) : `${clubClass(d.value)}${fideEstimate(d.value) ? ` · about FIDE ${fideEstimate(d.value)}` : ''}`}</div></div>
      <div className="text-xl font-bold" data-testid={`rating-${name.toLowerCase()}`}>{d.label}</div>
    </div>
  );
  return (
    <div className="mg-card p-4" data-testid="rating-card">
      <div className="mg-h2 mb-1">Your ratings</div>
      {row('Chess', c, p.chessRating.n)}
      {row('Checkers', k, p.checkersRating.n)}
      <div className="flex items-center justify-between py-1.5"><div><div className="text-sm font-semibold">Puzzles</div><div className="text-xs mg-mute">{ratingLabel(p.puzzle.r)}</div></div><div className="text-xl font-bold">{p.puzzle.r}</div></div>
      {!signedIn && <p className="text-xs mg-mute mt-1">Ratings from real games need a signed-in account. Bot games never change them.</p>}
    </div>
  );
}

export function HistoryView({ onAnalyse, onReplay, onBack }: { onAnalyse: (e: HistoryEntry) => void; onReplay: (e: HistoryEntry) => void; onBack: () => void }) {
  const list = loadProgress().history;
  const [filter, setFilter] = useState<'all' | 'chess' | 'checkers'>('all');
  const shown = list.filter((h) => filter === 'all' || h.game === filter);
  return (
    <div data-testid="history">
      <div className="flex items-center gap-3 mb-4 flex-wrap"><h2 className="mg-h1 flex-1">Game history</h2>
        <Seg value={filter} onChange={setFilter} options={[{ id: 'all', label: 'All' }, { id: 'chess', label: 'Chess' }, { id: 'checkers', label: 'Checkers' }]} testid="hist-filter" />
        <button className="mg-btn mg-btn-ghost" onClick={onBack}>Back to games</button></div>
      {!shown.length && <div className="mg-card p-5 text-sm mg-mute" data-testid="hist-empty">No games here yet. Finished games are saved on this device so you can look at them again.</div>}
      <div className="space-y-2">
        {shown.map((h) => (
          <div key={h.id} className="mg-card p-3 flex items-center gap-3" data-testid="hist-row">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center font-bold" style={{ background: h.result === 'win' ? 'rgba(92,189,157,.2)' : h.result === 'loss' ? 'rgba(232,123,114,.2)' : 'var(--mg-panel2)', color: h.result === 'win' ? 'var(--mg-good)' : h.result === 'loss' ? 'var(--mg-bad)' : 'var(--mg-mute)' }}>{h.result === 'win' ? 'W' : h.result === 'loss' ? 'L' : 'D'}</div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold truncate">{h.game === 'chess' ? 'Chess' : 'Checkers'} vs {h.opp}{h.oppRating ? ` (${h.oppRating})` : ''}</div>
              <div className="text-xs mg-mute">{h.mode === 'bot' ? 'Bot' : 'Online'} · {h.reason} · {h.moves.length} moves · {new Date(h.at).toLocaleDateString()}{h.ratingDelta !== undefined ? ` · ${h.ratingDelta >= 0 ? '+' : ''}${h.ratingDelta}` : ''}</div>
            </div>
            {h.result === 'win' && h.mode === 'bot' && h.crowns !== undefined && <Crowns n={h.crowns} />}
            {h.game === 'chess' ? <button className="mg-btn mg-btn-sm" onClick={() => onAnalyse(h)} data-testid="hist-analyse">Analyse</button> : <button className="mg-btn mg-btn-sm" onClick={() => onReplay(h)} data-testid="hist-replay">Replay</button>}
          </div>
        ))}
      </div>
    </div>
  );
}

/** Step through a finished checkers game. */
export function CheckersReplay({ moves, orientation, title, prefs, onBack }: { moves: string[]; orientation: 0 | 1; title: string; prefs: Prefs; onBack: () => void }) {
  const game = useMemo(() => { const g = new CheckersGame(); for (const m of moves) if (!g.play(m)) break; return g; }, [moves]);
  const [view, setView] = useState(game.moves.length);
  const sans = game.sanList();
  const g2 = useMemo(() => { const x = new CheckersGame(); x.pos = checkersAt(game, view).clone(); x.moves = game.moves.slice(0, view); return x; }, [game, view]);
  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,560px)_1fr]" data-testid="ck-replay">
      <div>
        <div className="text-sm font-semibold mb-1">{title}</div>
        <CheckersBoardView game={g2} version={view} orientation={orientation} myColor={null} canMove={false} onUserMove={() => undefined} viewPly={null} prefs={prefs} />
        <div className="flex gap-2 mt-3"><button className="mg-btn" onClick={() => setView(0)}>⏮</button><button className="mg-btn" onClick={() => setView(Math.max(0, view - 1))}>◀</button><button className="mg-btn" onClick={() => setView(Math.min(sans.length, view + 1))} data-testid="ck-next">▶</button><button className="mg-btn" onClick={() => setView(sans.length)}>⏭</button></div>
      </div>
      <div className="mg-card p-3 h-fit"><div className="mg-h2 mb-1">Moves</div><MoveList moves={sans} view={view} onView={setView} /><button className="mg-btn mg-btn-ghost mt-3" onClick={onBack}>Back to games</button></div>
    </div>
  );
}

export function Settings({ prefs, onPrefs, onBack }: { prefs: Prefs; onPrefs: (p: Prefs) => void; onBack: () => void }) {
  const [sf, setSf] = useState(false);
  useEffect(() => { void hasStockfish().then(setSf); }, []);
  const set = (patch: Partial<Prefs>) => onPrefs({ ...prefs, ...patch });
  const demo = useMemo(() => [{ sq: 0, v: 4 }, { sq: 1, v: 2 }, { sq: 9, v: 1 }, { sq: 18, v: -1 }, { sq: 27, v: -5 }, { sq: 36, v: 6 }, { sq: 45, v: -6 }, { sq: 54, v: 3 }], []);
  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,420px)_1fr]" data-testid="mg-settings">
      <div>
        <Board kind="chess" pieces={demo} orientation={0} theme={prefs.boardTheme} set={prefs.pieceSet} coords={prefs.coords} interactive={false} label="Preview" />
      </div>
      <div className="space-y-4">
        <div className="flex items-center"><h2 className="mg-h1 flex-1">Board and pieces</h2><button className="mg-btn mg-btn-ghost" onClick={onBack}>Back to games</button></div>
        <div className="mg-card p-4">
          <div className="mg-h2 mb-2">Board colours</div>
          <div className="grid grid-cols-4 gap-2">{(Object.keys(BOARD_THEMES) as BoardTheme[]).map((k) => (
            <button key={k} className="rounded-lg p-1 text-xs" onClick={() => set({ boardTheme: k })} aria-pressed={prefs.boardTheme === k} data-testid={`theme-${k}`} style={{ border: `2px solid ${prefs.boardTheme === k ? 'var(--mg-accent)' : 'var(--mg-line)'}` }}>
              <div className="grid grid-cols-2 rounded overflow-hidden h-8"><span style={{ background: BOARD_THEMES[k].light }} /><span style={{ background: BOARD_THEMES[k].dark }} /><span style={{ background: BOARD_THEMES[k].dark }} /><span style={{ background: BOARD_THEMES[k].light }} /></div>
              <div className="mt-1">{BOARD_THEMES[k].name}</div></button>))}</div>
        </div>
        <div className="mg-card p-4">
          <div className="mg-h2 mb-2">Piece style</div>
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">{(Object.keys(PIECE_SETS) as PieceSet[]).map((k) => (
            <button key={k} className="rounded-lg p-1 text-xs" onClick={() => set({ pieceSet: k })} aria-pressed={prefs.pieceSet === k} data-testid={`pieces-${k}`} style={{ border: `2px solid ${prefs.pieceSet === k ? 'var(--mg-accent)' : 'var(--mg-line)'}`, background: BOARD_THEMES[prefs.boardTheme].dark }}>
              <div className="flex"><div className="w-1/2"><PieceSvg set={k} type={2} white id={`pv${k}w`} /></div><div className="w-1/2"><PieceSvg set={k} type={2} white={false} id={`pv${k}b`} /></div></div>
              <div className="flex justify-center my-0.5"><div className="w-5"><Disc set={k} red king={false} id={`dv${k}`} /></div></div>
              <div className="text-white/90">{PIECE_SETS[k]}</div></button>))}</div>
        </div>
        <div className="mg-card p-4 space-y-1">
          <Toggle on={prefs.coords} onChange={(v) => set({ coords: v })} label="Show a-h and 1-8 on the board" />
          <Toggle on={prefs.legalDots} onChange={(v) => set({ legalDots: v })} label="Show where a piece can move" />
          <Toggle on={prefs.highlightLast} onChange={(v) => set({ highlightLast: v })} label="Highlight the last move" />
          <Toggle on={prefs.autoQueen} onChange={(v) => set({ autoQueen: v })} label="Promote to a queen automatically" />
          <Toggle on={prefs.animate} onChange={(v) => set({ animate: v })} label="Slide pieces when they move" />
          <Toggle on={prefs.sound} onChange={(v) => set({ sound: v })} label="Sounds" />
          <Toggle on={prefs.botChat} onChange={(v) => set({ botChat: v })} label="Show bot chat" />
        </div>
        <div className="mg-card p-4">
          <div className="mg-h2 mb-1">Analysis engine</div>
          <Seg value={prefs.engine} onChange={(v) => set({ engine: v })} options={[{ id: 'builtin', label: 'VibeBlox engine' }, { id: 'stockfish', label: 'Stockfish' }]} testid="engine-choice" />
          <p className="text-xs mg-mute mt-2" data-testid="engine-note">{sf ? 'Stockfish is installed and ready.' : 'Stockfish is not installed in this copy of the game, so the VibeBlox engine is used. Hosts can drop the Stockfish files into public/engines/stockfish/ to turn it on.'}</p>
        </div>
        <div className="mg-card p-4 text-sm mg-mute">
          <div className="mg-h2 mb-1 text-[var(--mg-text)]">On the board</div>
          Right-click a square to mark it red; right-click and drag for an arrow. Hold Shift for green, Ctrl for yellow, Alt for blue. Press <b>T</b> to throw the pieces. In chess, press <b>F</b> to crash out.
        </div>
      </div>
    </div>
  );
}
