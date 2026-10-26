// 2048 and Tic Tac Toe. Both work with no internet; scores are shared only when you're signed in.
import { useCallback, useEffect, useRef, useState } from 'react';
import * as G from '../arcade/g2048';
import * as T from '../arcade/tictactoe';
import { loadProgress, update, type Prefs } from '../store';
import * as api from '../api';
import { Seg } from './kit';
import { playSfx } from './sfx';

const TILE: Record<number, [string, string]> = {
  2: ['#eee4da', '#5c5348'], 4: ['#ede0c8', '#5c5348'], 8: ['#f2b179', '#fff'], 16: ['#f59563', '#fff'], 32: ['#f67c5f', '#fff'], 64: ['#f65e3b', '#fff'],
  128: ['#edcf72', '#fff'], 256: ['#edcc61', '#fff'], 512: ['#edc850', '#fff'], 1024: ['#edc53f', '#fff'], 2048: ['#edc22e', '#fff'],
};

export function Game2048({ prefs, signedIn, onBack }: { prefs: Prefs; signedIn: boolean; onBack: () => void }) {
  const [s, setS] = useState(() => G.newGame(Math.random, loadProgress().best2048));
  const sent = useRef(false);
  const touch = useRef<{ x: number; y: number } | null>(null);
  const go = useCallback((d: G.Dir) => {
    setS((cur) => {
      if (cur.over) return cur;
      const n = G.play(cur, d, Math.random);
      if (n === cur) return cur;
      playSfx('move', prefs.sound);
      return n;
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
  useEffect(() => {
    if (s.score > loadProgress().best2048) update((p) => { p.best2048 = s.score; });
    if (s.over && !sent.current) { sent.current = true; playSfx('end', prefs.sound); if (signedIn && s.score > 0) void api.submitScore('2048', s.score, { moves: s.moves, tile: G.maxTile(s.grid) }); }
  }, [s, signedIn, prefs.sound]);
  const restart = () => { sent.current = false; setS(G.newGame(Math.random, Math.max(s.best, loadProgress().best2048))); };

  return (
    <div className="max-w-md mx-auto" data-testid="g2048">
      <div className="flex items-center gap-3 mb-3">
        <div className="mg-h1 flex-1">2048</div>
        <div className="mg-card-flat px-3 py-1 text-center"><div className="text-[10px] mg-mute">Score</div><div className="font-bold" data-testid="score2048">{s.score}</div></div>
        <div className="mg-card-flat px-3 py-1 text-center"><div className="text-[10px] mg-mute">Best</div><div className="font-bold">{Math.max(s.best, s.score)}</div></div>
      </div>
      <div className="relative rounded-2xl p-2 select-none touch-none" style={{ background: '#bbada0' }} data-testid="grid2048"
        onTouchStart={(e) => { touch.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }; }}
        onTouchEnd={(e) => { const t = touch.current; if (!t) return; const dx = e.changedTouches[0].clientX - t.x, dy = e.changedTouches[0].clientY - t.y; if (Math.max(Math.abs(dx), Math.abs(dy)) < 24) return; go(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up')); }}>
        <div className="grid grid-cols-4 gap-2">
          {s.grid.map((v, i) => {
            const [bg, fg] = TILE[v] ?? ['#3c3a32', '#fff'];
            return <div key={i} className="aspect-square rounded-lg flex items-center justify-center font-extrabold" style={{ background: v ? bg : 'rgba(238,228,218,.35)', color: fg, fontSize: v >= 1024 ? '1.4rem' : v >= 128 ? '1.7rem' : '2rem', transition: 'background .1s' }} data-v={v}>{v || ''}</div>;
          })}
        </div>
        {(s.over || (s.won && !s.over && false)) && (
          <div className="absolute inset-0 rounded-2xl flex flex-col items-center justify-center gap-3" style={{ background: 'rgba(30,25,20,.7)' }} data-testid="over2048">
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

export function TicTacToe({ prefs, signedIn, onBack }: { prefs: Prefs; signedIn: boolean; onBack: () => void }) {
  const [level, setLevel] = useState<T.Level>('normal');
  const [mark, setMark] = useState<'X' | 'O'>('X');
  const [b, setB] = useState<T.Board>(T.emptyBoard());
  const [rec, setRec] = useState(() => loadProgress().ttt);
  const counted = useRef(false);
  const me: T.Cell = mark === 'X' ? 1 : 2, ai: T.Cell = mark === 'X' ? 2 : 1;
  const res = T.result(b);
  const turn: T.Cell = b.filter((c) => c === 1).length === b.filter((c) => c === 2).length ? 1 : 2;
  const win = T.winner(b);

  useEffect(() => {
    if (res || turn !== ai) return;
    const t = setTimeout(() => { setB((cur) => { if (T.result(cur)) return cur; const mv = T.aiMove(cur, ai, level); const n = cur.slice() as T.Board; n[mv] = ai; return n; }); playSfx('move', prefs.sound); }, 380);
    return () => clearTimeout(t);
  }, [b, res, turn, ai, level, prefs.sound]);
  useEffect(() => {
    if (!res || counted.current) return;
    counted.current = true;
    const out = res === 'draw' ? 1 : res === mark ? 0 : 2; // [wins, draws, losses]
    const p = update((q) => { q.ttt[level as keyof typeof q.ttt][out]++; });
    setRec(p.ttt);
    playSfx(out === 0 ? 'win' : out === 2 ? 'lose' : 'end', prefs.sound);
    if (signedIn) { const w = p.ttt.hard[0] * 3 + p.ttt.normal[0] + p.ttt.hard[1]; void api.submitScore('tictactoe', w, { hard: p.ttt.hard, normal: p.ttt.normal, easy: p.ttt.easy }); }
  }, [res, mark, level, signedIn, prefs.sound]);
  const click = (i: number) => { if (res || b[i] || turn !== me) return; const n = b.slice() as T.Board; n[i] = me; setB(n); playSfx('move', prefs.sound); };
  const reset = (m = mark) => { counted.current = false; setMark(m); setB(T.emptyBoard()); };
  const r = rec[level as keyof typeof rec];

  return (
    <div className="max-w-sm mx-auto" data-testid="ttt">
      <div className="mg-h1 mb-3">Tic Tac Toe</div>
      <div className="flex flex-wrap gap-3 mb-3 items-center">
        <Seg value={level} onChange={(l) => { setLevel(l); reset(); }} options={[{ id: 'easy', label: 'Easy' }, { id: 'normal', label: 'Normal' }, { id: 'hard', label: 'Hard' }]} testid="ttt-level" />
        <Seg value={mark} onChange={(m) => reset(m)} options={[{ id: 'X', label: 'Play X (first)' }, { id: 'O', label: 'Play O' }]} testid="ttt-mark" />
      </div>
      <div className="grid grid-cols-3 gap-2 p-2 rounded-2xl mg-card" data-testid="ttt-board">
        {b.map((c, i) => {
          const inLine = win.line?.includes(i);
          return <button key={i} aria-label={`Square ${i + 1}${c ? ' ' + (c === 1 ? 'X' : 'O') : ''}`} onClick={() => click(i)} disabled={!!res || !!c || turn !== me}
            className="aspect-square rounded-xl text-5xl font-extrabold flex items-center justify-center" data-testid={`ttt-${i}`}
            style={{ background: inLine ? 'rgba(61,220,154,.22)' : 'var(--mg-panel2)', color: c === 1 ? 'var(--mg-accent)' : 'var(--mg-blue)', border: '1px solid var(--mg-line)' }}>{c === 1 ? 'X' : c === 2 ? 'O' : ''}</button>;
        })}
      </div>
      <div className="text-center mt-3 min-h-[1.5rem]" data-testid="ttt-status">{res ? (res === 'draw' ? "It's a draw." : res === mark ? 'You win!' : 'The computer wins.') : turn === me ? 'Your move' : 'Thinking...'}</div>
      <div className="mg-card p-3 mt-3 text-sm flex justify-around" data-testid="ttt-record"><span>Won <b>{r[0]}</b></span><span>Drawn <b>{r[1]}</b></span><span>Lost <b>{r[2]}</b></span><span className="mg-mute">({level})</span></div>
      <div className="flex gap-2 justify-center mt-3"><button className="mg-btn mg-btn-primary" onClick={() => reset()} data-testid="ttt-again">New game</button><button className="mg-btn mg-btn-ghost" onClick={onBack}>Back to games</button></div>
    </div>
  );
}
