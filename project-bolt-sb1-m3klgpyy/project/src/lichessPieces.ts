// The "Lichess" piece set: high-contrast black-and-white pieces (from the unified chess pieces library you pasted, Classic block).
// Built once from shared outlines, so white and black differ only by their fill colour.
// NOTE: that library says it is GPL-3.0 - check the licence before shipping this set in the released game.
type Part = [d: string, filled?: boolean, miter?: boolean];
const SHAPES: Record<string, Part[]> = {
  K: [
    ['M22.5 11.63V6M20 8h5', false, true],
    ['M22.5 25c4.5 0 8.5-3.5 10-8 1.5-4.5-1-6.5-1-6.5s-2.5 2.5-6 1.5c-3.5-1-4-4.5-4-4.5s-.5 3.5-4 4.5c-3.5 1-6-1.5-6-1.5s-2.5 2 1 6.5c1.5 4.5 5.5 8 10 8z', true],
    ['M11.5 30c0-1.5 1.5-3 3-3h16c1.5 0 3 1.5 3 3H11.5z', true],
    ['M11.5 30h22M11.5 33h22M11.5 36h22', true],
  ],
  Q: [
    ['M8 12a2 2 0 1 1-4 0 2 2 0 1 1 4 0zm14.5-9a2 2 0 1 1-4 0 2 2 0 1 1 4 0zm14.5 9a2 2 0 1 1-4 0 2 2 0 1 1 4 0zM9 42h27M11.5 39h22M11.5 36h22', true],
    ['M12.5 31.5L6 14l9 16 7.5-23 7.5 23 9-16-6.5 17.5h-24z', true],
    ['M9 36c0-3 2.5-4.5 5-4.5h17c2.5 0 5 1.5 5 4.5H9z', true],
  ],
  R: [
    ['M9 39h27v3H9zm3-3h21v3H12zm1-27V14h4v-3h5v3h5v-3h5v3h4v-5H13z', true],
    ['M14 14h17v7H14z', true],
    ['M14 21l-2.5 12h20L29 21H14z', true],
    ['M11 36h23l-1.5-3h-20L11 36z', true],
  ],
  B: [
    ['M9 40h27M15 36h15M22.5 31.5m-3.5-3.5', true],
    ['M22.5 34.5c-4-2.5-6.5-7.5-6.5-12.5 0-5.5 3-10.5 6.5-13.5 3.5 3 6.5 8 6.5 13.5 0 5-2.5 10-6.5 12.5z', true],
    ['M17.5 18h10M22.5 10v16', false, true],
  ],
  N: [
    ['M22 10c-5 0-9 4-11 9 1 1 3 1 4-1 2-3 4-4 7-4s6 2 7 5c1 2 0 6-2 8-1 1-3 2-4 3l-1 5h11l1-8c1-4-1-9-6-10z', true],
    ['M9.5 30.5c-1.5 2.5-1 5.5 1.5 7h23c2.5-1.5 3-4.5 1.5-7H9.5z', true],
    ['M11.5 33.5h22M11.5 36.5h22', true],
  ],
  P: [
    ['M22.5 13a4.5 4.5 0 1 1 0-9 4.5 4.5 0 0 1 0 9z', true],
    ['M22.5 31.5c3.5 0 7.5-3.5 7.5-9.5 0-4.5-2.5-6-4.5-7h-6c-2 1-4.5 2.5-4.5 7 0 6 4 9.5 7.5 9.5z', true],
    ['M12.5 35.5h20M15.5 39.5h14M11.5 42.5h22', true],
  ],
};

function build(letter: string, fill: string): string {
  const parts = SHAPES[letter].map(([d, filled, miter]) => `<path d="${d}" fill="${filled === false ? 'none' : fill}"${miter ? ' stroke-linejoin="miter"' : ''}/>`).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 45 45" width="100%" height="100%"><g fill="none" stroke="#000" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">${parts}</g></svg>`;
}

/** key = colour letter + piece letter, e.g. "wK", "bP" */
export const LICHESS_PIECES: Record<string, string> = {};
for (const l of 'KQRBNP') { LICHESS_PIECES['w' + l] = build(l, '#fff'); LICHESS_PIECES['b' + l] = build(l, '#000'); }

/** piece type 1..6 (pawn..king) -> svg markup */
export const lichessPiece = (type: number, white: boolean): string => LICHESS_PIECES[(white ? 'w' : 'b') + 'PNBRQK'[type - 1]] ?? '';
