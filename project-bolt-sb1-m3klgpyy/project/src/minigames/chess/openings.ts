import { namedOpening, inBook as namedInBook } from './openingBook';
// Openings: used by the Learn page (annotated lines you can play through and practice) and by the bots (their opening books).
// Every line is checked by the tests, so a typo in a move cannot slip in.

export type Opening = {
  id: string;
  name: string;
  /** the side you learn it for */ side: 'white' | 'black';
  /** the moves in SAN */ line: string;
  /** one sentence: what it is about */ idea: string;
  /** the plans for each side, short */ plans: string[];
  /** notes shown when the lesson reaches this ply (1 = White's first move) */ notes: Record<number, string>;
  /** easy / medium / sharp */ feel: 'solid' | 'classical' | 'sharp';
};

export const OPENINGS: Opening[] = [
  {
    id: 'italian', name: 'Italian Game', side: 'white', feel: 'classical',
    line: 'e4 e5 Nf3 Nc6 Bc4 Bc5 c3 Nf6 d3 d6 O-O O-O',
    idea: 'Develop quickly and aim the bishop at the weak f7 square.',
    plans: ['Build a strong centre with c3 and d4.', 'Castle early and bring the rooks to the centre.', 'Black develops calmly and challenges the centre with ...d5.'],
    notes: {
      1: 'Take the centre and open lines for the queen and the bishop.', 2: 'Black answers in the centre in the same way.', 3: 'The knight attacks the e5 pawn and gets ready to castle.',
      4: 'Black defends e5 and develops a piece.', 5: 'The bishop looks at f7, the weakest point in Black\'s camp (only the king guards it).', 6: 'Black\'s bishop does the same to f2.',
      7: 'c3 prepares d4 to take the whole centre. This is the Giuoco Piano ("quiet game").', 8: 'Black attacks the e4 pawn.', 9: 'A solid move: it protects e4 and keeps the position closed for now (the "Pianissimo").',
      11: 'Both sides are ready to castle. Next come Nbd2, Re1 and a slow fight for the centre.',
    },
  },
  {
    id: 'ruy', name: 'Ruy Lopez', side: 'white', feel: 'classical',
    line: 'e4 e5 Nf3 Nc6 Bb5 a6 Ba4 Nf6 O-O Be7 Re1 b5 Bb3 d6 c3 O-O',
    idea: 'Pressure the knight that guards e5 and slowly build up a big advantage in the centre.',
    plans: ['Keep the bishop with Ba4 and Bb3.', 'Play c3 and d4 to take the centre.', 'Black counterattacks on the queenside with ...b5 and ...a6.'],
    notes: {
      5: 'The bishop attacks the knight that protects e5. It does not win a pawn yet, but it puts pressure on Black.', 6: 'Black asks the bishop what it wants to do.',
      7: 'Retreating keeps the pin alive. Taking on c6 is also possible, but the bishop is worth keeping.', 8: 'Black attacks e4 and develops.', 9: 'White castles and lets Black take e4. If 5...Nxe4 then 6.d4 gives White a good game.',
      11: 'The rook defends e4 for good.', 12: 'Black drives the bishop back again.', 13: 'The bishop goes to b3 where it aims at f7 along the diagonal.',
      15: 'c3 makes room for d4. This is the main line of the "Closed Ruy Lopez".',
    },
  },
  {
    id: 'scotch', name: 'Scotch Game', side: 'white', feel: 'sharp',
    line: 'e4 e5 Nf3 Nc6 d4 exd4 Nxd4 Nf6 Nxc6 bxc6 e5 Qe7 Qe2 Nd5 c4 Ba6',
    idea: 'Open the centre at once and get active pieces.',
    plans: ['Trade pawns early to open the position.', 'Use the extra space and the lead in development.', 'Black gets the bishop pair-like activity and targets the e5 pawn.'],
    notes: { 5: 'Instead of waiting, White opens the centre right away.', 6: 'Black takes the pawn.', 7: 'White recaptures with the knight, which is now strongly placed in the centre.', 9: 'Trading the knight damages Black\'s pawn structure.', 11: 'e5 attacks the knight and gains space.' },
  },
  {
    id: 'kings-gambit', name: "King's Gambit", side: 'white', feel: 'sharp',
    line: 'e4 e5 f4 exf4 Nf3 g5 h4 g4 Ne5 Nf6 Bc4 d5 exd5 Bd6',
    idea: 'Sacrifice a pawn to open the f-file and attack quickly.',
    plans: ['Open lines toward the black king.', 'Develop fast and castle or use the open f-file.', 'Black tries to keep the extra pawn and survive the attack.'],
    notes: { 3: 'The gambit: White offers a pawn for the f-file and a big centre.', 4: 'Black accepts. Declining with ...Bc5 or ...d5 is also good.', 5: 'White aims to stop ...Qh4+ and to bring the king\'s knight out.', 6: 'Black defends the extra pawn with ...g5.', 7: 'h4 attacks the pawn chain.', 9: 'A strong outpost on e5, the "Kieseritzky Gambit". The knight cannot be easily kicked.' },
  },
  {
    id: 'four-knights', name: 'Four Knights Game', side: 'white', feel: 'solid',
    line: 'e4 e5 Nf3 Nc6 Nc3 Nf6 Bb5 Bb4 O-O O-O d3 d6 Bg5 Bxc3 bxc3 Qe7',
    idea: 'A symmetrical, simple opening where both sides develop their knights first.',
    plans: ['Pin the knight on c6 with Bb5.', 'Castle quickly and play d3.', 'Look for the bishop pair and an attack on the kingside.'],
    notes: { 5: 'Both knights are out. This quiet start leads to a healthy game for both sides.', 7: 'The "Spanish Four Knights": pin the knight that protects e5.', 11: 'd3 keeps the centre solid.', 13: 'Pins the knight on f6 and adds pressure.', 15: 'Black gives up the bishop pair and doubles White\'s pawns.' },
  },
  {
    id: 'qgd', name: "Queen's Gambit Declined", side: 'white', feel: 'classical',
    line: 'd4 d5 c4 e6 Nc3 Nf6 Bg5 Be7 e3 O-O Nf3 Nbd7',
    idea: 'Fight for the centre with the c-pawn. Black keeps the pawn on d5 and builds a solid position.',
    plans: ['Pin the knight on f6 with Bg5.', 'Play Rc1 and Qc2 and look for the minority attack on the queenside.', 'Black frees the position with ...c5 or ...dxc4.'],
    notes: { 1: 'Control the centre from the d-file: d4 supports e4 later and opens the queen\'s bishop.', 3: 'The Queen\'s Gambit. It is not a real gambit because White can win the pawn back.', 4: 'Black declines the pawn and defends d5 with a pawn.', 7: 'Pins the knight so it cannot easily support ...d5 or ...e5.', 10: 'Castling prepares to meet any central break.' },
  },
  {
    id: 'qga', name: "Queen's Gambit Accepted", side: 'white', feel: 'classical',
    line: 'd4 d5 c4 dxc4 Nf3 Nf6 e3 e6 Bxc4 c5 O-O a6',
    idea: 'Black takes the pawn, White develops fast and wins it back with an active position.',
    plans: ['Get the pawn back with Bxc4.', 'Take the centre with e4.', 'Black gets an even game by hitting the centre with ...c5.'],
    notes: { 4: 'Black accepts the gambit pawn.', 5: 'Develop first. The pawn on c4 will not run away.', 9: 'The bishop returns to the long diagonal and the pawn is won back.', 10: 'Black strikes in the centre.' },
  },
  {
    id: 'london', name: 'London System', side: 'white', feel: 'solid',
    line: 'd4 d5 Bf4 Nf6 e3 e6 Nf3 Bd6 Bg3 O-O Nbd2 c5 c3 Nc6',
    idea: 'A simple setup that you can play against almost anything.',
    plans: ['Put the bishop on f4 before closing the pawn chain with e3.', 'Develop Nf3, Nbd2, c3 and Bd3.', 'Aim for e4 or a kingside attack.'],
    notes: { 3: 'The signature move: the bishop comes out before e3 shuts it in.', 5: 'Solid and flexible.', 8: 'Black offers a trade of the bishops.', 9: 'The bishop steps back to g3 and stays on a safe diagonal.' },
  },
  {
    id: 'english', name: 'English Opening', side: 'white', feel: 'classical',
    line: 'c4 e5 Nc3 Nf6 Nf3 Nc6 g3 d5 cxd5 Nxd5 Bg2 Nb6',
    idea: 'Control the d5 square from the side and keep many options open.',
    plans: ['Fianchetto the king\'s bishop with g3 and Bg2.', 'Fight for the centre later with d3 and e4.', 'Use the long diagonal against the queenside.'],
    notes: { 1: 'c4 controls d5. Many players call it "a reversed Sicilian".', 7: 'The bishop fianchetto: it will aim at the long diagonal.', 9: 'White opens the c-file.' },
  },
  {
    id: 'sicilian', name: 'Sicilian Defense (Najdorf)', side: 'black', feel: 'sharp',
    line: 'e4 c5 Nf3 d6 d4 cxd4 Nxd4 Nf6 Nc3 a6 Be3 e5 Nb3 Be6',
    idea: 'Fight for the centre with a flank pawn and play for a win with Black.',
    plans: ['Trade the c-pawn for White\'s d-pawn to get an open c-file.', 'Play ...a6 and ...e5 to control the d5 and b5 squares.', 'Attack on the queenside while White attacks on the kingside.'],
    notes: { 2: 'Black does not copy White. The c-pawn fights for d4 and avoids a symmetrical game.', 4: 'Prepares to trade the pawn on d4.', 8: 'The knight attacks e4.', 10: 'The Najdorf move. It stops Nb5 and Bb5+ and prepares ...b5.', 12: 'Black takes control of d4 and d5, with a solid centre.' },
  },
  {
    id: 'french', name: 'French Defense', side: 'black', feel: 'solid',
    line: 'e4 e6 d4 d5 Nc3 Nf6 Bg5 Be7 e5 Nfd7 Bxe7 Qxe7 f4 O-O',
    idea: 'Build a solid pawn chain and strike back at the base of White\'s centre.',
    plans: ['Hit the centre with ...c5.', 'Free the light-squared bishop (the "bad bishop") by trading or activating it.', 'Keep the structure solid and counter-attack on the queenside.'],
    notes: { 2: 'Solid. Black prepares ...d5 and gets ready to hit the centre.', 4: 'The centre is challenged right away.', 9: 'White gains space. Black will undermine the pawn chain with ...c5.' },
  },
  {
    id: 'caro-kann', name: 'Caro-Kann Defense', side: 'black', feel: 'solid',
    line: 'e4 c6 d4 d5 Nc3 dxe4 Nxe4 Bf5 Ng3 Bg6 h4 h6 Nf3 Nd7',
    idea: 'A very solid defense: Black gets the light-squared bishop out before closing the pawn chain.',
    plans: ['Trade pawns in the centre and bring out the bishop to f5.', 'Keep the pawn structure healthy.', 'Aim for a safe middlegame and an endgame with a better structure.'],
    notes: { 2: 'Black prepares ...d5 with the support of a pawn.', 6: 'The point: the bishop comes out before ...e6 closes it in.', 10: 'The bishop must stay on the diagonal: ...h6 gives it a retreat square on h7.' },
  },
  {
    id: 'kid', name: "King's Indian Defense", side: 'black', feel: 'sharp',
    line: 'd4 Nf6 c4 g6 Nc3 Bg7 e4 d6 Nf3 O-O Be2 e5 O-O Nc6',
    idea: 'Let White build a big centre, then strike at it and attack the king.',
    plans: ['Fianchetto the bishop to g7 and castle.', 'Strike with ...e5 or ...c5.', 'Launch a kingside pawn storm with ...f5 and ...g5.'],
    notes: { 2: 'Black aims the knight at the centre and prepares the fianchetto.', 6: 'The bishop on g7 will look down the long diagonal at White\'s queenside.', 12: 'The key break: Black challenges the centre.' },
  },
  {
    id: 'slav', name: 'Slav Defense', side: 'black', feel: 'solid',
    line: 'd4 d5 c4 c6 Nf3 Nf6 Nc3 dxc4 a4 Bf5 e3 e6 Bxc4 Bb4',
    idea: 'Defend d5 with the c-pawn so the light-squared bishop can come out.',
    plans: ['Develop the bishop to f5 before playing ...e6.', 'Take on c4 and hold the extra pawn if possible.', 'Counter in the centre with ...c5 or ...e5.'],
    notes: { 4: 'The Slav move. It supports d5 and keeps the c8-bishop free.', 8: 'Black takes the pawn.', 10: 'The bishop is out, and Black is solid.' },
  },
  {
    id: 'scandinavian', name: 'Scandinavian Defense', side: 'black', feel: 'solid',
    line: 'e4 d5 exd5 Qxd5 Nc3 Qa5 d4 Nf6 Nf3 c6 Bc4 Bf5',
    idea: 'Challenge the e4 pawn at once and bring the queen out early.',
    plans: ['Retreat the queen to a5 or d6 and develop with tempo.', 'Play ...c6 and ...Bf5 for a solid setup.', 'Castle and aim for an even game.'],
    notes: { 2: 'Black asks White to decide what to do with the pawn at once.', 4: 'The queen will be hit by Nc3, but it has a safe square.' },
  },
  {
    id: 'petrov', name: "Petrov's Defense", side: 'black', feel: 'solid',
    line: 'e4 e5 Nf3 Nf6 Nxe5 d6 Nf3 Nxe4 d4 d5 Bd3 Nc6 O-O Be7',
    idea: 'Copy White and counterattack on e4 instead of defending e5.',
    plans: ['Answer Nxe5 with ...d6, not ...Nxe4?? which loses a piece.', 'Take on e4 and then trade the knights.', 'Reach a solid and symmetrical position.'],
    notes: { 4: 'Black counterattacks instead of defending.', 6: 'Important: first kick the knight with ...d6, then capture e4.' },
  },
  {
    id: 'nimzo', name: 'Nimzo-Indian Defense', side: 'black', feel: 'classical',
    line: 'd4 Nf6 c4 e6 Nc3 Bb4 e3 O-O Bd3 d5 Nf3 c5 O-O Nc6',
    idea: 'Pin the knight on c3 and fight for the e4 square without committing to ...d5 too soon.',
    plans: ['Control e4 with pieces.', 'Double White\'s pawns on the c-file if possible.', 'Play ...d5 and ...c5 to challenge the centre.'],
    notes: { 6: 'The Nimzo pin: it stops e4 and ties White\'s knight.', 14: 'Black has equalised.' },
  },
  {
    id: 'pirc', name: 'Pirc Defense', side: 'black', feel: 'sharp',
    line: 'e4 d6 d4 Nf6 Nc3 g6 Nf3 Bg7 Be2 O-O O-O c6',
    idea: 'Let White build a centre, then challenge it with pieces and pawn breaks.',
    plans: ['Fianchetto the bishop and castle.', 'Play ...c6 and ...b5 or break with ...e5.', 'Keep flexible and strike when White overextends.'],
    notes: { 2: 'A flexible start. Black does not commit the e-pawn or the c-pawn yet.', 8: 'The long diagonal is controlled.' },
  },
  {
    id: 'evans', name: 'Evans Gambit', side: 'white', feel: 'sharp',
    line: 'e4 e5 Nf3 Nc6 Bc4 Bc5 b4 Bxb4 c3 Ba5 d4 exd4 O-O Nge7',
    idea: 'Give a pawn to build a huge centre and attack with tempo.',
    plans: ['Use the extra tempo for c3 and d4.', 'Pins and open lines on the queen\'s side give attacking chances.', 'Black should return the pawn at the right moment.'],
    notes: { 7: 'The gambit: the b-pawn goes to b4. If Black takes it, c3 hits the bishop and builds the centre.', 11: 'The centre is opening and White develops with a big lead.' },
  },
  {
    id: 'dutch', name: 'Dutch Defense', side: 'black', feel: 'sharp',
    line: 'd4 f5 g3 Nf6 Bg2 e6 Nf3 Be7 O-O O-O c4 d6',
    idea: 'Control e4 with the f-pawn and play for a kingside attack.',
    plans: ['Control e4 with ...f5.', 'Build the "Stonewall" with ...d5 or the "Leningrad" with ...g6.', 'Attack on the kingside once the position is ready.'],
    notes: { 2: 'The Dutch. Black takes the e4 square away from White but weakens the king a little.' },
  },
];

