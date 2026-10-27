// Online side of the minigames: matchmaking, moves, clocks, spectating, chat, leaderboards, fair-play reports.
// Everything goes through the database functions in server/vibeblox_indev37.sql, so the server keeps the order of moves and the clocks.
import { socialRest as rest, type Result } from '../social';

export type GameKind = 'chess' | 'checkers';
export type MgGame = {
  id: string; game: GameKind; p0: string; p1: string; p0Name: string; p1Name: string; p0Rating: number; p1Rating: number;
  baseS: number; incS: number; rated: boolean; status: 'live' | 'done' | 'disputed'; turn: 0 | 1; plies: number;
  p0Ms: number; p1Ms: number; turnAt: string; drawOffer: 0 | 1 | null; result: '1-0' | '0-1' | '1/2-1/2' | null; reason: string | null;
  p0Delta: number | null; p1Delta: number | null; createdAt: string; finishedAt: string | null;
  p0Report: string | null; p1Report: string | null;
};
export type MgMove = { ply: number; mv: string; ms: number; blurMs: number; blurs: number };
export type MgChat = { id: number; userId: string; body: string; at: string };

const SETUP = 'Online games are not set up on this project yet (run the Indev 37 SQL in Supabase). You can still play the bots and solo games.';
function norm<T>(r: { ok: true; data: any } | { ok: false; error: string; status: number }, f: (d: any) => T): Result<{ value: T }> {
  if (r.ok) return { ok: true, value: f(r.data) };
  const missing = r.status === 404 || /does not exist|PGRST20|schema cache|aren't set up/i.test(r.error);
  return { ok: false, error: missing ? SETUP : r.error };
}
const rpc = (fn: string, args: object = {}) => rest('POST', `rpc/${fn}`, args);

export function toGame(r: any): MgGame {
  return {
    id: r.id, game: r.game, p0: r.p0, p1: r.p1, p0Name: r.p0_name, p1Name: r.p1_name, p0Rating: r.p0_rating, p1Rating: r.p1_rating,
    baseS: r.base_s, incS: r.inc_s, rated: !!r.rated, status: r.status, turn: r.turn, plies: r.plies, p0Ms: Number(r.p0_ms), p1Ms: Number(r.p1_ms),
    turnAt: r.turn_at, drawOffer: r.draw_offer ?? null, result: r.result ?? null, reason: r.reason ?? null, p0Delta: r.p0_delta ?? null, p1Delta: r.p1_delta ?? null,
    createdAt: r.created_at, finishedAt: r.finished_at ?? null, p0Report: r.p0_report ?? null, p1Report: r.p1_report ?? null,
  };
}
const toMove = (r: any): MgMove => ({ ply: r.ply, mv: r.mv, ms: r.ms, blurMs: r.blur_ms, blurs: r.blurs });

/** Time left on a player's clock right now (ms), counting the running clock of the player to move. */
export function clockLeft(g: Pick<MgGame, 'p0Ms' | 'p1Ms' | 'turn' | 'turnAt' | 'plies' | 'status'>, side: 0 | 1, now = Date.now(), skewMs = 0): number {
  const base = side === 0 ? g.p0Ms : g.p1Ms;
  if (g.status !== 'live' || g.turn !== side || g.plies < 2) return Math.max(0, base);
  return Math.max(0, base - Math.max(0, now + skewMs - Date.parse(g.turnAt)));
}
export function clockText(ms: number): string {
  const s = Math.ceil(ms / 1000);
  if (ms < 10000) return (Math.max(0, ms) / 1000).toFixed(1);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}
export const TIME_CONTROLS: Array<{ id: string; label: string; base: number; inc: number; kind: string }> = [
  { id: '3+0', label: '3 min', base: 180, inc: 0, kind: 'Blitz' },
  { id: '3+2', label: '3 | 2', base: 180, inc: 2, kind: 'Blitz' },
  { id: '5+0', label: '5 min', base: 300, inc: 0, kind: 'Blitz' },
  { id: '10+0', label: '10 min', base: 600, inc: 0, kind: 'Rapid' },
  { id: '15+10', label: '15 | 10', base: 900, inc: 10, kind: 'Rapid' },
  { id: '30+0', label: '30 min', base: 1800, inc: 0, kind: 'Classical' },
];
export const resultFor = (g: Pick<MgGame, 'result'>, side: 0 | 1): 'win' | 'loss' | 'draw' | null => (!g.result ? null : g.result === '1/2-1/2' ? 'draw' : (g.result === '1-0') === (side === 0) ? 'win' : 'loss');
export const REASON_TEXT: Record<string, string> = { resign: 'resignation', timeout: 'time', agreed: 'agreement', checkmate: 'checkmate', stalemate: 'stalemate', repetition: 'repetition', 'fifty-move': 'the 50-move rule', insufficient: 'insufficient material', aborted: 'game aborted', 'no-moves': 'no moves left', 'forty-move': 'the 40-move rule' };

