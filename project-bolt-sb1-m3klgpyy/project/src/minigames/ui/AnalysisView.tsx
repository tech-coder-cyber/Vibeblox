// Game analysis: an evaluation bar and graph, a grade for every move, accuracy, and the moments that mattered.
import { useEffect, useMemo, useRef, useState } from 'react';
import { Game } from '../chess/rules';
import { analyzeGame, classCounts, evalSeries, keyMoments, sideAccuracy, CLASS_LABEL, CLASS_SYMBOL, type MoveClass, type PlyAnalysis } from '../chess/analysis';
import { barFraction, scoreText } from '../chess/engine';
import { openingName } from '../chess/openings';
import { analysisEngine, hasStockfish } from '../engineClient';
import type { Prefs } from '../store';
import ChessBoardView, { uciSquares } from './ChessBoardView';
import { useBoardFx } from './Board';
import { MoveList, Seg } from './kit';
import type { ReviewRequest } from './ChessBotGame';

const CLS_COLOR: Record<MoveClass, string> = { book: '#8c8f98', best: '#5cbd9d', excellent: '#7fcf8a', good: '#a9c97a', inaccuracy: '#e8c34f', mistake: '#ee9a4d', blunder: '#e8665d' };

export default function AnalysisView({ req, prefs, onPrefs, onBack }: { req: ReviewRequest; prefs: Prefs; onPrefs: (p: Prefs) => void; onBack: () => void }) {
  const game = useMemo(() => Game.fromMoves(req.moves, req.startFen).game, [req]);
  const [an, setAn] = useState<PlyAnalysis[] | null>(null);
  const [progress, setProgress] = useState(0);
  const [view, setView] = useState(0);
  const [sf, setSf] = useState(false);
  const [note, setNote] = useState('');
  const [flip, setFlip] = useState(false);
  const token = useRef({ cancelled: false });
  const { fx } = useBoardFx({ allowSlam: false, sound: prefs.sound, enabled: false });
  const total = game.plies.length;

  useEffect(() => { void hasStockfish().then(setSf); }, []);
  useEffect(() => {
    const t = { cancelled: false }; token.current = t;
    setAn(null); setProgress(0); setNote('');
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
  }, [game, prefs.engine]);

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
        <div className="w-4 rounded overflow-hidden shrink-0 border flex flex-col" style={{ borderColor: 'var(--mg-line)' }} data-testid="an-eval-bar" title={scoreText(cur)}>
          <div style={{ height: `${(1 - barFraction(cur)) * 100}%`, background: '#23262c', transition: 'height .25s' }} /><div style={{ height: `${barFraction(cur) * 100}%`, background: '#f2efe6', transition: 'height .25s' }} />
        </div>
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
          {!an ? (
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
              {(['best', 'excellent', 'good', 'inaccuracy', 'mistake', 'blunder'] as MoveClass[]).map((c) => (
                <div key={c} className="contents"><span><span className="inline-block w-2.5 h-2.5 rounded-full mr-2" style={{ background: CLS_COLOR[c] }} />{CLASS_LABEL[c]}</span><span className="text-right">{cw[c]}</span><span className="text-right">{cb[c]}</span></div>
              ))}
            </div>
          </div>
        )}
        <div className="mg-card p-3">
          <div className="mg-h2 mb-1">{openingName(sans) ?? 'Moves'}</div>
          <MoveList moves={sans} view={view} onView={setView} extra={(ply) => an && an[ply - 1] && an[ply - 1].cls !== 'good' && an[ply - 1].cls !== 'best' && an[ply - 1].cls !== 'book' && an[ply - 1].cls !== 'excellent' ? <span className="ml-0.5 font-bold" style={{ color: CLS_COLOR[an[ply - 1].cls] }}>{CLASS_SYMBOL[an[ply - 1].cls]}</span> : null} />
          {here && (
            <div className="text-sm mt-2" data-testid="an-here"><b style={{ color: CLS_COLOR[here.cls] }}>{here.san} · {CLASS_LABEL[here.cls]}</b>
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
