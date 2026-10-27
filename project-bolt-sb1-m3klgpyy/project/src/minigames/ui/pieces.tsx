// Piece drawings. Chess pieces come in several looks (Classic, Neo, 3D Cartoon, Flat, Outline, Glass, Pixel, Letters, VibeBlox),
// all drawn from one set of shapes we made ourselves, so nothing here is copied from another chess site.
// Pieces are 1 pawn ... 6 king (negative = black). Checkers has matching discs.
import type { CSSProperties, ReactElement } from 'react';
import type { PieceSet } from '../store';

// ---------- shapes (100 x 100 box, the foot of every piece sits at the bottom) ----------
const FOOT = ['M19 92 Q19 85 27 85 H73 Q81 85 81 92 Z', 'M26 85 Q26 79 32 79 H68 Q74 79 74 85 Z'];
const COLLAR = 'M30 55 H70 Q73 55 73 58.5 Q73 62 70 62 H30 Q27 62 27 58.5 Q27 55 30 55 Z';
const BODY: Record<number, string[]> = {
  1: ['M50 13 a12.5 12.5 0 1 1 -0.01 0 Z', 'M33 43.5 Q33 38.5 40 38.5 H60 Q67 38.5 67 43.5 Q67 48.5 60 48.5 H40 Q33 48.5 33 43.5 Z', 'M38 47 C38 59 35 69 28 79.5 H72 C65 69 62 59 62 47 Z', ...FOOT],
  2: ['M28 79.5 C27 68 30 59 38 52 C34 52.5 30 55 27 57.5 C24.5 59.5 21.5 58.5 20.5 56 C18.5 51.5 19.5 46.5 23 43 L31.5 29 L31.5 15 L41 22 C47 17.5 56 17.5 62 22 C74 31 80 50 78 66 C77 72 76 76 76 79.5 Z', ...FOOT],
  3: ['M50 4.5 a5.5 5.5 0 1 1 -0.01 0 Z', 'M50 15 C64 24 70 38 64 50 C62 53 61.5 55 62.5 57.5 H37.5 C38.5 55 38 53 36 50 C30 38 36 24 50 15 Z', 'M31 57.5 H69 Q72 57.5 72 61 Q72 64.5 69 64.5 H31 Q28 64.5 28 61 Q28 57.5 31 57.5 Z', 'M38 64 C38 71 34 75 28 79.5 H72 C66 75 62 71 62 64 Z', ...FOOT],
  4: ['M24 10 H36 V17 H44 V10 H56 V17 H64 V10 H76 V27 Q76 29.5 73.5 29.5 H26.5 Q24 29.5 24 27 Z', 'M29 29 H71 L68 36 H32 Z', 'M32 35 H68 L72 79.5 H28 Z', ...FOOT],
  5: ['M20.5 25 L33 55 H67 L79.5 25 L65 38 L63 19 L55 36 L50 14 L45 36 L37 19 L35 38 Z', 'M50 9.5 a4.6 4.6 0 1 1 -0.01 0 Z', 'M21 20.5 a4.2 4.2 0 1 1 -0.01 0 Z', 'M37 14 a4.2 4.2 0 1 1 -0.01 0 Z', 'M63 14 a4.2 4.2 0 1 1 -0.01 0 Z', 'M79 20.5 a4.2 4.2 0 1 1 -0.01 0 Z', COLLAR, 'M35 62 C35 70 31 75 26 79.5 H74 C69 75 65 70 65 62 Z', ...FOOT],
  6: ['M46 2 H54 V8.5 H60 V15.5 H54 V22 H46 V15.5 H40 V8.5 H46 Z', 'M50 24 C67 26 72 41 64.5 50.5 C62 53.5 61.5 55.5 62.5 58 H37.5 C38.5 55.5 38 53.5 35.5 50.5 C28 41 33 26 50 24 Z', COLLAR, 'M35 62 C35 70 31 75 26 79.5 H74 C69 75 65 70 65 62 Z', ...FOOT],
};
/** thin lines drawn on top of the body (folds, the mitre cut, the mane) */
const LINES: Record<number, string[]> = {
  1: ['M38 47 H62'],
  2: ['M58 27 C68 35 72 50 70 65', 'M51 24 C59 28 64 36 65 47', 'M21.5 57 L28 54.5'],
  3: ['M51 26 L58 37', 'M38 64 H62'],
  4: ['M32 35.5 H68', 'M26 68 H74', 'M44 17 V29', 'M56 17 V29'],
  5: ['M35 62 H65', 'M42 40 L50 50 L58 40'],
  6: ['M35 62 H65', 'M50 29 V44', 'M43 36 H57'],
};
const DOTS: Record<number, Array<[number, number, number]>> = { 2: [[37, 33.5, 2.5], [23.5, 46.5, 1.5]] };

