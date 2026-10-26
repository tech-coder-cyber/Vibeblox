// Piece drawings. Six looks for chess pieces and matching discs for checkers. Pieces are 1 pawn ... 6 king (negative = black).
import type { PieceSet } from '../store';

const PATHS: Record<number, string> = {
  1: 'M50 14 a13 13 0 1 1 -0.01 0 Z M38 50 H62 Q64 62 70 72 H76 V86 H24 V72 H30 Q36 62 38 50 Z',
  2: 'M28 88 V80 C28 64 34 52 44 44 C38 44 34 46 30 50 L20 48 C20 38 30 26 40 22 L42 10 L49 19 C53 17 57 17 61 19 L64 10 L68 22 C78 32 80 52 76 68 C74 76 74 82 74 88 Z',
  3: 'M50 8 a6 6 0 1 1 -0.01 0 Z M50 22 C68 34 72 48 63 60 L67 70 H59 L61 78 H74 V88 H26 V78 H39 L41 70 H33 L37 60 C28 48 32 34 50 22 Z',
  4: 'M24 88 H76 V77 H70 L67 40 L75 34 V14 H62 V22 H56 V14 H44 V22 H38 V14 H25 V34 L33 40 L30 77 H24 Z',
  5: 'M22 88 L16 36 L25 60 L33 28 L42 56 L50 20 L58 56 L67 28 L75 60 L84 36 L78 88 Z M16 30 a5 5 0 1 1 -0.01 0 Z M33 22 a5 5 0 1 1 -0.01 0 Z M50 14 a5 5 0 1 1 -0.01 0 Z M67 22 a5 5 0 1 1 -0.01 0 Z M84 30 a5 5 0 1 1 -0.01 0 Z',
  6: 'M46 6 H54 V14 H62 V22 H54 V30 H46 V22 H38 V14 H46 Z M50 32 C70 36 74 52 66 62 L72 70 H62 L64 78 H74 V88 H26 V78 H36 L38 70 H28 L34 62 C26 52 30 36 50 32 Z',
};
const BLOCKS: Record<number, number[][]> = {
  1: [[5, 2, 2, 2], [4, 4, 4, 1], [5, 5, 2, 3], [3, 8, 6, 2]],
  2: [[3, 1, 3, 1], [2, 2, 5, 1], [1, 3, 6, 1], [1, 4, 3, 1], [3, 5, 6, 1], [4, 6, 6, 1], [3, 7, 7, 1], [2, 8, 8, 2]],
  3: [[5, 0, 2, 1], [4, 1, 4, 2], [5, 3, 2, 1], [4, 4, 4, 2], [5, 6, 2, 1], [3, 7, 6, 1], [2, 8, 8, 2]],
  4: [[2, 1, 2, 2], [5, 1, 2, 2], [8, 1, 2, 2], [2, 3, 8, 2], [3, 5, 6, 3], [2, 8, 8, 2]],
  5: [[1, 2, 1, 1], [3, 1, 1, 1], [5, 0, 2, 1], [8, 1, 1, 1], [10, 2, 1, 1], [1, 3, 10, 2], [2, 5, 8, 3], [1, 8, 10, 2]],
  6: [[5, 0, 2, 3], [4, 1, 4, 1], [3, 3, 6, 2], [2, 5, 8, 3], [1, 8, 10, 2]],
};
const LETTER = ['', 'P', 'N', 'B', 'R', 'Q', 'K'];

