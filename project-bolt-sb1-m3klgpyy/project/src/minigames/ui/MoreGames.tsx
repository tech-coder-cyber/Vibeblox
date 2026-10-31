// Minesweeper and Connect 4. Both work with no internet; best times and win counts are kept on this device.
import { useCallback, useEffect, useRef, useState } from 'react';
import * as M from '../arcade/minesweeper';
import * as C from '../arcade/connect4';
import type { Prefs } from '../store';
import { Seg } from './kit';
import { playSfx } from './sfx';

const read = <T,>(key: string, fallback: T): T => { try { const v = localStorage.getItem(key); return v ? { ...fallback, ...JSON.parse(v) } : fallback; } catch { return fallback; } };
const write = (key: string, v: unknown) => { try { localStorage.setItem(key, JSON.stringify(v)); } catch { /* storage may be blocked */ } };

// ---------------------------------------------------------------- Minesweeper
const NUM_COLOR = ['', '#6aa8f0', '#5cbd9d', '#e87b72', '#9b8cf0', '#e0a458', '#4fc3c3', '#ede9e0', '#9ba5b5'];
const MS_BEST = 'vb-mg-minesweeper-best';

export function Minesweeper({ prefs, onBack }: { prefs: Prefs; onBack: () => void }) {
  const [level, setLevel] = useState<M.Level>('beginner');
  const [s, setS] = useState(() => M.newGame('beginner'));
  const [flagMode, setFlagMode] = useState(false);
  const [secs, setSecs] = useState(0);
  const [best, setBest] = useState<Record<M.Level, number>>(() => read(MS_BEST, { beginner: 0, intermediate: 0, expert: 0 }));
  const started = useRef(0);
  const hold = useRef<number | null>(null);
  const held = useRef(false);
  const counted = useRef(false);

  const fresh = (l: M.Level = level) => { counted.current = false; started.current = 0; setSecs(0); setS(M.newGame(l)); };
  useEffect(() => {
    if (s.status !== 'playing') return;
    if (!started.current) started.current = Date.now();
    const id = window.setInterval(() => setSecs(Math.min(999, Math.floor((Date.now() - started.current) / 1000))), 250);
    return () => window.clearInterval(id);
  }, [s.status]);
  useEffect(() => {
    if (counted.current) return;
    if (s.status === 'won') {
      counted.current = true; playSfx('win', prefs.sound);
      const t = Math.max(1, Math.round((Date.now() - started.current) / 1000));
      setBest((b) => { const n = { ...b, [level]: b[level] && b[level] < t ? b[level] : t }; write(MS_BEST, n); return n; });
    } else if (s.status === 'lost') { counted.current = true; playSfx('lose', prefs.sound); }
  }, [s.status, level, prefs.sound]);

  const press = (i: number) => { setS((cur) => { const n = flagMode && !cur.cells[i].open ? M.toggleFlag(cur, i) : M.reveal(cur, i); if (n !== cur) playSfx('move', prefs.sound); return n; }); };
  const flag = (i: number) => setS((cur) => M.toggleFlag(cur, i));
  const left = s.mines - M.flagsUsed(s);
  const size = s.w > 16 ? 26 : 32;

  return (
    <div className="max-w-full mx-auto" data-testid="minesweeper">
      <div className="flex flex-wrap items-center gap-3 mb-3">
        <div className="mg-h1 flex-1">Minesweeper</div>
        <Seg value={level} onChange={(l) => { setLevel(l); fresh(l); }} options={(Object.keys(M.LEVELS) as M.Level[]).map((l) => ({ id: l, label: M.LEVELS[l].label }))} testid="ms-level" />
      </div>
      <div className="flex items-center gap-3 mb-3">
        <div className="mg-card-flat px-3 py-1 text-center min-w-[4.5rem]"><div className="text-[10px] mg-mute">Mines left</div><div className="font-bold" data-testid="ms-left">{left}</div></div>
        <button className="mg-btn flex-1" onClick={() => fresh()} data-testid="ms-new" aria-label="New game">{s.status === 'lost' ? '😵 Try again' : s.status === 'won' ? '😎 Play again' : '🙂 New game'}</button>
        <div className="mg-card-flat px-3 py-1 text-center min-w-[4.5rem]"><div className="text-[10px] mg-mute">Time</div><div className="font-bold" data-testid="ms-time">{secs}</div></div>
      </div>
      <div className="overflow-auto mg-scroll pb-2">
        <div className="mg-card p-2 inline-block select-none" style={{ touchAction: 'manipulation' }} onContextMenu={(e) => e.preventDefault()} data-testid="ms-board">
          <div className="grid gap-[2px]" style={{ gridTemplateColumns: `repeat(${s.w}, ${size}px)` }}>
            {s.cells.map((c, i) => {
              const boom = s.boom === i;
              const bg = c.open ? (c.mine ? (boom ? '#a33a34' : '#4a2a2a') : '#1a212c') : '#33405a';
              return (
                <button key={i} data-testid={`ms-${i}`} aria-label={`Square ${i + 1}${c.open ? (c.mine ? ' mine' : ` ${c.n}`) : c.flag ? ' flagged' : ''}`}
                  className="flex items-center justify-center rounded-[5px] font-extrabold" style={{ width: size, height: size, background: bg, color: NUM_COLOR[c.n], fontSize: size * 0.55, border: c.open ? '1px solid #232c3b' : '1px solid #4a5a7a', cursor: c.open && !c.n ? 'default' : 'pointer' }}
                  onClick={() => { if (held.current) { held.current = false; return; } press(i); }}
                  onContextMenu={(e) => { e.preventDefault(); flag(i); }}
                  onTouchStart={() => { held.current = false; hold.current = window.setTimeout(() => { held.current = true; flag(i); }, 380); }}
                  onTouchEnd={() => { if (hold.current) window.clearTimeout(hold.current); }} onTouchMove={() => { if (hold.current) window.clearTimeout(hold.current); }}>
                  {c.open ? (c.mine ? '💣' : c.n || '') : c.flag ? '🚩' : ''}
                </button>
              );
            })}
          </div>
        </div>
      </div>
      <div className="text-center mt-2 min-h-[1.5rem] font-semibold" data-testid="ms-status">{s.status === 'won' ? `You cleared the board in ${secs} seconds!` : s.status === 'lost' ? 'Boom! You hit a mine.' : s.status === 'ready' ? 'Open any square to start. Your first square is always safe.' : ''}</div>
      <div className="flex flex-wrap gap-2 justify-center mt-2 items-center">
        <button className="mg-btn" aria-pressed={flagMode} onClick={() => setFlagMode((f) => !f)} data-testid="ms-flagmode" style={flagMode ? { borderColor: 'var(--mg-accent)' } : undefined}>🚩 Flag mode {flagMode ? 'on' : 'off'}</button>
        <button className="mg-btn mg-btn-ghost" onClick={onBack}>Back to games</button>
      </div>
      <p className="text-xs mg-mute mt-3 text-center">Click to open a square. Right-click (or hold on a phone) to flag a mine. Click a number that has enough flags around it to open the rest of its neighbours.</p>
      <p className="text-xs mg-mute text-center mt-1" data-testid="ms-best">Best times: {(Object.keys(M.LEVELS) as M.Level[]).map((l) => `${M.LEVELS[l].label} ${best[l] ? best[l] + 's' : '-'}`).join('  ·  ')}</p>
    </div>
  );
}