type Look = { a: string; b: string; stroke: string; sw: number; detail: string; shine?: boolean; shadow?: boolean; flat?: boolean };
const LOOKS: Record<string, [Look, Look]> = { // [white, black]
  classic: [
    { a: '#fffdf4', b: '#d8cba6', stroke: '#3a2e22', sw: 2.5, detail: '#6a5a45' },
    { a: '#6f675b', b: '#1c1813', stroke: '#0b0906', sw: 2.5, detail: '#ece3cc' },
  ],
  neo: [
    { a: '#ffffff', b: '#e4e4e4', stroke: '#585858', sw: 1.7, detail: '#9a9a9a' },
    { a: '#55555a', b: '#2a2a2e', stroke: '#101012', sw: 1.7, detail: '#8d8d95' },
  ],
  cartoon: [
    { a: '#fffbea', b: '#efd699', stroke: '#5b3d1e', sw: 4.6, detail: '#a57d46', shine: true, shadow: true },
    { a: '#7e84a8', b: '#2b2f4d', stroke: '#14152c', sw: 4.6, detail: '#c9cdee', shine: true, shadow: true },
  ],
  flat: [
    { a: '#ffffff', b: '#ffffff', stroke: '#6d6d75', sw: 1.4, detail: '#b4b4bc', flat: true },
    { a: '#2e2e36', b: '#2e2e36', stroke: '#101014', sw: 1.4, detail: '#6c6c78', flat: true },
  ],
};

// ---------- pixel / voxel art ----------
const PIXELS: Record<number, string[]> = {
  1: ['....................', '....................', '.........##.........', '........####........', '.......######.......', '........####........', '........####........', '.......######.......', '......########......', '.......######.......', '.......######.......', '.......######.......', '.......######.......', '.......######.......', '......########......', '......########......', '.....##########.....', '....############....', '....############....', '....................'],
  2: ['....................', '.......#.#..........', '......#####.........', '.....#######........', '....########........', '...###o#######......', '..#############.....', '.################...', '.####..###########..', '.###....##########..', '.####....#########..', '.......###########..', '......############..', '.....#############..', '....##############..', '....##############..', '....##############..', '...###############..', '...################.', '....................'],
  3: ['....................', '.........##.........', '.........##.........', '........####........', '.......######.......', '.......####o#.......', '.......###o##.......', '.......##o###.......', '.......######.......', '........####........', '......########......', '.......######.......', '........####........', '.......######.......', '......########......', '.....##########.....', '.....##########.....', '....############....', '....############....', '....................'],
  4: ['....................', '.....##..##..##.....', '.....##..##..##.....', '.....##########.....', '.....##########.....', '.....##########.....', '......########......', '......########......', '......########......', '......########......', '......########......', '......########......', '......########......', '......########......', '......########......', '.....##########.....', '.....##########.....', '....############....', '....############....', '....................'],
  5: ['....................', '..#...#..##..#...#..', '..#...#..##..#...#..', '..##..########..##..', '...##.########.##...', '....############....', '.....##########.....', '......########......', '.......######.......', '.......######.......', '......########......', '.......######.......', '.......######.......', '......########......', '.....##########.....', '.....##########.....', '....############....', '....############....', '....................', '....................'],
  6: ['....................', '.........##.........', '.......######.......', '.........##.........', '.........##.........', '.......######.......', '......########......', '......########......', '.......######.......', '.......######.......', '.......######.......', '......########......', '.......######.......', '.......######.......', '......########......', '.....##########.....', '.....##########.....', '....############....', '....############....', '....................'],
};
const VOXEL = { white: { base: '#efe7d2', light: '#fffdf2', dark: '#c9bd9c', eye: '#3b2f22' }, black: { base: '#4b3d70', light: '#7261a6', dark: '#2a2147', eye: '#ffe9a8' } };

