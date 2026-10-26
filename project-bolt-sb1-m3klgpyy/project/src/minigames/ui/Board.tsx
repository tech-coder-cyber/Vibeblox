// The board: pieces, themes, click and drag to move, right-click squares and arrows, and the F / T effects.
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode, type PointerEvent } from 'react';
import { BOARD_THEMES, type BoardTheme, type PieceSet } from '../store';
import { PieceSvg, Disc } from './pieces';
import { playSfx } from './sfx';

export type BoardPiece = { sq: number; v: number };
export type Arrow = { from: number; to: number; color: string };
const MARK_COLORS = { plain: '#e5483f', shift: '#3fae5a', ctrl: '#e8b923', alt: '#3a8fe0' } as const;
const markColor = (e: { shiftKey: boolean; ctrlKey: boolean; altKey: boolean; metaKey: boolean }) => (e.shiftKey ? MARK_COLORS.shift : e.ctrlKey || e.metaKey ? MARK_COLORS.ctrl : e.altKey ? MARK_COLORS.alt : MARK_COLORS.plain);

export type Fx = { id: number; kind: 'slam' | 'throw' } | null;

/** F (chess only) slams a fist on the board; T throws the pieces. Pure show: the game itself is not touched. */
export function useBoardFx(opts: { allowSlam: boolean; sound: boolean; enabled?: boolean }) {
  const [fx, setFx] = useState<Fx>(null);
  const idRef = useRef(0);
  const busy = useRef(false);
  const trigger = useCallback((kind: 'slam' | 'throw') => {
    if (busy.current) return;
    if (kind === 'slam' && !opts.allowSlam) return;
    busy.current = true;
    setFx({ id: ++idRef.current, kind });
    playSfx(kind === 'slam' ? 'slam' : 'throw', opts.sound);
    window.setTimeout(() => { setFx(null); busy.current = false; }, kind === 'slam' ? 2300 : 1700);
  }, [opts.allowSlam, opts.sound]);
  useEffect(() => {
    if (opts.enabled === false) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey || e.repeat) return;
      const el = e.target as HTMLElement | null;
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)) return;
      const k = e.key.toLowerCase();
      if (k === 'f') trigger('slam'); else if (k === 't') trigger('throw');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [trigger, opts.enabled]);
  return { fx, trigger };
}

function rng(seed: number) { let s = seed >>> 0 || 1; return () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; }

export type BoardProps = {
  kind: 'chess' | 'checkers';
  pieces: BoardPiece[];
  orientation: 0 | 1;
  theme: BoardTheme; set: PieceSet; coords: boolean;
  lastMove?: [number, number] | null;
  selected?: number | null;
  targets?: number[];
  /** squares where the move captures something */ captureTargets?: number[];
  checkSq?: number | null;
  hint?: { from: number; to?: number } | null;
  arrows?: Arrow[];
  squareColors?: Record<number, string>;
  interactive?: boolean;
  canDrag?: (sq: number) => boolean;
  onSquare?: (sq: number) => void;
  onMove?: (from: number, to: number) => void;
  /** marks are cleared when this changes (a new position) */ clearKey?: string | number;
  fx?: Fx;
  animate?: boolean;
  showLegalDots?: boolean;
  /** extra content on top of the board (promotion picker, result banner...) */ children?: ReactNode;
  label?: string;
};

