// Game analysis: an evaluation bar and graph, a grade for every move, accuracy, and the moments that mattered.
import { useEffect, useMemo, useRef, useState } from 'react';
import { Game, Position } from '../chess/rules';
import { analyzeGame, classCounts, evalSeries, keyMoments, sideAccuracy, CLASS_LABEL, CLASS_SYMBOL, type MoveClass, type PlyAnalysis } from '../chess/analysis';
import { barFraction, scoreText } from '../chess/engine';
import { openingName } from '../chess/openings';
import { analysisEngine, hasStockfish } from '../engineClient';
import { reviewKey, reviewLimit, reviewsLeft, useReview, type Prefs } from '../store';
import ChessBoardView, { uciSquares } from './ChessBoardView';
import { useBoardFx } from './Board';
import { MoveList, Seg } from './kit';
import type { ReviewRequest } from './ChessBotGame';

const CLS_COLOR: Record<MoveClass, string> = { brilliant: '#26c2a3', great: '#5b9bd5', book: '#8c8f98', best: '#5cbd9d', excellent: '#7fcf8a', good: '#a9c97a', inaccuracy: '#e8c34f', mistake: '#ee9a4d', blunder: '#e8665d' };

/** The evaluation bar, with the number on it (like chess.com): at the bottom when White is better, at the top when Black is. */
export function EvalBar({ score, flipped, testid = 'an-eval-bar' }: { score: number; flipped?: boolean; testid?: string }) {
  const f = barFraction(score), txt = scoreText(score).replace('+', '');
  const whiteBetter = score >= 0;
  const atBottom = whiteBetter !== !!flipped;
  return (
    <div className="w-7 rounded overflow-hidden shrink-0 border relative flex flex-col" style={{ borderColor: 'var(--mg-line)', minHeight: 120, flexDirection: flipped ? 'column-reverse' : 'column' }} data-testid={testid} title={scoreText(score)}>
      <div style={{ flexGrow: 1 - f, background: '#403d39', transition: 'flex-grow .25s' }} /><div style={{ flexGrow: f, background: '#f2efe6', transition: 'flex-grow .25s' }} />
      <span className="absolute left-0 right-0 text-center font-bold" data-testid={testid + '-num'} style={{ fontSize: 10, [atBottom ? 'bottom' : 'top']: 3, color: whiteBetter ? '#262522' : '#f2efe6' }}>{txt}</span>
    </div>
  );
}

export default function AnalysisView(p: { req: ReviewRequest; rank: string; prefs: Prefs; onPrefs: (p: Prefs) => void; onBack: () => void }) {
  return p.req.explore ? <ExploreView {...p} /> : <ReviewView {...p} />;
}