export const openingById = (id: string) => OPENINGS.find((o) => o.id === id);

// ---------- the bots' opening book ----------
/** More short lines the bots may play (on top of OPENINGS). */
export const EXTRA_LINES: string[] = [
  'e4 e5 Nf3 Nc6 Bb5 Nf6 O-O Nxe4 d4 Nd6', 'e4 e5 Nf3 Nc6 Bc4 Nf6 Ng5 d5 exd5 Na5', 'e4 e5 Nf3 Nc6 d4 exd4 Bc4 Bc5 c3 Nf6',
  'e4 e5 Nc3 Nf6 f4 d5 fxe5 Nxe4', 'e4 e5 Bc4 Nf6 d3 c6', 'e4 c5 Nf3 e6 d4 cxd4 Nxd4 Nc6 Nc3 Qc7', 'e4 c5 Nf3 Nc6 d4 cxd4 Nxd4 g6 Nc3 Bg7',
  'e4 e6 d4 d5 Nd2 Nf6 e5 Nfd7 Bd3 c5 c3 Nc6', 'e4 c6 d4 d5 e5 Bf5 Nf3 e6 Be2 Nd7', 'd4 d5 c4 e6 Nf3 Nf6 g3 dxc4 Bg2 Bb4+',
  'd4 Nf6 c4 e6 Nf3 b6 g3 Bb7 Bg2 Be7', 'd4 Nf6 Nf3 g6 g3 Bg7 Bg2 O-O O-O d6', 'd4 d5 Nf3 Nf6 Bf4 e6 e3 c5 c3 Nc6', 'Nf3 d5 g3 Nf6 Bg2 e6 O-O Be7 d3 O-O',
  'Nf3 Nf6 c4 g6 Nc3 Bg7 e4 d6 d4 O-O', 'c4 Nf6 Nc3 e6 e4 d5 e5 d4 exf6 dxc3', 'c4 c5 Nc3 Nc6 g3 g6 Bg2 Bg7 Nf3 e6', 'b3 e5 Bb2 Nc6 e3 d5 Bb5 Bd6',
  'f4 d5 Nf3 Nf6 e3 g6 Be2 Bg7 O-O O-O', 'g3 d5 Bg2 e5 d3 Nf6 Nf3 Nc6 O-O Be7',
];
const BOOK_LINES: string[][] = [...OPENINGS.map((o) => o.line.split(' ')), ...EXTRA_LINES.map((l) => l.split(' '))];

