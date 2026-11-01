// Coach's tips for a game review: what you did well and what to work on, from how the game was played
// (development, castling, the queen coming out early, pawn structure, mistakes in each part of the game, converting an advantage).
import { Game, Position, P, N, B, R, Q, K, PIECE_VALUES, moveFrom, moveTo } from './rules';
import type { PlyAnalysis } from './analysis';

export type Tip = { kind: 'good' | 'work'; area: string; text: string };

const startSquares = { n: [1, 6, 57, 62], b: [2, 5, 58, 61] }; // b1 g1 b8 g8, c1 f1 c8 f8

function pawnTroubles(pos: Position, color: 0 | 1): { doubled: number; isolated: number } {
  const files = new Array(8).fill(0);
  for (let i = 0; i < 64; i++) if (pos.board[i] === (color === 0 ? P : -P)) files[i & 7]++;
  let doubled = 0, isolated = 0;
  for (let f = 0; f < 8; f++) {
    if (files[f] > 1) doubled += files[f] - 1;
    if (files[f] > 0 && !(files[f - 1] > 0) && !(files[f + 1] > 0)) isolated += files[f];
  }
  return { doubled, isolated };
}
function material(pos: Position, color: 0 | 1): number {
  let m = 0;
  for (let i = 0; i < 64; i++) { const v = pos.board[i]; if (v && (v > 0 ? 0 : 1) === color && Math.abs(v) !== K) m += PIECE_VALUES[Math.abs(v)]; }
  return m;
}