export async function findMatch(game: GameKind, base: number, inc: number): Promise<Result<{ value: string | null }>> {
  return norm(await rpc('mg_find_match', { p_game: game, p_base: base, p_inc: inc }), (d) => (typeof d === 'string' ? d : null));
}
export const leaveQueue = async () => { await rpc('mg_leave_queue'); };
export async function joinFriend(friendId: string): Promise<Result<{ value: string }>> { return norm(await rpc('mg_join_friend', { p_friend: friendId }), (d) => String(d)); }
export async function myGame(): Promise<string | null> { const r = await rpc('mg_my_game'); return r.ok && typeof r.data === 'string' ? r.data : null; }
export async function getGame(id: string): Promise<Result<{ value: MgGame | null }>> {
  return norm(await rest('GET', `mg_games?id=eq.${encodeURIComponent(id)}&select=*`), (d) => (Array.isArray(d) && d[0] ? toGame(d[0]) : null));
}
export async function getMoves(id: string, afterPly = 0): Promise<Result<{ value: MgMove[] }>> {
  return norm(await rest('GET', `mg_moves?game_id=eq.${encodeURIComponent(id)}&ply=gt.${afterPly}&order=ply.asc&select=ply,mv,ms,blur_ms,blurs&limit=500`), (d) => (Array.isArray(d) ? d.map(toMove) : []));
}
export async function liveGames(game: GameKind | 'all' = 'all', limit = 20): Promise<Result<{ value: MgGame[] }>> {
  const g = game === 'all' ? '' : `&game=eq.${game}`;
  return norm(await rest('GET', `mg_games?status=eq.live&plies=gte.2&turn_at=gte.${encodeURIComponent(new Date(Date.now() - 20 * 60_000).toISOString())}${g}&order=plies.desc&limit=${limit}&select=*`), (d) => (Array.isArray(d) ? d.map(toGame) : []));
}
export async function myHistory(userId: string, limit = 40): Promise<Result<{ value: MgGame[] }>> {
  const id = encodeURIComponent(userId);
  return norm(await rest('GET', `mg_games?or=(p0.eq.${id},p1.eq.${id})&status=neq.live&order=created_at.desc&limit=${limit}&select=*`), (d) => (Array.isArray(d) ? d.map(toGame) : []));
}
export async function sendMove(game: string, ply: number, mv: string, blurMs = 0, blurs = 0): Promise<Result<{ value: { over: boolean } }>> {
  return norm(await rpc('mg_move', { p_game: game, p_ply: ply, p_move: mv, p_blur_ms: Math.round(blurMs), p_blurs: blurs }), (d) => ({ over: !!d?.over }));
}
export const resign = async (game: string) => norm(await rpc('mg_resign', { p_game: game }), () => true);
export const abort = async (game: string) => norm(await rpc('mg_abort', { p_game: game }), () => true);
export const offerDraw = async (game: string) => norm(await rpc('mg_offer_draw', { p_game: game }), () => true);
export const answerDraw = async (game: string, accept: boolean) => norm(await rpc('mg_answer_draw', { p_game: game, p_accept: accept }), () => true);
export const claimTimeout = async (game: string) => norm(await rpc('mg_claim_timeout', { p_game: game }), (d) => d === true);
export const reportResult = async (game: string, result: '1-0' | '0-1' | '1/2-1/2', reason: string) => norm(await rpc('mg_report_result', { p_game: game, p_result: result, p_reason: reason }), () => true);
export const settle = async (game: string) => norm(await rpc('mg_settle', { p_game: game }), (d) => d === true);
export const say = async (game: string, body: string) => norm(await rpc('mg_say', { p_game: game, p_body: body }), () => true);
export async function getChat(game: string, afterId = 0): Promise<Result<{ value: MgChat[] }>> {
  return norm(await rest('GET', `mg_chat?game_id=eq.${encodeURIComponent(game)}&id=gt.${afterId}&order=id.asc&limit=100&select=id,user_id,body,created_at`), (d) => (Array.isArray(d) ? d.map((r: any) => ({ id: r.id, userId: r.user_id, body: r.body, at: r.created_at })) : []));
}