/** A book move for the position reached by `sanMoves`, if some line continues from it. `prefer` opening ids are tried first. */
export function bookMove(sanMoves: string[], prefer: string[] = [], rand: () => number = Math.random): string | null {
  const strip = (s: string) => s.replace(/[+#]/g, '');
  const mine = sanMoves.map(strip);
  const fits = (line: string[]) => line.length > mine.length && mine.every((m, i) => strip(line[i]) === m);
  const preferred = prefer.map((id) => openingById(id)).filter((o): o is Opening => !!o).map((o) => o.line.split(' ')).filter(fits);
  const pool = preferred.length ? preferred : BOOK_LINES.filter(fits);
  if (!pool.length) return null;
  const line = pool[Math.floor(rand() * pool.length)];
  return strip(line[mine.length]);
}

/** Name of the opening that matches the start of these moves (the longest match), for showing "Italian Game" under the board. */
export function openingName(sanMoves: string[]): string | null {
  const strip = (s: string) => s.replace(/[+#]/g, '');
  const mine = sanMoves.map(strip);
  let best: { name: string; n: number } | null = null;
  for (const o of OPENINGS) {
    const line = o.line.split(' ');
    let n = 0;
    while (n < line.length && n < mine.length && strip(line[n]) === mine[n]) n++;
    if (n >= Math.min(4, line.length) && (!best || n > best.n)) best = { name: o.name, n };
  }
  return namedOpening(sanMoves) ?? best?.name ?? null;
}
/** Is the game still inside a known opening line (so its last move is a book move)? */
export function inBook(sanMoves: string[]): boolean {
  if (namedInBook(sanMoves)) return true;
  const strip = (s: string) => s.replace(/[+#]/g, '');
  const mine = sanMoves.map(strip);
  return [...OPENINGS.map((o) => o.line.split(' ')), ...EXTRA_LINES.map((l) => l.split(' '))].some((line) => line.length >= mine.length && mine.every((m, i) => strip(line[i]) === m));
}
