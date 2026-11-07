// The Classic chess pieces: traditional (Staunton-style) pieces drawn from scratch for VibeBlox, as simple paths on a 45 x 45 grid.
// They are original artwork, so there is nothing to credit and no licence to follow.
const BASE = (extra = ''): string => `<path d="M9.5 40.5c0-1.6 1-2.6 2.4-2.6h21.2c1.4 0 2.4 1 2.4 2.6z"/><path d="M11.5 37.8c.2-1.7.9-2.7 2.3-2.7h17.4c1.4 0 2.1 1 2.3 2.7z"/>${extra}`;
const SHAPES: Record<string, { fill: string; line: string }> = {
  P: { fill: `<circle cx="22.5" cy="10.5" r="5.2"/><path d="M17.2 17.6h10.6c.9 0 1.4.5 1.4 1.3s-.5 1.4-1.4 1.4h-.3c.5 3.6 2.2 6.3 4.1 8.4 1 1.1 1.9 2.7 2 4.5H12c.1-1.8 1-3.4 2-4.5 1.9-2.1 3.6-4.8 4.1-8.4h-.3c-.9 0-1.4-.5-1.4-1.3s.5-1.4 1.4-1.4z"/>${BASE()}`, line: `` },
  R: { fill: `<path d="M13.2 8.5h4.3v3.2h3V8.5h4.1v3.2h3V8.5h4.3V16l-2.6 2.4H15.8L13.2 16z"/><path d="M16.2 18.4h12.6l1.4 3.2v9.9H14.8v-9.9z"/><path d="M14 31.5h17l1.8 4.2H12.2z"/>${BASE()}`, line: `<path d="M16 22h13" /><path d="M15.2 30.5h14.6"/>` },
  B: { fill: `<circle cx="22.5" cy="6.4" r="2.4"/><path d="M22.5 9c4.6 2.8 6.9 7 6.2 11.2-.4 2.3-1.7 3.8-3 4.8h-6.4c-1.3-1-2.6-2.5-3-4.8-.7-4.2 1.6-8.4 6.2-11.2z"/><path d="M15.6 25.6h13.8c.9 0 1.5.6 1.5 1.5s-.6 1.5-1.5 1.5h-.7c.6 2.1 1.3 3.9 3 5.3l1.3 2.2H12l1.3-2.2c1.7-1.4 2.4-3.2 3-5.3h-.7c-.9 0-1.5-.6-1.5-1.5s.6-1.5 1.5-1.5z"/>${BASE()}`, line: `<path d="M19.6 13.2l6 6" stroke-width="1.6"/><path d="M17.4 26.2h10.2"/>` },
  Q: { fill: `<circle cx="10.6" cy="13" r="2.1"/><circle cx="16.8" cy="9.6" r="2.1"/><circle cx="22.5" cy="8.2" r="2.2"/><circle cx="28.2" cy="9.6" r="2.1"/><circle cx="34.4" cy="13" r="2.1"/><path d="M11.4 15.4l4.6 12.2 3.1-14.2 3.4 14.6 3.4-14.6 3.1 14.2 4.6-12.2 1.4 17.6H10z"/><path d="M12.6 33h19.8c1 0 1.5.7 1.5 1.5s-.5 1.5-1.5 1.5H12.6c-1 0-1.5-.7-1.5-1.5S11.6 33 12.6 33z"/>${BASE()}`, line: `<path d="M14.6 30.2h16"/>` },
  K: { fill: `<path d="M22.5 2.4v8.2M18.8 5.8h7.4" fill="none" stroke-width="2.4"/><path d="M22.5 11c6.6 0 10.8 4 10.8 9.4 0 3.3-1.6 5.6-3.4 7.6H15.1c-1.8-2-3.4-4.3-3.4-7.6C11.7 15 15.9 11 22.5 11z"/><path d="M14.2 27.8h16.6c.9 0 1.5.6 1.5 1.5s-.6 1.6-1.5 1.6h-.6c.5 1.7 1.5 3.2 2.9 4.2l.7 1.1H12.5l.7-1.1c1.4-1 2.4-2.5 2.9-4.2h-.6c-.9 0-1.5-.7-1.5-1.6s.6-1.5 1.5-1.5z"/>${BASE()}`, line: `<path d="M14.6 25.4h15.8"/>` },
  N: { fill: `<path d="M12.2 37.8c-.3-6.6 1.9-11.4 5.6-14.9-1.6.4-3.3 1.6-5 3.2-1.4 1.3-3.2 1-3.9-.6-.7-1.5-.2-3.2 1.2-5.2 1.9-2.7 4.4-5 6-7.6.7-1.1.6-2.4.4-4.3 1.6.4 2.7 1.2 3.6 2.4 4.6-.9 10.6 1.5 13.6 7.2 2.6 5 2.2 12.4 2.4 21.7z"/>${BASE().replace(/<path d="M11\.5 37\.8[^>]*>/,'')}`, line: `<path d="M25.2 12.4c3.7 1.6 6 4.8 6.7 9.4M26.2 17.2c1.6 2.6 2.2 5.6 1.8 9M23 21.4c1.4 2 1.7 4.4 1.2 6.8"/><circle cx="21.2" cy="13.4" r="1.2" stroke="none" class="eye"/><path d="M12.6 21.6l2.2-.5"/>` },
};
export function classicSvg(letter: string, white: boolean): string {
  const s = SHAPES[letter];
  const fill = white ? '#f6f3ea' : '#46433d', stroke = white ? '#1f1c17' : '#0c0b09', detail = white ? '#1f1c17' : '#d9d5c8';
  const body = s.fill;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 45 45" width="100%" height="100%"><g fill="${fill}" stroke="${stroke}" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round">${body}</g><g fill="none" stroke="${detail}" stroke-width="1.1" stroke-linecap="round" opacity=".85">${s.line.replace('class="eye"', `fill="${detail}"`)}</g></svg>`;
}

/** piece type 1..6 (pawn, knight, bishop, rook, queen, king) -> svg markup */
export const classicPiece = (type: number, white: boolean): string => classicSvg('PNBRQK'[type - 1], white);