/** Tips for the player on `side` (0 = white, 1 = black). `an` is the move-by-move analysis. */
export function coachTips(game: Game, an: PlyAnalysis[] | null, side: 0 | 1): Tip[] {
  const tips: Tip[] = [];
  const plies = game.plies;
  if (plies.length < 6) return [{ kind: 'work', area: 'Game length', text: 'The game was very short, so there is not much to review. Play a few more moves and the tips get better.' }];
  const mine = plies.map((p, i) => ({ p, i })).filter((x) => x.i % 2 === side);

  // replay to look at the board at certain moments
  const g = new Game(game.startFen);
  const at: Position[] = [g.pos.clone()];
  for (const p of plies) { g.play(p.move); at.push(g.pos.clone()); }

  // 1. developing pieces: after your 10th move, are knights and bishops still at home?
  const tenth = Math.min(plies.length, side === 0 ? 19 : 20); // position after your 10th move
  const pos10 = at[Math.min(tenth, at.length - 1)];
  const home: number[] = [];
  for (const s of [...startSquares.n, ...startSquares.b]) {
    const v = pos10.board[s];
    if (v && (v > 0 ? 0 : 1) === side && (Math.abs(v) === N || Math.abs(v) === B) && ((side === 0 && s < 16) || (side === 1 && s > 47))) home.push(s);
  }
  if (mine.length >= 8) {
    if (home.length >= 2) tips.push({ kind: 'work', area: 'Developing your pieces', text: `${home.length} of your knights and bishops had not moved by move 10. Bring them out early, knights and bishops before queen and rook moves, so every piece joins the fight.` });
    else if (home.length === 0) tips.push({ kind: 'good', area: 'Developing your pieces', text: 'You brought all of your knights and bishops into the game by move 10. That is exactly what strong players do.' });
  }

  // 2. castling and king safety
  const castled = mine.find((x) => /^O-O/.test(game.sanList()[x.i] ?? ''));
  if (castled) { if (castled.i / 2 < 12) tips.push({ kind: 'good', area: 'King safety', text: 'You castled early, which kept your king safe and connected your rooks.' }); }
  else if (mine.length >= 12) tips.push({ kind: 'work', area: 'King safety', text: 'You never castled. Castling in the first 10 or so moves tucks your king away and wakes up your rook.' });

  // 3. the queen out too early, and moving the same piece again and again
  const sans = game.sanList();
  const earlyQueen = mine.slice(0, 6).filter((x) => /^Q/.test(sans[x.i] ?? '')).length;
  if (earlyQueen >= 2) tips.push({ kind: 'work', area: 'Opening', text: 'Your queen moved several times in the first moves. It is easy to chase, so develop your other pieces first and keep the queen back until the middlegame.' });
  const counts: Record<number, number> = {};
  for (const x of mine.slice(0, 8)) { const sq = moveFrom(x.p.move); const pc = Math.abs(at[x.i].board[sq]); if (pc && pc !== P) counts[pc] = (counts[pc] ?? 0) + 1; }
  const repeat = Object.entries(counts).find(([, n]) => n >= 4);
  if (repeat) tips.push({ kind: 'work', area: 'Opening', text: 'You moved the same piece many times in the opening. Each move should do a new job: develop another piece, take the centre, or castle.' });
  const centre = mine.slice(0, 5).filter((x) => { const sq = moveFrom(x.p.move), to = moveTo(x.p.move); return Math.abs(at[x.i].board[sq]) === P && [27, 28, 35, 36].includes(to); }).length;
  if (centre >= 1) tips.push({ kind: 'good', area: 'The centre', text: 'You put a pawn in the centre early. Central pawns give your pieces room and take space from your opponent.' });

  // 4. pawn structure (looked at around move 20, or the end of the game)
  const mid = at[Math.min(at.length - 1, 40)];
  const t = pawnTroubles(mid, side), o = pawnTroubles(mid, (side ^ 1) as 0 | 1);
  if (t.doubled >= 2 || t.isolated >= 2) tips.push({ kind: 'work', area: 'Pawn structure', text: `Your pawns had some weaknesses${t.doubled ? ` (${t.doubled} doubled)` : ''}${t.isolated ? ` (${t.isolated} isolated)` : ''}. Try to recapture towards the centre and keep pawns next to each other so they can protect one another.` });
  else if (t.doubled + t.isolated === 0 && o.doubled + o.isolated >= 1) tips.push({ kind: 'good', area: 'Pawn structure', text: 'Your pawn structure was healthy while your opponent had weak pawns. Good job keeping your pawns together.' });

  // 5. mistakes in each part of the game
  if (an) {
    const phaseOf = (ply: number) => (ply <= 20 ? 0 : material(at[ply - 1], 0) + material(at[ply - 1], 1) > 2400 ? 1 : 2);
    const names = ['the opening', 'the middlegame', 'the endgame'];
    const bad = [0, 0, 0], total = [0, 0, 0];
    for (const a of an) if (a.color === side && a.cls !== 'book') { const ph = phaseOf(a.ply); total[ph]++; if (a.cls === 'mistake' || a.cls === 'blunder') bad[ph]++; }
    let worst = -1, worstShare = 0;
    for (let i = 0; i < 3; i++) if (total[i] >= 3 && bad[i] / total[i] > worstShare && bad[i] >= 2) { worst = i; worstShare = bad[i] / total[i]; }
    if (worst >= 0) tips.push({ kind: 'work', area: worst === 2 ? 'Endgame' : worst === 1 ? 'Middlegame tactics' : 'Opening', text: `Most of your mistakes came in ${names[worst]} (${bad[worst]} of ${total[worst]} moves). ${worst === 0 ? 'Learn the first moves of one opening for white and one for black.' : worst === 1 ? 'Before every move, check what your opponent threatens: which of your pieces are undefended, and what can they capture or check?' : 'Practise basic endgames: use your king as an active piece and push passed pawns.'}` });
    const blunders = an.filter((a) => a.color === side && a.cls === 'blunder').length;
    if (blunders === 0 && an.filter((a) => a.color === side).length >= 10) tips.push({ kind: 'good', area: 'Accuracy', text: 'You made no blunders. Keep checking what your opponent threatens before each move.' });
    else if (blunders >= 2) tips.push({ kind: 'work', area: 'Blunder check', text: `You made ${blunders} blunders. Before you move, ask: "If I play this, what is the most dangerous reply?" and check every capture and check.` });
  }

  // 6. converting an advantage / endgame
  const end = at[at.length - 1];
  const me = material(end, side), them = material(end, (side ^ 1) as 0 | 1);
  const result = game.result;
  const won = (result === '1-0' && side === 0) || (result === '0-1' && side === 1);
  const lost = (result === '1-0' && side === 1) || (result === '0-1' && side === 0);
  if (!won && me - them >= 300 && game.over) tips.push({ kind: 'work', area: 'Converting a lead', text: 'You were ahead in material at the end but did not win. When you are ahead, trade pieces (not pawns), keep your king safe and push your pawns to promote.' });
  if (won && me - them >= 300) tips.push({ kind: 'good', area: 'Converting a lead', text: 'You turned a material lead into a win. That is an important skill.' });
  if (lost && an) {
    const first = an.find((a) => a.color === side && a.cls === 'blunder');
    if (first) tips.push({ kind: 'work', area: 'Turning point', text: `The game turned at move ${Math.ceil(first.ply / 2)} (${first.san}). Look at that moment again and find what you missed.` });
  }
  if (!tips.some((x) => x.kind === 'good')) tips.push({ kind: 'good', area: 'Keep going', text: 'Every game is practice. Come back to this review and look at your biggest mistakes: that is the fastest way to improve.' });
  void R; void Q;
  return tips.slice(0, 7);
}