export default function Board(p: BoardProps) {
  const th = BOARD_THEMES[p.theme];
  const ref = useRef<HTMLDivElement>(null);
  const [marks, setMarks] = useState<{ circles: Record<number, string>; arrows: Arrow[] }>({ circles: {}, arrows: [] });
  const [rDrag, setRDrag] = useState<{ from: number; to: number; color: string } | null>(null);
  const [drag, setDrag] = useState<{ from: number; x: number; y: number; moved: boolean; sx: number; sy: number } | null>(null);
  const [slide, setSlide] = useState<{ sq: number; dx: number; dy: number; go: boolean } | null>(null);

  useEffect(() => { setMarks({ circles: {}, arrows: [] }); }, [p.clearKey]);
  // after an effect the pieces come back
  const [ret, setRet] = useState(false);
  const hadFx = useRef(false);
  useEffect(() => {
    if (p.fx) { hadFx.current = true; return; }
    if (!hadFx.current) return;
    hadFx.current = false; setRet(true);
    const id = window.setTimeout(() => setRet(false), 700);
    return () => clearTimeout(id);
  }, [p.fx]);

  const colRow = useCallback((sq: number) => {
    const f = sq & 7, r = sq >> 3;
    return p.orientation === 0 ? { col: f, row: 7 - r } : { col: 7 - f, row: r };
  }, [p.orientation]);
  const sqAt = useCallback((clientX: number, clientY: number): number | null => {
    const el = ref.current; if (!el) return null;
    const b = el.getBoundingClientRect();
    const x = (clientX - b.left) / b.width, y = (clientY - b.top) / b.height;
    if (x < 0 || x >= 1 || y < 0 || y >= 1) return null;
    const col = Math.floor(x * 8), row = Math.floor(y * 8);
    return p.orientation === 0 ? (7 - row) * 8 + col : row * 8 + (7 - col);
  }, [p.orientation]);

  // slide the piece that just moved
  const lastKey = p.lastMove ? p.lastMove.join('-') : '';
  const lastRef = useRef('');
  useLayoutEffect(() => {
    if (!p.animate || !p.lastMove || lastKey === lastRef.current) { lastRef.current = lastKey; return; }
    lastRef.current = lastKey;
    const a = colRow(p.lastMove[0]), b = colRow(p.lastMove[1]);
    setSlide({ sq: p.lastMove[1], dx: a.col - b.col, dy: a.row - b.row, go: false });
    const id1 = requestAnimationFrame(() => requestAnimationFrame(() => setSlide((s) => (s ? { ...s, go: true } : s))));
    const id2 = window.setTimeout(() => setSlide(null), 260);
    return () => { cancelAnimationFrame(id1); clearTimeout(id2); };
  }, [lastKey, p.animate, colRow, p.lastMove]);

  const fxStyles = useMemo(() => {
    const m = new Map<number, CSSProperties>();
    if (!p.fx) return m;
    const r = rng(p.fx.id * 7919 + 13);
    for (const pc of p.pieces) {
      const delay = p.fx.kind === 'slam' ? 0.5 + r() * 0.35 : r() * 0.25;
      const dx = (r() - 0.5) * (p.fx.kind === 'slam' ? 160 : 1100), dy = p.fx.kind === 'throw' ? -(200 + r() * 700) * (r() < 0.25 ? -0.5 : 1) : 0;
      m.set(pc.sq, {
        ['--dx' as string]: `${dx}%`, ['--dy' as string]: `${dy}%`, ['--r0' as string]: `${(r() - 0.5) * 30}deg`, ['--r1' as string]: `${(r() - 0.5) * (p.fx.kind === 'slam' ? 200 : 1440)}deg`,
        animation: p.fx.kind === 'slam' ? `mg-fall 1.15s ${delay}s cubic-bezier(.5,0,.9,.6) both` : `mg-throw ${0.9 + r() * 0.35}s ${delay}s cubic-bezier(.15,.6,.3,1) both`,
      });
    }
    return m;
  }, [p.fx, p.pieces]);

  const pieceAt = useMemo(() => { const m = new Map<number, number>(); for (const x of p.pieces) m.set(x.sq, x.v); return m; }, [p.pieces]);
  const sqPct = (sq: number) => { const { col, row } = colRow(sq); return { left: `${col * 12.5}%`, top: `${row * 12.5}%` }; };
  const center = (sq: number) => { const { col, row } = colRow(sq); return { x: col + 0.5, y: row + 0.5 }; };

  const onPointerDown = (e: PointerEvent) => {
    const sq = sqAt(e.clientX, e.clientY);
    if (sq === null) return;
    if (e.button === 2) {
      e.preventDefault();
      setRDrag({ from: sq, to: sq, color: markColor(e) });
      try { (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); } catch { /* ok */ }
      return;
    }
    if (e.button !== 0) return;
    if (marks.arrows.length || Object.keys(marks.circles).length) setMarks({ circles: {}, arrows: [] });
    if (!p.interactive) return;
    p.onSquare?.(sq);
    if (p.canDrag?.(sq) && pieceAt.has(sq)) {
      setDrag({ from: sq, x: e.clientX, y: e.clientY, moved: false, sx: e.clientX, sy: e.clientY });
      try { (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); } catch { /* ok */ }
    }
  };
  const onPointerMove = (e: PointerEvent) => {
    if (rDrag) { const sq = sqAt(e.clientX, e.clientY); if (sq !== null && sq !== rDrag.to) setRDrag({ ...rDrag, to: sq }); }
    if (drag) setDrag({ ...drag, x: e.clientX, y: e.clientY, moved: drag.moved || Math.hypot(e.clientX - drag.sx, e.clientY - drag.sy) > 6 });
  };
  const onPointerUp = (e: PointerEvent) => {
    if (rDrag) {
      const to = sqAt(e.clientX, e.clientY) ?? rDrag.to;
      setMarks((m) => {
        if (to === rDrag.from) {
          const c = { ...m.circles };
          if (c[to] === rDrag.color) delete c[to]; else c[to] = rDrag.color;
          return { ...m, circles: c };
        }
        const i = m.arrows.findIndex((a) => a.from === rDrag.from && a.to === to);
        if (i >= 0) return { ...m, arrows: m.arrows.filter((_, j) => j !== i) };
        return { ...m, arrows: [...m.arrows, { from: rDrag.from, to, color: rDrag.color }] };
      });
      setRDrag(null);
    }
    if (drag) {
      const to = sqAt(e.clientX, e.clientY);
      if (drag.moved && to !== null && to !== drag.from) p.onMove?.(drag.from, to);
      setDrag(null);
    }
  };

  const allArrows = [...(p.arrows ?? []), ...marks.arrows];
  const cell = (i: number) => {
    const row = Math.floor(i / 8), col = i % 8;
    return { row, col, dark: (row + col) % 2 === 1 };
  };

  return (
    <div className="relative w-full select-none touch-none" style={{ aspectRatio: '1 / 1' }}>
      <div ref={ref} data-testid="board" role="grid" aria-label={p.label ?? 'Game board'} data-orientation={p.orientation}
        className={`absolute inset-0 rounded-lg overflow-hidden shadow-xl ${p.fx?.kind === 'slam' ? 'mg-shake' : ''}`}
        style={{ cursor: p.interactive ? 'pointer' : 'default' }}
        onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={() => { setDrag(null); setRDrag(null); }}
        onContextMenu={(e) => e.preventDefault()}>
        {/* squares */}
        {Array.from({ length: 64 }, (_, i) => {
          const { row, col, dark } = cell(i);
          const sq = p.orientation === 0 ? (7 - row) * 8 + col : row * 8 + (7 - col);
          const hl = (p.lastMove && (p.lastMove[0] === sq || p.lastMove[1] === sq)) || p.selected === sq;
          const sc = p.squareColors?.[sq];
          return (
            <div key={i} data-sq={sq} role="gridcell" className="absolute" style={{ left: `${col * 12.5}%`, top: `${row * 12.5}%`, width: '12.5%', height: '12.5%', background: dark ? th.dark : th.light }}>
              {hl && <div className="absolute inset-0" style={{ background: th.accent, opacity: p.selected === sq ? 0.7 : 0.45 }} />}
              {sc && <div className="absolute inset-0" style={{ background: sc, opacity: 0.55 }} />}
              {p.checkSq === sq && <div className="absolute inset-0" style={{ background: 'radial-gradient(circle, rgba(235,60,50,.95) 0%, rgba(235,60,50,.55) 45%, rgba(235,60,50,0) 75%)' }} />}
              {p.hint && (p.hint.from === sq || p.hint.to === sq) && <div className="absolute inset-0" style={{ boxShadow: 'inset 0 0 0 4px #4ec9a0', background: 'rgba(78,201,160,.25)' }} />}
              {marks.circles[sq] && <div className="absolute inset-[3%] rounded-full" style={{ border: `4px solid ${marks.circles[sq]}`, opacity: 0.85 }} data-testid="mark-circle" />}
              {p.coords && col === 0 && <span className="absolute left-0.5 top-0 text-[10px] font-bold leading-none pointer-events-none" style={{ color: dark ? th.light : th.dark }}>{p.orientation === 0 ? 8 - row : row + 1}</span>}
              {p.coords && row === 7 && <span className="absolute right-0.5 bottom-0 text-[10px] font-bold leading-none pointer-events-none" style={{ color: dark ? th.light : th.dark }}>{'abcdefgh'[p.orientation === 0 ? col : 7 - col]}</span>}
            </div>
          );
        })}
        {/* move dots */}
        {p.showLegalDots !== false && p.targets?.map((sq) => {
          const cap = p.captureTargets?.includes(sq);
          return (
            <div key={'t' + sq} className="absolute pointer-events-none flex items-center justify-center" style={{ ...sqPct(sq), width: '12.5%', height: '12.5%' }}>
              {cap ? <div className="w-[88%] h-[88%] rounded-full" style={{ border: '5px solid rgba(20,20,20,.28)' }} /> : <div className="w-[30%] h-[30%] rounded-full" style={{ background: 'rgba(20,20,20,.28)' }} />}
            </div>
          );
        })}
        {/* pieces */}
        {p.pieces.map((pc) => {
          const dragging = drag?.moved && drag.from === pc.sq;
          const sl = slide && slide.sq === pc.sq ? slide : null;
          const fxs = fxStyles.get(pc.sq);
          const white = pc.v > 0, type = Math.abs(pc.v);
          const inner = p.kind === 'chess' ? <PieceSvg set={p.set} type={type} white={white} id={`${pc.sq}`} /> : <Disc set={p.set} red={white} king={type === 2} id={`${pc.sq}`} />;
          return (
            <div key={pc.sq} data-piece={pc.v} data-psq={pc.sq} className={`absolute pointer-events-none ${fxs ? 'mg-fx-piece' : ''}`}
              style={{ ...sqPct(pc.sq), width: '12.5%', height: '12.5%', padding: p.kind === 'chess' ? '3%' : '5%', opacity: dragging ? 0.3 : 1,
                transform: sl ? (sl.go ? 'translate(0,0)' : `translate(${sl.dx * 100}%, ${sl.dy * 100}%)`) : undefined,
                transition: sl && sl.go ? 'transform .16s ease-out' : undefined, animation: ret ? 'mg-return .55s ease-out both' : undefined, ...fxs }}>
              {inner}
            </div>
          );
        })}
        {/* returning pieces after an effect */}
        {/* arrows */}
        <svg className="absolute inset-0 pointer-events-none" viewBox="0 0 8 8" width="100%" height="100%" data-testid="arrows">
          {[...allArrows, ...(rDrag && rDrag.to !== rDrag.from ? [rDrag] : [])].map((a, i) => {
            const f = center(a.from), t = center(a.to);
            const dx = t.x - f.x, dy = t.y - f.y, len = Math.hypot(dx, dy) || 1, ux = dx / len, uy = dy / len;
            const knight = (Math.abs(dx) === 1 && Math.abs(dy) === 2) || (Math.abs(dx) === 2 && Math.abs(dy) === 1);
            const sx = f.x + ux * 0.28, sy = f.y + uy * 0.28, ex = t.x - ux * 0.32, ey = t.y - uy * 0.32;
            const head = 0.34;
            if (knight) {
              const mx = Math.abs(dx) > Math.abs(dy) ? t.x : f.x, my = Math.abs(dx) > Math.abs(dy) ? f.y : t.y;
              const tx = t.x - Math.sign(t.x - mx) * 0.0, ty = t.y - Math.sign(t.y - my) * 0.0;
              const d2x = tx - mx, d2y = ty - my, l2 = Math.hypot(d2x, d2y) || 1;
              const ex2 = tx - (d2x / l2) * 0.3, ey2 = ty - (d2y / l2) * 0.3;
              return (
                <g key={i} opacity="0.82" data-testid="arrow">
                  <polyline points={`${f.x},${f.y} ${mx},${my} ${ex2},${ey2}`} fill="none" stroke={a.color} strokeWidth="0.17" strokeLinejoin="round" strokeLinecap="round" />
                  <polygon points={`${tx},${ty} ${ex2 - (d2y / l2) * head * 0.5},${ey2 + (d2x / l2) * head * 0.5} ${ex2 + (d2y / l2) * head * 0.5},${ey2 - (d2x / l2) * head * 0.5}`} fill={a.color} />
                </g>
              );
            }
            return (
              <g key={i} opacity="0.82" data-testid="arrow">
                <line x1={sx} y1={sy} x2={ex} y2={ey} stroke={a.color} strokeWidth="0.17" strokeLinecap="round" />
                <polygon points={`${t.x - ux * 0.06},${t.y - uy * 0.06} ${ex - uy * head * 0.55},${ey + ux * head * 0.55} ${ex + uy * head * 0.55},${ey - ux * head * 0.55}`} fill={a.color} />
              </g>
            );
          })}
        </svg>
        {p.fx?.kind === 'slam' && <Fist key={p.fx.id} />}
      </div>
      {/* the dragged piece follows the pointer */}
      {drag?.moved && (() => {
        const v = pieceAt.get(drag.from) ?? 0, b = ref.current?.getBoundingClientRect();
        if (!b || !v) return null;
        const size = b.width / 8;
        return (
          <div className="fixed pointer-events-none z-50" style={{ left: drag.x - size / 2, top: drag.y - size / 2, width: size, height: size, padding: p.kind === 'chess' ? '3%' : '5%', filter: 'drop-shadow(0 6px 6px rgba(0,0,0,.35))' }}>
            {p.kind === 'chess' ? <PieceSvg set={p.set} type={Math.abs(v)} white={v > 0} id="drag" /> : <Disc set={p.set} red={v > 0} king={Math.abs(v) === 2} id="drag" />}
          </div>
        );
      })()}
      {p.children}
    </div>
  );
}