const LETTER = ['', 'P', 'N', 'B', 'R', 'Q', 'K'];
const HIDE: CSSProperties = { display: 'block', pointerEvents: 'none' };

export function PieceSvg({ set, type, white, id }: { set: PieceSet; type: number; white: boolean; id: string }) {
  const bodies = BODY[type];
  if (!bodies) return null;
  const common = { viewBox: '2 3 96 96', width: '100%', height: '100%', 'aria-hidden': true as const, style: HIDE };
  const uid = `p${set}${type}${white ? 'w' : 'b'}${id}`;

  if (set === 'blocks' || set === 'vibeblox') {
    const rows = PIXELS[type], voxel = set === 'vibeblox', G = rows.length;
    const pal = voxel ? (white ? VOXEL.white : VOXEL.black) : white ? { base: '#f3eee0', light: '#f3eee0', dark: '#8d8572', eye: '#14131a', edge: '#4a4538' } : { base: '#3d3b4a', light: '#3d3b4a', dark: '#14131a', eye: '#f3eee0', edge: '#0b0a10' };
    const edge = voxel ? (white ? '#4a3f2c' : '#120c24') : (pal as { edge: string }).edge;
    const on = (x: number, y: number) => x >= 0 && y >= 0 && x < G && y < G && rows[y][x] !== '.';
    const cells: ReactElement[] = [];
    for (let y = 0; y < G; y++) for (let x = 0; x < G; x++) if (on(x, y)) cells.push(<rect key={`o${x}-${y}`} x={x - 0.16} y={y - 0.16} width="1.32" height="1.32" fill={edge} />);
    for (let y = 0; y < G; y++) for (let x = 0; x < G; x++) {
      if (!on(x, y)) continue;
      const ch = rows[y][x];
      cells.push(<rect key={`${x}-${y}`} x={x} y={y} width="1.02" height="1.02" fill={ch === 'o' ? pal.eye : pal.base} />);
      if (voxel && ch !== 'o') {
        if (!on(x, y - 1)) cells.push(<rect key={`u${x}-${y}`} x={x} y={y} width="1" height="0.26" fill={pal.light} />);
        if (!on(x - 1, y)) cells.push(<rect key={`l${x}-${y}`} x={x} y={y} width="0.24" height="1" fill={pal.light} />);
        if (!on(x, y + 1)) cells.push(<rect key={`d${x}-${y}`} x={x} y={y + 0.72} width="1" height="0.28" fill={pal.dark} />);
        if (!on(x + 1, y)) cells.push(<rect key={`r${x}-${y}`} x={x + 0.76} y={y} width="0.24" height="1" fill={pal.dark} />);
        if ((x * 7 + y * 13 + type) % 6 === 0) cells.push(<rect key={`s${x}-${y}`} x={x + 0.3} y={y + 0.35} width="0.34" height="0.34" fill={pal.light} opacity="0.6" />);
      } else if (!voxel) cells.push(<rect key={`g${x}-${y}`} x={x} y={y} width="1.02" height="1.02" fill="none" stroke={pal.dark} strokeWidth="0.08" />);
    }
    return <svg {...common} viewBox="-0.4 -0.4 20.8 20.8" shapeRendering="crispEdges">{voxel && <rect x="2" y="19" width="16" height="0.8" fill="#000" opacity="0.22" />}{cells}</svg>;
  }
  if (set === 'letters') {
    return (
      <svg {...common} viewBox="0 0 100 100">
        <circle cx="50" cy="50" r="42" fill={white ? '#f4efe2' : '#34323f'} stroke={white ? '#3a3226' : '#e9e3d4'} strokeWidth="4" />
        <text x="50" y="67" textAnchor="middle" fontSize="48" fontWeight="800" fontFamily="ui-rounded, system-ui, sans-serif" fill={white ? '#2a2318' : '#f4efe2'}>{LETTER[type]}</text>
      </svg>
    );
  }
  if (set === 'outline') {
    const c = white ? '#fffaf0' : '#161616', o = white ? '#161616' : '#fffaf0';
    return (
      <svg {...common}>
        {bodies.map((d, i) => <path key={i} d={d} fill="none" stroke={o} strokeWidth="8" strokeLinejoin="round" />)}
        {bodies.map((d, i) => <path key={'i' + i} d={d} fill="none" stroke={c} strokeWidth="4" strokeLinejoin="round" />)}
        {(DOTS[type] ?? []).map(([x, y, r], i) => <circle key={i} cx={x} cy={y} r={r} fill={c} />)}
      </svg>
    );
  }
  if (set === 'glass') {
    return (
      <svg {...common}>
        <defs>
          <linearGradient id={uid} x1="0" y1="0" x2="0" y2="1">
            {white ? <><stop offset="0" stopColor="#ffffff" stopOpacity="0.97" /><stop offset="1" stopColor="#bcd8f5" stopOpacity="0.85" /></> : <><stop offset="0" stopColor="#6d7c9c" stopOpacity="0.95" /><stop offset="1" stopColor="#1a2234" stopOpacity="0.95" /></>}
          </linearGradient>
        </defs>
        {bodies.map((d, i) => <path key={i} d={d} fill={`url(#${uid})`} stroke={white ? '#7aa3cf' : '#0c111c'} strokeWidth="2.2" strokeLinejoin="round" />)}
        {bodies.map((d, i) => <path key={'h' + i} d={d} fill="none" stroke="#fff" strokeOpacity="0.38" strokeWidth="1.1" transform="translate(-1.4,-1.4)" strokeLinejoin="round" />)}
        {(LINES[type] ?? []).map((d, i) => <path key={'l' + i} d={d} fill="none" stroke={white ? '#7aa3cf' : '#9db4d8'} strokeWidth="1.5" strokeLinecap="round" opacity="0.8" />)}
        {(DOTS[type] ?? []).map(([x, y, r], i) => <circle key={i} cx={x} cy={y} r={r} fill={white ? '#38506f' : '#e8f0ff'} />)}
      </svg>
    );
  }
  // classic / neo / cartoon / flat: the same shapes with a different finish
  const look = (LOOKS[set] ?? LOOKS.classic)[white ? 0 : 1];
  return (
    <svg {...common}>
      <defs>
        <linearGradient id={uid} gradientUnits="userSpaceOnUse" x1="25" y1="5" x2="80" y2="92"><stop offset="0" stopColor={look.a} /><stop offset="1" stopColor={look.b} /></linearGradient>
        {look.shine && <clipPath id={uid + 'c'}>{bodies.map((d, i) => <path key={i} d={d} />)}</clipPath>}
      </defs>
      {look.shadow && <ellipse cx="50" cy="92.5" rx="33" ry="4.2" fill="#000" opacity="0.2" />}
      {bodies.map((d, i) => <path key={i} d={d} fill={look.flat ? look.a : `url(#${uid})`} stroke={look.stroke} strokeWidth={look.sw} strokeLinejoin="round" />)}
      {look.shine && (
        <g clipPath={`url(#${uid}c)`}>
          <ellipse cx="38" cy="44" rx="7.5" ry="36" fill="#fff" opacity={white ? 0.55 : 0.28} transform="rotate(8 38 44)" />
          <ellipse cx="66" cy="60" rx="6" ry="28" fill="#000" opacity={white ? 0.07 : 0.2} transform="rotate(8 66 60)" />
        </g>
      )}
      {(LINES[type] ?? []).map((d, i) => <path key={'l' + i} d={d} fill="none" stroke={look.detail} strokeWidth={Math.max(1.3, look.sw * 0.55)} strokeLinecap="round" opacity={set === 'neo' || set === 'flat' ? 0.7 : 1} />)}
      {(DOTS[type] ?? []).map(([x, y, r], i) => <circle key={i} cx={x} cy={y} r={r} fill={look.stroke} />)}
    </svg>
  );
}

