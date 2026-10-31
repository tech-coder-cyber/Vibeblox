// 2048. Works with no internet; the score is shared only when you're signed in.
// Every tile is its own piece that slides to its new square, merged tiles pop, and new tiles fade in.
import { useCallback, useEffect, useRef, useState } from 'react';
import * as G from '../arcade/g2048';
import { loadProgress, update, type Prefs } from '../store';
import * as api from '../api';
import { playSfx } from './sfx';

const TILE: Record<number, [string, string]> = {
  2: ['#eee4da', '#5c5348'], 4: ['#ede0c8', '#5c5348'], 8: ['#f2b179', '#fff'], 16: ['#f59563', '#fff'], 32: ['#f67c5f', '#fff'], 64: ['#f65e3b', '#fff'],
  128: ['#edcf72', '#fff'], 256: ['#edcc61', '#fff'], 512: ['#edc850', '#fff'], 1024: ['#edc53f', '#fff'], 2048: ['#edc22e', '#fff'],
};
/** how long a slide takes (the pop of a merged or new tile starts when it ends) */
const SLIDE_MS = 120;

type TS = { tiles: G.Tile[]; nextId: number; score: number; best: number; won: boolean; over: boolean; moves: number };
const newTS = (best: number): TS => { const s = G.startTiles(Math.random); return { tiles: s.tiles, nextId: s.nextId, score: 0, best, won: false, over: false, moves: 0 }; };