// ---------------------------------------------------------------- Connect 4
type Mode = 'cpu' | 'two';
const C4_REC = 'vb-mg-connect4-record';
const RED = '#e8574f', YEL = '#f2c94c';

export function Connect4({ prefs, onBack }: { prefs: Prefs; onBack: () => void }) {
  const [mode, setMode] = useState<Mode>('cpu');
  const [level, setLevel] = useState<C.Level>('normal');
  const [first, setFirst] = useState<'me' | 'cpu'>('me');
  const [b, setB] = useState<C.Board>(C.emptyBoard());
  const [turn, setTurn] = useState<1 | 2>(1);
  const [last, setLast] = useState<number | null>(null);
  const [hover, setHover] = useState<number | null>(null);
  const [rec, setRec] = useState(() => read(C4_REC, { easy: [0, 0, 0], normal: [0, 0, 0], hard: [0, 0, 0] } as Record<string, number[]>));
  const counted = useRef(false);
  const me: 1 | 2 = mode === 'cpu' && first === 'cpu' ? 2 : 1;
  const cpu: 1 | 2 = me === 1 ? 2 : 1;
  const res = C.result(b);
  const line = C.winningLine(b);
  const winner = line ? (b[line[0]] as 1 | 2) : 0;

  const reset = useCallback(() => { counted.current = false; setB(C.emptyBoard()); setTurn(1); setLast(null); }, []);
  const play = useCallback((col: number, who: 1 | 2) => {
    setB((cur) => {
      const n = C.drop(cur, col, who);
      if (!n) return cur;
      setLast(C.landing(cur, col) * C.COLS + col); setTurn(who === 1 ? 2 : 1); playSfx('move', prefs.sound);
      return n;
    });
  }, [prefs.sound]);
  const click = (col: number) => { if (res || C.landing(b, col) < 0) return; if (mode === 'cpu' && turn !== me) return; play(col, turn); };

  // the computer thinks a moment (so the board draws first), then drops its disc
  useEffect(() => {
    if (mode !== 'cpu' || res || turn !== cpu) return;
    const id = window.setTimeout(() => { setB((cur) => { if (C.result(cur)) return cur; const col = C.aiMove(cur, cpu, level); const n = C.drop(cur, col, cpu); if (!n) return cur; setLast(C.landing(cur, col) * C.COLS + col); setTurn(me); playSfx('move', prefs.sound); return n; }); }, 420);
    return () => window.clearTimeout(id);
  }, [mode, res, turn, cpu, me, level, prefs.sound]);
  useEffect(() => {
    if (!res || counted.current) return;
    counted.current = true;
    if (res === 'win') playSfx(mode === 'cpu' && winner !== me ? 'lose' : 'win', prefs.sound); else playSfx('end', prefs.sound);
    if (mode === 'cpu') { const out = res === 'draw' ? 1 : winner === me ? 0 : 2; setRec((r) => { const n = { ...r, [level]: r[level].map((v, i) => (i === out ? v + 1 : v)) }; write(C4_REC, n); return n; }); }
  }, [res, winner, mode, me, level, prefs.sound]);
  useEffect(() => {
    const k = (e: KeyboardEvent) => { const n = Number(e.key); if (n >= 1 && n <= 7) click(n - 1); };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  });
  const r = rec[level] ?? [0, 0, 0];
  const name = (p: number) => (mode === 'two' ? (p === 1 ? 'Red' : 'Yellow') : p === me ? 'You' : 'The computer');
  const status = res ? (res === 'draw' ? "It's a draw." : mode === 'two' ? `${name(winner)} wins!` : winner === me ? 'You win!' : 'The computer wins.') : mode === 'two' ? `${name(turn)} to play` : turn === me ? 'Your move' : 'Thinking...';
  const colOf = (i: number) => i % C.COLS;

  return (
    <div className="max-w-md mx-auto" data-testid="connect4">
      <div className="mg-h1 mb-3">Connect 4</div>
      <div className="flex flex-wrap gap-3 mb-3 items-center">
        <Seg value={mode} onChange={(m) => { setMode(m); reset(); }} options={[{ id: 'cpu', label: 'Vs computer' }, { id: 'two', label: '2 players' }]} testid="c4-mode" />
        {mode === 'cpu' && <Seg value={level} onChange={(l) => { setLevel(l); reset(); }} options={[{ id: 'easy', label: 'Easy' }, { id: 'normal', label: 'Normal' }, { id: 'hard', label: 'Hard' }]} testid="c4-level" />}
        {mode === 'cpu' && <Seg value={first} onChange={(f) => { setFirst(f); reset(); }} options={[{ id: 'me', label: 'I go first' }, { id: 'cpu', label: 'Computer first' }]} testid="c4-first" />}
      </div>
      <div className="rounded-2xl p-2" style={{ background: '#2a5bd7', boxShadow: '0 4px 0 #1b3f9e' }} data-testid="c4-board" onMouseLeave={() => setHover(null)}>
        <div className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${C.COLS}, 1fr)` }}>
          {b.map((v, i) => {
            const col = colOf(i), row = (i / C.COLS) | 0;
            const canDrop = !res && C.landing(b, col) >= 0 && (mode === 'two' || turn === me);
            const ghost = hover === col && canDrop && C.landing(b, col) === row;
            return (
              <button key={i} aria-label={`Column ${col + 1}, row ${row + 1}${v ? (v === 1 ? ' red' : ' yellow') : ''}`} data-testid={`c4-${i}`} onClick={() => click(col)} onMouseEnter={() => setHover(col)}
                className="aspect-square rounded-full relative overflow-hidden" style={{ background: '#16255c', cursor: canDrop ? 'pointer' : 'default' }}>
                {v !== 0 && (
                  <span key={`${i}-${v}`} className={`absolute inset-[7%] rounded-full ${last === i ? 'mg-drop' : ''}`}
                    style={{ background: v === 1 ? RED : YEL, boxShadow: `inset 0 -3px 0 rgba(0,0,0,.25)${line?.includes(i) ? ', 0 0 0 3px #fff' : ''}`, ['--from' as string]: `${-(row + 1) * 112}%`, ['--dur' as string]: `${300 + row * 45}ms` }} />
                )}
                {ghost && v === 0 && <span className="absolute inset-[7%] rounded-full" style={{ background: turn === 1 ? RED : YEL, opacity: 0.35 }} />}
              </button>
            );
          })}
        </div>
      </div>
      <div className="text-center mt-3 min-h-[1.5rem] font-semibold" data-testid="c4-status">{status}</div>
      {mode === 'cpu' && <div className="mg-card p-3 mt-3 text-sm flex justify-around" data-testid="c4-record"><span>Won <b>{r[0]}</b></span><span>Drawn <b>{r[1]}</b></span><span>Lost <b>{r[2]}</b></span><span className="mg-mute">({level})</span></div>}
      <div className="flex gap-2 justify-center mt-3"><button className="mg-btn mg-btn-primary" onClick={reset} data-testid="c4-again">New game</button><button className="mg-btn mg-btn-ghost" onClick={onBack}>Back to games</button></div>
      <p className="text-xs mg-mute mt-3 text-center">Click a column (or press 1 to 7) to drop a disc. Get four in a row to win.</p>
    </div>
  );
}