function ReviewView({ req, rank, prefs, onPrefs, onBack }: { req: ReviewRequest; rank: string; prefs: Prefs; onPrefs: (p: Prefs) => void; onBack: () => void }) {
  const [blocked, setBlocked] = useState(false);
  const game = useMemo(() => Game.fromMoves(req.moves, req.startFen).game, [req]);
  const [an, setAn] = useState<PlyAnalysis[] | null>(null);
  const [progress, setProgress] = useState(0);
  const [view, setView] = useState(0);
  const [sf, setSf] = useState(false);
  const [note, setNote] = useState('');
  const [flip, setFlip] = useState(false);
  const token = useRef({ cancelled: false });
  const { fx } = useBoardFx({ allowSlam: false, sound: prefs.sound, enabled: false, soundTheme: prefs.soundTheme });
  const total = game.plies.length;

  useEffect(() => { void hasStockfish().then(setSf); }, []);
  useEffect(() => {
    const t = { cancelled: false }; token.current = t;
    setAn(null); setProgress(0); setNote(''); setBlocked(false);
    if (!useReview(rank, reviewKey(req.moves, req.startFen))) { setBlocked(true); return; }
    void (async () => {
      let eng = await analysisEngine(prefs.engine);
      if (prefs.engine === 'stockfish' && eng.id !== 'stockfish') setNote('Stockfish is not installed here, so the built-in engine is checking your game.');
      try {
        const a = await analyzeGame(game, eng, { depth: eng.id === 'stockfish' ? 14 : 9, timeMs: eng.id === 'stockfish' ? 250 : 350, bookPlies: 6, onProgress: (d, n) => !t.cancelled && setProgress(d / Math.max(1, n)), signal: t });
        if (!t.cancelled) { setAn(a); setView(0); }
      } catch { if (!t.cancelled) setNote('The engine stopped. Try again, or pick the built-in engine.'); }
      eng = null as never;
    })();
    return () => { t.cancelled = true; };
  }, [game, prefs.engine, rank, req]);

  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null; if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA')) return;
      if (e.key === 'ArrowLeft') { setView((v) => Math.max(0, v - 1)); e.preventDefault(); }
      if (e.key === 'ArrowRight') { setView((v) => Math.min(total, v + 1)); e.preventDefault(); }
    };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [total]);

  const series = an ? evalSeries(an) : [0];
  const cur = series[Math.min(view, series.length - 1)] ?? 0;
  const here = an && view > 0 ? an[view - 1] : null;
  const next = an && view < total ? an[view] : null; // the move about to be played: show the engine's pick
  const arrows = next && next.best !== next.move ? [{ ...uciSquares(game.pos.uci(next.best)), color: '#3fae5a' }] : [];
  const sans = game.sanList();
  const w = an ? sideAccuracy(an, 0) : 0, b = an ? sideAccuracy(an, 1) : 0;
  const cw = an ? classCounts(an, 0) : null, cb = an ? classCounts(an, 1) : null;
  const moments = an ? keyMoments(an, 4) : [];
  const orient = (flip ? (req.orientation ^ 1) : req.orientation) as 0 | 1;
  const g = useMemo(() => { const x = new Game(game.startFen); for (let i = 0; i < Math.min(view, total); i++) x.play(game.plies[i].move); return x; }, [game, view, total]);

  // the graph
  const W = 320, H = 70;
  const pts = series.map((s, i) => `${(i / Math.max(1, series.length - 1)) * W},${H / 2 - (Math.max(-600, Math.min(600, s)) / 600) * (H / 2 - 3)}`).join(' ');

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,640px)_1fr]" data-testid="analysis">
      <div className="flex gap-2 min-w-0">
        <EvalBar score={cur} flipped={orient === 1} />
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold mb-1 flex justify-between"><span>{req.title}</span><span className="mg-mute" data-testid="an-score">{an ? scoreText(cur) : '...'}</span></div>
          <ChessBoardView game={g} version={view} orientation={orient} myColor={null} canMove={false} onUserMove={() => undefined} viewPly={null} prefs={prefs} arrows={arrows} fx={fx} />
          <div className="flex gap-2 mt-3 items-center">
            <button className="mg-btn" onClick={() => setView(0)} aria-label="Start">⏮</button>
            <button className="mg-btn" onClick={() => setView((v) => Math.max(0, v - 1))} aria-label="Back">◀</button>
            <button className="mg-btn" onClick={() => setView((v) => Math.min(total, v + 1))} aria-label="Next" data-testid="an-next">▶</button>
            <button className="mg-btn" onClick={() => setView(total)} aria-label="End">⏭</button>
            <button className="mg-btn mg-btn-ghost ml-auto" onClick={() => setFlip((f) => !f)}>Flip</button>
          </div>
        </div>
      </div>
      <div className="space-y-3 min-w-0">
        <div className="mg-card p-3">
          {blocked ? (
            <div data-testid="an-blocked" className="text-sm space-y-2">
              <div className="mg-h2">You've used today's game reviews</div>
              <p className="mg-mute">Your rank allows {reviewLimit(rank)} new game reviews a day. {rank === 'none' || !rank ? 'Vanguard gets 10, Elite has no limit, and Champion is unlimited.' : rank === 'vanguard' ? 'Elite has no limit, and Champion is unlimited.' : ''} Games you already reviewed today stay free, and you can explore a position or set one up any time.</p>
              <button className="mg-btn" onClick={onBack}>Back</button>
            </div>
          ) : !an ? (
            <div data-testid="an-progress"><div className="text-sm mb-2">Looking at every move... {Math.round(progress * 100)}%</div><div className="h-2 rounded bg-[var(--mg-bg)] overflow-hidden"><div className="h-full" style={{ width: `${progress * 100}%`, background: 'var(--mg-accent)' }} /></div></div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3 text-center" data-testid="an-accuracy">
                <div><div className="text-xs mg-mute">White accuracy</div><div className="text-2xl font-bold">{w.toFixed(1)}%</div></div>
                <div><div className="text-xs mg-mute">Black accuracy</div><div className="text-2xl font-bold">{b.toFixed(1)}%</div></div>
              </div>
              <svg viewBox={`0 0 ${W} ${H}`} className="w-full mt-2 rounded" style={{ background: 'var(--mg-bg)' }} role="img" aria-label="Evaluation over the game" data-testid="an-graph"
                onClick={(e) => { const r = (e.currentTarget as SVGSVGElement).getBoundingClientRect(); setView(Math.round(((e.clientX - r.left) / r.width) * total)); }}>
                <line x1="0" x2={W} y1={H / 2} y2={H / 2} stroke="#46546c" strokeDasharray="3 3" />
                <polyline points={pts} fill="none" stroke="#3ddc9a" strokeWidth="2" />
                <line x1={(view / Math.max(1, total)) * W} x2={(view / Math.max(1, total)) * W} y1="0" y2={H} stroke="#6aa8f0" strokeWidth="1.5" />
              </svg>
            </>
          )}
          {note && <div className="text-xs mg-mute mt-2" data-testid="an-note">{note}</div>}
        </div>
        {an && cw && cb && (
          <div className="mg-card p-3 text-sm" data-testid="an-classes">
            <div className="grid grid-cols-[1fr_auto_auto] gap-x-4 gap-y-1">
              <span /><span className="mg-mute text-xs text-right">White</span><span className="mg-mute text-xs text-right">Black</span>
              {(['brilliant', 'great', 'best', 'excellent', 'good', 'book', 'inaccuracy', 'mistake', 'blunder'] as MoveClass[]).map((c) => (
                <div key={c} className="contents"><span><span className="inline-block w-2.5 h-2.5 rounded-full mr-2" style={{ background: CLS_COLOR[c] }} />{CLASS_LABEL[c]}</span><span className="text-right">{cw[c]}</span><span className="text-right">{cb[c]}</span></div>
              ))}
            </div>
          </div>
        )}
        <div className="mg-card p-3">
          <div className="mg-h2 mb-1">{openingName(sans) ?? 'Moves'}</div>
          <MoveList moves={sans} view={view} onView={setView} extra={(ply) => { const c = an?.[ply - 1]?.cls; return c && c !== 'good' && c !== 'best' && c !== 'excellent' ? <span className="ml-0.5 font-bold" style={{ color: CLS_COLOR[c] }} data-testid={`mark-${c}`}>{CLASS_SYMBOL[c]}</span> : null; }} />
          {here && (
            <div className="text-sm mt-2" data-testid="an-here"><b style={{ color: CLS_COLOR[here.cls] }}>{here.san} {CLASS_SYMBOL[here.cls]} · {CLASS_LABEL[here.cls]}{here.cls === 'book' ? (openingName(sans.slice(0, view)) ? ` (${openingName(sans.slice(0, view))})` : '') : ''}</b>
              {here.best !== here.move && here.cls !== 'book' && <span className="mg-mute"> The engine liked {here.bestSan}.</span>}</div>
          )}
        </div>
        {moments.length > 0 && (
          <div className="mg-card p-3"><div className="mg-h2 mb-1">Key moments</div>
            <div className="flex flex-wrap gap-2" data-testid="an-moments">{moments.map((m) => <button key={m.ply} className="mg-btn mg-btn-sm" onClick={() => setView(m.ply - 1)}>{Math.ceil(m.ply / 2)}{m.color === 0 ? '.' : '...'} {m.san} <span style={{ color: CLS_COLOR[m.cls] }}>{CLASS_SYMBOL[m.cls]}</span></button>)}</div></div>
        )}
        <div className="mg-card p-3 flex items-center gap-3 flex-wrap">
          <span className="text-sm">Engine</span>
          <Seg value={prefs.engine} onChange={(v) => onPrefs({ ...prefs, engine: v })} options={[{ id: 'builtin', label: 'VibeBlox' }, { id: 'stockfish', label: sf ? 'Stockfish' : 'Stockfish (not installed)' }]} testid="an-engine" />
        </div>
        <button className="mg-btn mg-btn-ghost" onClick={onBack}>Back to games</button>
      </div>
    </div>
  );
}