export function Game2048({ prefs, signedIn, onBack }: { prefs: Prefs; signedIn: boolean; onBack: () => void }) {
  const [s, setS] = useState<TS>(() => newTS(loadProgress().best2048));
  const sent = useRef(false);
  const touch = useRef<{ x: number; y: number } | null>(null);
  const go = useCallback((d: G.Dir) => {
    setS((cur) => {
      if (cur.over) return cur;
      const m = G.moveTiles(cur.tiles, d, cur.nextId);
      if (!m.moved) return cur;
      const sp = G.spawnTile(m.tiles.map((t) => (t.merged ? t : { ...t })), m.nextId, Math.random);
      const alive = sp.tiles.filter((t) => !t.dying);
      const score = cur.score + m.gained;
      playSfx('move', prefs.sound);
      return { tiles: sp.tiles, nextId: sp.nextId, score, best: Math.max(cur.best, score), won: cur.won || alive.some((t) => t.v >= 2048), over: !G.canMove(G.gridOf(sp.tiles)), moves: cur.moves + 1 };
    });
  }, [prefs.sound]);
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null; if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA')) return;
      const m: Record<string, G.Dir> = { ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down', a: 'left', d: 'right', w: 'up', s: 'down' };
      const d = m[e.key]; if (d) { e.preventDefault(); go(d); }
    };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [go]);
  // tiles that merged have arrived by now: take them off the board
  useEffect(() => {
    if (!s.tiles.some((t) => t.dying)) return;
    const id = window.setTimeout(() => setS((cur) => ({ ...cur, tiles: cur.tiles.filter((t) => !t.dying) })), SLIDE_MS + 20);
    return () => window.clearTimeout(id);
  }, [s.tiles]);
  useEffect(() => {
    if (s.score > loadProgress().best2048) update((p) => { p.best2048 = s.score; });
    if (s.over && !sent.current) { sent.current = true; playSfx('end', prefs.sound); if (signedIn && s.score > 0) void api.submitScore('2048', s.score, { moves: s.moves, tile: Math.max(...G.gridOf(s.tiles)) }); }
  }, [s, signedIn, prefs.sound]);
  const restart = () => { sent.current = false; setS(newTS(Math.max(s.best, loadProgress().best2048))); };

  return (
    <div className="max-w-md mx-auto" data-testid="g2048">
      <div className="flex items-center gap-3 mb-3">
        <div className="mg-h1 flex-1">2048</div>
        <div className="mg-card-flat px-3 py-1 text-center"><div className="text-[10px] mg-mute">Score</div><div className="font-bold" data-testid="score2048">{s.score}</div></div>
        <div className="mg-card-flat px-3 py-1 text-center"><div className="text-[10px] mg-mute">Best</div><div className="font-bold">{Math.max(s.best, s.score)}</div></div>
      </div>
      <div className="relative rounded-2xl p-2 select-none touch-none" style={{ background: '#bbada0' }} data-testid="grid2048"
        onTouchStart={(e) => { touch.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }; }}
        onTouchEnd={(e) => {
          const t = touch.current; if (!t) return;
          const dx = e.changedTouches[0].clientX - t.x, dy = e.changedTouches[0].clientY - t.y;
          if (Math.max(Math.abs(dx), Math.abs(dy)) < 24) return;
          go(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up'));
        }}>
        <div className="relative w-full aspect-square">
          {/* the empty squares */}
          {Array.from({ length: 16 }, (_, i) => (
            <div key={i} className="absolute" style={{ left: `${(i & 3) * 25}%`, top: `${(i >> 2) * 25}%`, width: '25%', height: '25%', padding: 4 }}>
              <div className="w-full h-full rounded-lg" style={{ background: 'rgba(238,228,218,.35)' }} />
            </div>
          ))}
          {/* the tiles: each one keeps its own element, so changing left/top makes it slide */}
          {s.tiles.map((t) => {
            const [bg, fg] = TILE[t.v] ?? ['#3c3a32', '#fff'];
            return (
              <div key={t.id} className="mg-tile absolute" data-testid="tile2048" data-v={t.v}
                style={{ left: `${t.c * 25}%`, top: `${t.r * 25}%`, width: '25%', height: '25%', padding: 4, zIndex: t.dying ? 1 : t.merged ? 3 : 2, transition: `left ${SLIDE_MS}ms ease-out, top ${SLIDE_MS}ms ease-out` }}>
                <div className={`w-full h-full rounded-lg flex items-center justify-center font-extrabold ${t.merged ? 'mg-tile-merge' : t.fresh ? 'mg-tile-new' : ''}`}
                  style={{ background: bg, color: fg, fontSize: t.v >= 1024 ? '1.4rem' : t.v >= 128 ? '1.7rem' : '2.1rem', ['--slide' as string]: `${SLIDE_MS}ms` }}>{t.v}</div>
              </div>
            );
          })}
        </div>
        {s.over && (
          <div className="absolute inset-0 rounded-2xl flex flex-col items-center justify-center gap-3" style={{ background: 'rgba(30,25,20,.7)', zIndex: 10 }} data-testid="over2048">
            <div className="text-2xl font-bold text-white">No more moves</div><div className="text-white/80">You scored {s.score}</div>
            <button className="mg-btn mg-btn-primary" onClick={restart} data-testid="again2048">Play again</button>
          </div>
        )}
      </div>
      <div className="grid grid-cols-3 gap-2 mt-3 w-44 mx-auto sm:hidden">
        <span /><button className="mg-btn" aria-label="Up" onClick={() => go('up')}>↑</button><span />
        <button className="mg-btn" aria-label="Left" onClick={() => go('left')}>←</button><button className="mg-btn" aria-label="Down" onClick={() => go('down')}>↓</button><button className="mg-btn" aria-label="Right" onClick={() => go('right')}>→</button>
      </div>
      <p className="text-xs mg-mute mt-3 text-center">Use the arrow keys, W A S D, or swipe. Matching tiles merge. Reach 2048!{s.won && ' You reached 2048. Keep going!'}</p>
      <div className="flex gap-2 justify-center mt-3"><button className="mg-btn" onClick={restart} data-testid="new2048">New game</button><button className="mg-btn mg-btn-ghost" onClick={onBack}>Back to games</button></div>
      {!signedIn && <p className="text-xs mg-mute text-center mt-2">Sign in to put your score on the leaderboard.</p>}
    </div>
  );
}