function Fist() {
  return (
    <>
      <div className="absolute pointer-events-none" style={{ left: '50%', top: '50%', width: '58%', animation: 'mg-fist 2.1s ease-in both, mg-fistout .4s 1.85s both', zIndex: 5 }} data-testid="fist">
        <svg viewBox="0 0 120 130" width="100%" style={{ filter: 'drop-shadow(0 14px 10px rgba(0,0,0,.45))' }} aria-hidden>
          <rect x="22" y="56" width="78" height="66" rx="20" fill="#f1c9a0" stroke="#7a4a2a" strokeWidth="4" />
          <rect x="22" y="22" width="19" height="52" rx="9.5" fill="#f1c9a0" stroke="#7a4a2a" strokeWidth="4" />
          <rect x="42" y="14" width="19" height="58" rx="9.5" fill="#f1c9a0" stroke="#7a4a2a" strokeWidth="4" />
          <rect x="62" y="16" width="19" height="56" rx="9.5" fill="#f1c9a0" stroke="#7a4a2a" strokeWidth="4" />
          <rect x="82" y="26" width="18" height="46" rx="9" fill="#f1c9a0" stroke="#7a4a2a" strokeWidth="4" />
          <path d="M10 78 C8 62 22 56 32 66 L32 98 C20 102 10 96 10 78 Z" fill="#f1c9a0" stroke="#7a4a2a" strokeWidth="4" strokeLinejoin="round" />
          <path d="M34 52 H98 M34 72 H98" stroke="#7a4a2a" strokeWidth="2" opacity=".35" />
          <rect x="18" y="108" width="86" height="18" rx="6" fill="#3a5f8f" stroke="#243d5c" strokeWidth="3" />
        </svg>
      </div>
      <svg className="absolute inset-0 pointer-events-none" viewBox="0 0 100 100" width="100%" height="100%" style={{ animation: 'mg-crack .5s .75s both', zIndex: 4 }} aria-hidden>
        <g stroke="#111" strokeWidth="0.9" fill="none" opacity="0.8" strokeLinecap="round">
          <path d="M50 50 L40 36 L44 22 L36 8" /><path d="M50 50 L66 40 L74 22 L90 14" /><path d="M50 50 L62 62 L82 66 L96 82" /><path d="M50 50 L36 64 L22 62 L8 76" />
          <path d="M50 50 L52 70 L46 86 L52 98" /><path d="M40 36 L26 34 L12 24" />
        </g>
      </svg>
    </>
  );
}