function ExploreView({ req, prefs, onPrefs, onBack }: { req: ReviewRequest; rank: string; prefs: Prefs; onPrefs: (p: Prefs) => void; onBack: () => void }) {
  const gameRef = useRef(new Game(req.startFen));
  const game = gameRef.current;
  const [ver, setVer] = useState(0);
  const [flip, setFlip] = useState(false);
  const [lines, setLines] = useState<Array<{ score: number; san: string; pv: string }>>([]);
  const [busy, setBusy] = useState(true);
  const [note, setNote] = useState('');
  const [sf, setSf] = useState(false);
  const { fx } = useBoardFx({ allowSlam: false, sound: prefs.sound, enabled: false, soundTheme: prefs.soundTheme });
  const orient = (flip ? (req.orientation ^ 1) : req.orientation) as 0 | 1;

  useEffect(() => { void hasStockfish().then(setSf); }, []);
  useEffect(() => {
    let live = true;
    setBusy(true);
    void (async () => {
      try {
        const eng = await analysisEngine(prefs.engine);
        if (prefs.engine === 'stockfish' && eng.id !== 'stockfish') setNote('Stockfish is not installed here, so the built-in engine is thinking.'); else setNote('');
        const pos = game.pos;
        if (game.over) { if (live) { setLines([]); setBusy(false); } return; }
        const ls = await eng.lines(pos.toFen(), 3, eng.id === 'stockfish' ? 16 : 9, eng.id === 'stockfish' ? 900 : 700);
        if (!live) return;
        setLines(ls.map((l) => {
          const q = Position.fromFen(pos.toFen()); const out: string[] = [];
          for (const m of l.pv.slice(0, 6)) { out.push(q.san(m)); q.make(m); }
          return { score: pos.turn === 0 ? l.score : -l.score, san: pos.san(l.move), pv: out.join(' ') };
        }));
        setBusy(false);
      } catch { if (live) { setNote('The engine stopped. Try again, or pick the built-in engine.'); setBusy(false); } }
    })();
    return () => { live = false; };
  }, [ver, game, prefs.engine]);

  const cur = game.over ? (game.result === '1-0' ? 99000 : game.result === '0-1' ? -99000 : 0) : lines[0]?.score ?? 0;
  const sans = game.sanList();
  const best = lines[0] ? uciSquares(game.pos.uci(game.pos.parseSan(lines[0].san))) : null;
  const onUserMove = (uci: string) => { if (game.play(uci)) setVer((v) => v + 1); };
  const undo = () => { if (game.undo()) setVer((v) => v + 1); };
  const opening = openingName(sans);

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,640px)_1fr]" data-testid="analysis-explore">
      <div className="flex gap-2 min-w-0">
        <EvalBar score={cur} flipped={orient === 1} />
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold mb-1 flex justify-between"><span>{req.title}{opening ? ` · ${opening}` : ''}</span><span className="mg-mute" data-testid="an-score">{busy ? '...' : scoreText(cur)}</span></div>
          <ChessBoardView game={game} version={ver} orientation={orient} myColor={game.turn} canMove={!game.over} onUserMove={onUserMove} viewPly={null} prefs={{ ...prefs, autoQueen: true }} arrows={best && !busy ? [{ ...best, color: '#3fae5a' }] : []} fx={fx} noPremove />
          <div className="flex gap-2 mt-3">
            <button className="mg-btn" onClick={undo} disabled={!game.plies.length} data-testid="ex-undo">Take back</button>
            <button className="mg-btn" onClick={() => setFlip((f) => !f)}>Flip</button>
          </div>
        </div>
      </div>
      <div className="space-y-3 min-w-0">
        <div className="mg-card p-3" data-testid="ex-lines">
          <div className="mg-h2 mb-1">Best moves</div>
          {busy && <div className="text-sm mg-mute">Thinking...</div>}
          {!busy && !lines.length && <div className="text-sm mg-mute">{game.over ? 'The game is over.' : 'No moves found.'}</div>}
          {lines.map((l, i) => <div key={i} className="text-sm py-1 flex gap-2" data-testid="ex-line"><b className="w-14 shrink-0">{scoreText(l.score)}</b><span className="truncate"><b>{l.san}</b> <span className="mg-mute">{l.pv.split(' ').slice(1).join(' ')}</span></span></div>)}
          {note && <div className="text-xs mg-mute mt-1">{note}</div>}
        </div>
        <div className="mg-card p-3"><div className="mg-h2 mb-1">{opening ?? 'Moves'}</div><MoveList moves={sans} view={sans.length} onView={() => undefined} /></div>
        <div className="mg-card p-3 flex items-center gap-3 flex-wrap">
          <span className="text-sm">Engine</span>
          <Seg value={prefs.engine} onChange={(v) => onPrefs({ ...prefs, engine: v })} options={[{ id: 'stockfish', label: sf ? 'Stockfish' : 'Stockfish (not installed)' }, { id: 'builtin', label: 'VibeBlox' }]} testid="an-engine" />
        </div>
        <button className="mg-btn mg-btn-ghost" onClick={onBack}>Back</button>
      </div>
    </div>
  );
}
void reviewsLeft;