// ---- boards ----
export type RatingRow = { staff?: string | null; special?: string | null; og?: boolean; owner?: boolean; username: string; rank: string; rating: number; games: number; wins: number; losses: number; draws: number };
export async function leaderboard(game: GameKind | 'puzzle', limit = 50): Promise<Result<{ value: RatingRow[] }>> {
  return norm(await rpc('mg_leaderboard', { p_game: game, p_limit: limit }), (d) => (Array.isArray(d) ? d : []));
}
export type ScoreRow = { staff?: string | null; special?: string | null; og?: boolean; owner?: boolean; username: string; rank: string; score: number };
export async function scoreBoard(game: '2048' | 'tictactoe', limit = 50): Promise<Result<{ value: ScoreRow[] }>> {
  return norm(await rpc('mg_score_board', { p_game: game, p_limit: limit }), (d) => (Array.isArray(d) ? d : []));
}
export const submitScore = async (game: '2048' | 'tictactoe', score: number, extra: object = {}) => norm(await rpc('mg_submit_score', { p_game: game, p_score: Math.round(score), p_extra: extra }), () => true);
export type MyRating = { rating: number; games: number; sumOpp: number; pts: number; peak: number; wins: number; losses: number; draws: number; extra: Record<string, any> };
export async function myRating(userId: string, game: GameKind | 'puzzle'): Promise<Result<{ value: MyRating | null }>> {
  return norm(await rest('GET', `mg_ratings?user_id=eq.${encodeURIComponent(userId)}&game=eq.${game}&select=*`), (d) => {
    const r = Array.isArray(d) ? d[0] : null;
    return r ? { rating: r.rating, games: r.games, sumOpp: Number(r.sum_opp), pts: Number(r.pts), peak: r.peak, wins: r.wins, losses: r.losses, draws: r.draws, extra: r.extra ?? {} } : null;
  });
}
export const savePuzzle = async (rating: number, n: number, solved: number[]) => norm(await rpc('mg_save_puzzle', { p_rating: Math.round(rating), p_n: n, p_solved: solved.slice(-300) }), () => true);
export const saveExtra = async (game: GameKind, extra: object) => norm(await rpc('mg_save_extra', { p_game: game, p_extra: extra }), () => true);

// ---- fair play ----
export const reportFairplay = async (game: string, level: 'watch' | 'review', score: number, signals: object[]) => norm(await rpc('mg_report_fairplay', { p_game: game, p_level: level, p_score: score, p_signals: signals }), () => true);
export type FairplayRow = { id: number; gameId: string; game: GameKind; target: string; reporter: string; level: string; score: number; signals: Array<{ id: string; points: number; text: string }>; status: string; note: string | null; at: string; previous: number };
export async function adminFairplay(status: 'open' | 'cleared' | 'confirmed' = 'open'): Promise<Result<{ value: FairplayRow[] }>> {
  return norm(await rpc('mg_list_fairplay', { p_status: status }), (d) => (Array.isArray(d) ? d.map((r: any) => ({ id: r.id, gameId: r.game_id, game: r.game, target: r.target_name, reporter: r.reporter_name, level: r.level, score: r.score, signals: r.signals ?? [], status: r.status, note: r.note, at: r.created_at, previous: Number(r.previous_reviews) })) : []));
}
export const adminResolveFairplay = async (id: number, action: 'clear' | 'confirm', days = 7, note = '') => norm(await rpc('mg_resolve_fairplay', { p_id: id, p_action: action, p_days: days, p_note: note }), () => true);

/** Rank badges of players (rank, staff, special rank, OG). Empty until the Indev 37.1 SQL is run. */
export type PlayerBadge = { userId: string; rank: string; staff: string | null; special: string | null; og: boolean; owner: boolean };
export async function playerBadges(ids: string[]): Promise<Record<string, PlayerBadge>> {
  const out: Record<string, PlayerBadge> = {};
  const list = ids.filter(Boolean);
  if (!list.length) return out;
  try {
    const r = await rpc('mg_player_badges', { p_ids: list });
    if (r.ok && Array.isArray(r.data)) for (const x of r.data) out[x.user_id] = { userId: x.user_id, rank: x.rank ?? 'none', staff: x.staff ?? null, special: x.special ?? null, og: !!x.og, owner: !!x.owner };
  } catch { /* not set up yet */ }
  return out;
}