/** A checkers disc. `red` is the first player. */
export function Disc({ set, red, king, id }: { set: PieceSet; red: boolean; king: boolean; id: string }) {
  const base = red ? { a: '#e9604f', b: '#a52a22', ring: '#7d1b16' } : { a: '#fbf6e9', b: '#d6ccb0', ring: '#9d9275' };
  const dark = set === 'flat' || set === 'letters' || set === 'neo';
  const g = `d${id}`;
  if (set === 'vibeblox' || set === 'blocks') {
    const vox = set === 'vibeblox';
    const c = red ? { base: '#d4503f', light: '#f0806e', dark: '#8f2a20' } : { base: '#efe7d2', light: '#fffdf2', dark: '#b9ad8c' };
    return (
      <svg viewBox="0 0 100 100" width="100%" height="100%" aria-hidden style={HIDE} shapeRendering="crispEdges">
        <rect x="14" y="20" width="72" height="68" fill="#000" opacity="0.22" />
        <rect x="12" y="14" width="76" height="72" fill={c.base} />
        {vox && <><rect x="12" y="14" width="76" height="9" fill={c.light} /><rect x="12" y="14" width="8" height="72" fill={c.light} /><rect x="12" y="77" width="76" height="9" fill={c.dark} /><rect x="80" y="14" width="8" height="72" fill={c.dark} /></>}
        <rect x="30" y="32" width="40" height="36" fill={c.dark} opacity="0.35" />
        {king && <path d="M30 62 V38 H38 V48 H46 V32 H54 V48 H62 V38 H70 V62 Z" fill={red ? '#ffe08a' : '#8a6d1f'} />}
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 100 100" width="100%" height="100%" aria-hidden style={HIDE}>
      <defs>
        <radialGradient id={g} cx="38%" cy="32%" r="75%">
          <stop offset="0" stopColor={base.a} /><stop offset="1" stopColor={base.b} />
        </radialGradient>
      </defs>
      <circle cx="50" cy="55" r="41" fill="#000" opacity="0.28" />
      <circle cx="50" cy="50" r="41" fill={dark ? base.a : `url(#${g})`} stroke={base.ring} strokeWidth="3" />
      {set !== 'flat' && <><circle cx="50" cy="50" r="30" fill="none" stroke={base.ring} strokeWidth="2" opacity="0.55" /><circle cx="50" cy="50" r="20" fill="none" stroke={base.ring} strokeWidth="1.5" opacity="0.4" /></>}
      {set === 'cartoon' && <ellipse cx="38" cy="34" rx="14" ry="8" fill="#fff" opacity="0.35" transform="rotate(-25 38 34)" />}
      {king && <path d="M30 62 L26 38 L40 49 L50 32 L60 49 L74 38 L70 62 Z" fill={red ? '#ffe08a' : '#8a6d1f'} stroke={red ? '#7d5b00' : '#4a3908'} strokeWidth="2" strokeLinejoin="round" />}
    </svg>
  );
}