export function PieceSvg({ set, type, white, id }: { set: PieceSet; type: number; white: boolean; id: string }) {
  const d = PATHS[type];
  const common = { viewBox: '0 0 100 100', width: '100%', height: '100%', 'aria-hidden': true as const, style: { display: 'block', pointerEvents: 'none' as const } };
  if (set === 'blocks') {
    const fill = white ? '#f3eee0' : '#3d3b4a', edge = white ? '#8d8572' : '#14131a';
    return (
      <svg {...common} viewBox="0 0 12 12" shapeRendering="crispEdges">
        {BLOCKS[type].map(([x, y, w, h], i) => <rect key={i} x={x} y={y + 1} width={w} height={h} fill={fill} stroke={edge} strokeWidth="0.2" />)}
      </svg>
    );
  }
  if (set === 'letters') {
    return (
      <svg {...common}>
        <circle cx="50" cy="50" r="40" fill={white ? '#f4efe2' : '#34323f'} stroke={white ? '#3a3226' : '#e9e3d4'} strokeWidth="4" />
        <text x="50" y="66" textAnchor="middle" fontSize="46" fontWeight="800" fontFamily="ui-rounded, system-ui, sans-serif" fill={white ? '#2a2318' : '#f4efe2'}>{LETTER[type]}</text>
      </svg>
    );
  }
  if (set === 'outline') {
    const c = white ? '#fffaf0' : '#161616', o = white ? '#161616' : '#fffaf0';
    return (
      <svg {...common}>
        <path d={d} fill="none" stroke={o} strokeWidth="9" strokeLinejoin="round" />
        <path d={d} fill="none" stroke={c} strokeWidth="4.5" strokeLinejoin="round" />
        {type === 2 && <circle cx="52" cy="30" r="3" fill={c} />}
      </svg>
    );
  }
  if (set === 'flat') {
    return (
      <svg {...common}>
        <path d={d} fill={white ? '#ffffff' : '#2b2b33'} />
        {type === 2 && <circle cx="52" cy="30" r="3.2" fill={white ? '#2b2b33' : '#ffffff'} />}
      </svg>
    );
  }
  if (set === 'glass') {
    const g = `g${id}`;
    return (
      <svg {...common}>
        <defs>
          <linearGradient id={g} x1="0" y1="0" x2="0" y2="1">
            {white ? <><stop offset="0" stopColor="#ffffff" stopOpacity="0.97" /><stop offset="1" stopColor="#bcd8f5" stopOpacity="0.85" /></> : <><stop offset="0" stopColor="#6d7c9c" stopOpacity="0.95" /><stop offset="1" stopColor="#1a2234" stopOpacity="0.95" /></>}
          </linearGradient>
        </defs>
        <path d={d} fill={`url(#${g})`} stroke={white ? '#7aa3cf' : '#0c111c'} strokeWidth="2.5" strokeLinejoin="round" />
        <path d={d} fill="none" stroke="#fff" strokeOpacity="0.35" strokeWidth="1.2" transform="translate(-1.5,-1.5)" strokeLinejoin="round" />
        {type === 2 && <circle cx="52" cy="30" r="3" fill={white ? '#38506f' : '#e8f0ff'} />}
      </svg>
    );
  }
  // classic
  const g = `c${id}`;
  return (
    <svg {...common}>
      <defs>
        <linearGradient id={g} x1="0" y1="0" x2="1" y2="1">
          {white ? <><stop offset="0" stopColor="#fffdf6" /><stop offset="1" stopColor="#e3d9bd" /></> : <><stop offset="0" stopColor="#5a5148" /><stop offset="1" stopColor="#262019" /></>}
        </linearGradient>
      </defs>
      <path d={d} fill={`url(#${g})`} stroke={white ? '#3b2f25' : '#0e0b08'} strokeWidth="3" strokeLinejoin="round" />
      {type === 2 && <circle cx="52" cy="30" r="3.2" fill={white ? '#3b2f25' : '#efe6d0'} />}
      {type === 3 && <path d="M45 40 L55 32" stroke={white ? '#3b2f25' : '#efe6d0'} strokeWidth="3" strokeLinecap="round" />}
    </svg>
  );
}

/** A checkers disc. `red` is the first player. */
export function Disc({ set, red, king, id }: { set: PieceSet; red: boolean; king: boolean; id: string }) {
  const base = red ? { a: '#e9604f', b: '#a52a22', ring: '#7d1b16' } : { a: '#fbf6e9', b: '#d6ccb0', ring: '#9d9275' };
  const dark = set === 'flat' || set === 'letters';
  const g = `d${id}`;
  return (
    <svg viewBox="0 0 100 100" width="100%" height="100%" aria-hidden style={{ display: 'block', pointerEvents: 'none' }}>
      <defs>
        <radialGradient id={g} cx="38%" cy="32%" r="75%">
          <stop offset="0" stopColor={base.a} /><stop offset="1" stopColor={base.b} />
        </radialGradient>
      </defs>
      <circle cx="50" cy="54" r="38" fill="#000" opacity="0.28" />
      <circle cx="50" cy="50" r="38" fill={dark ? base.a : `url(#${g})`} stroke={base.ring} strokeWidth="3" />
      {set !== 'flat' && <><circle cx="50" cy="50" r="28" fill="none" stroke={base.ring} strokeWidth="2" opacity="0.55" /><circle cx="50" cy="50" r="19" fill="none" stroke={base.ring} strokeWidth="1.5" opacity="0.4" /></>}
      {king && <path d="M30 62 L26 38 L40 49 L50 32 L60 49 L74 38 L70 62 Z" fill={red ? '#ffe08a' : '#8a6d1f'} stroke={red ? '#7d5b00' : '#4a3908'} strokeWidth="2" strokeLinejoin="round" />}
    </svg>
  );
}
