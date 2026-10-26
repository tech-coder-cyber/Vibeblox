// An online chess game (or watching one). The server keeps the clock and the order of moves; both games check the rules.
import { useCallback, useEffect, useRef, useState } from 'react';
import { Game, materialBalance, unicodePiece } from '../chess/rules';
import { openingName } from '../chess/openings';
import { analyzeGame, toMoveRecords } from '../chess/analysis';
import { analysisEngine } from '../engineClient';
import { assessGame, MoveClock } from '../fairplay';
import { displayRating } from '../ratings';
import * as api from '../api';
import { filterProfanity } from '../../profanity';
import type { Prefs } from '../store';
import ChessBoardView, { uciSquares } from './ChessBoardView';
import { useBoardFx } from './Board';
import { Confirm, MoveList, PlayerBar, type ChatLine } from './kit';
import { playSfx } from './sfx';
import type { ReviewRequest } from './ChessBotGame';

type MoveTime = { ms: number; blurMs: number; blurs: number };

export default function ChessOnline({ gameId, me, prefs, onReview, onBack }: { gameId: string; me: string; prefs: Prefs; onReview: (r: ReviewRequest) => void; onBack: () => void }) {
  const gameRef = useRef(new Game());
  const game = gameRef.current;
  const [mg, setMg] = useState<api.MgGame | null>(null);
  const mgRef = useRef<api.MgGame | null>(null);
  const [ver, setVer] = useState(0);
  const [view, setView] = useState<number | null>(null);
  const [flip, setFlip] = useState(false);
  const [now, setNow] = useState(Date.now());
  const [error, setError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<null | 'resign' | 'abort'>(null);
  const [chat, setChat] = useState<ChatLine[]>([]);
  const [draft, setDraft] = useState('');
  const times = useRef<MoveTime[]>([]);
  const clock = useRef(new MoveClock());
  const clockPly = useRef(-1);
  const reported = useRef(false);
  const lastClaim = useRef(0);
  const lastSettle = useRef(0);
  const chatAfter = useRef(0);
  const fairChecked = useRef(false);
  const [fair, setFair] = useState<string | null>(null);
  const { fx, trigger } = useBoardFx({ allowSlam: true, sound: prefs.sound });

  const myColor: 0 | 1 | null = mg ? (me === mg.p0 ? 0 : me === mg.p1 ? 1 : null) : null;
  mgRef.current = mg;

  const applyServerMoves = useCallback(async () => {
    const r = await api.getMoves(gameId, game.plies.length);
    if (!r.ok) return;
    let changed = false;
    for (const m of r.value) {
      if (m.ply !== game.plies.length + 1) continue;
      const cap = !!game.pos.board[uciSquares(m.mv).to];
      if (!game.play(m.mv)) { setError('The other player sent a move that is not legal. The game was stopped on your side.'); break; }
      times.current[m.ply - 1] = { ms: m.ms, blurMs: m.blurMs, blurs: m.blurs };
      changed = true;
      playSfx(game.pos.inCheck() ? 'check' : cap ? 'capture' : 'move', prefs.sound);
    }
    if (changed) { setView(null); setVer((v) => v + 1); }
  }, [gameId, game, prefs.sound]);

  const refresh = useCallback(async () => {
    const g = await api.getGame(gameId);
    if (!g.ok) { setError(g.error); return; }
    if (!g.value) { setError('That game no longer exists.'); return; }
    setMg(g.value);
    if (g.value.plies > game.plies.length) await applyServerMoves();
    else if (g.value.status !== 'live' && g.value.plies === game.plies.length && ver === 0 && game.plies.length === 0) setVer((v) => v + 1);
  }, [gameId, game, applyServerMoves, ver]);

  // polling
  useEffect(() => {
    let alive = true;
    void refresh();
    const id = window.setInterval(() => { if (alive && mgRef.current?.status !== 'done' && mgRef.current?.status !== 'disputed') void refresh(); }, 1000);
    return () => { alive = false; clearInterval(id); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameId]);
  useEffect(() => { const id = window.setInterval(() => setNow(Date.now()), 200); return () => clearInterval(id); }, []);
  // chat
  useEffect(() => {
    const id = window.setInterval(async () => {
      const r = await api.getChat(gameId, chatAfter.current);
      if (!r.ok || !r.value.length) return;
      chatAfter.current = r.value[r.value.length - 1].id;
      const g = mgRef.current;
      setChat((c) => [...c, ...r.value.map((m) => ({ id: m.id, who: (m.userId === me ? 'me' : 'them') as 'me' | 'them', name: g ? (m.userId === g.p0 ? g.p0Name : g.p1Name) : '', text: m.body }))].slice(-60));
      if (r.value.some((m) => m.userId !== me)) playSfx('ping', prefs.sound);
    }, 2000);
    return () => clearInterval(id);
  }, [gameId, me, prefs.sound]);

  // my move clock (time and tab leaves, for the fair-play check)
  useEffect(() => {
    const vis = () => clock.current.setHidden(document.hidden || !document.hasFocus());
    document.addEventListener('visibilitychange', vis); window.addEventListener('blur', vis); window.addEventListener('focus', vis);
    return () => { document.removeEventListener('visibilitychange', vis); window.removeEventListener('blur', vis); window.removeEventListener('focus', vis); };
  }, []);
  useEffect(() => {
    if (mg?.status === 'live' && myColor !== null && game.turn === myColor && !game.over && clockPly.current !== game.plies.length) {
      clockPly.current = game.plies.length;
      clock.current.start(Date.now(), document.hidden || !document.hasFocus());
    }
  }, [ver, mg, myColor, game]);

  // things that must happen once in a while
  useEffect(() => {
    if (!mg || myColor === null) return;
    if (mg.status === 'live') {
      const opp = (myColor ^ 1) as 0 | 1;
      if (mg.turn === opp && mg.plies >= 2 && api.clockLeft(mg, opp, Date.now()) <= 0 && Date.now() - lastClaim.current > 3000) { lastClaim.current = Date.now(); void api.claimTimeout(gameId); }
      if (game.over && game.result !== '*' && !reported.current) { reported.current = true; void api.reportResult(gameId, game.result, game.reason); }
      if (reported.current && Date.now() - lastSettle.current > 6000) { lastSettle.current = Date.now(); void api.settle(gameId); }
    }
  }, [now, mg, myColor, game, gameId]);

  // after the game: look at the opponent's moves for signs of an engine
  useEffect(() => {
    if (!mg || mg.status !== 'done' || myColor === null || fairChecked.current || !mg.rated || game.plies.length < 24) return;
    fairChecked.current = true;
    void (async () => {
      try {
        const eng = await analysisEngine('builtin');
        const an = await analyzeGame(game, eng, { depth: 6, timeMs: 250, bookPlies: 8 });
        const opp = (myColor ^ 1) as 0 | 1;
        const oppId = opp === 0 ? mg.p0 : mg.p1;
        const hist = await api.myRating(oppId, 'chess');
        const games = hist.ok && hist.value ? hist.value.games : 0;
        const a = assessGame(toMoveRecords(an, opp, times.current, 8), opp === 0 ? mg.p0Rating : mg.p1Rating, { games, acpl: null, match: null, medianSec: null, reviews: 0 });
        if (a.level !== 'clear') { await api.reportFairplay(gameId, a.level, a.score, a.signals); setFair(a.level); }
      } catch { /* the check is best-effort */ }
    })();
  }, [mg, myColor, game, gameId]);

  const onUserMove = async (uci: string) => {
    if (!mg || myColor === null || mg.status !== 'live' || game.turn !== myColor || game.over) return;
    const cap = !!game.pos.board[uciSquares(uci).to];
    if (!game.play(uci)) return;
    const t = clock.current.stop();
    times.current[game.plies.length - 1] = t;
    setView(null); setVer((v) => v + 1);
    playSfx(game.pos.inCheck() ? 'check' : cap ? 'capture' : 'move', prefs.sound);
    const r = await api.sendMove(gameId, game.plies.length, uci, t.blurMs, t.blurs);
    if (!r.ok) { game.undo(); setVer((v) => v + 1); clockPly.current = -1; setError(r.error); await refresh(); }
    else void refresh();
  };

  const send = async () => {
    const t = draft.trim(); if (!t) return;
    setDraft('');
    const r = await api.say(gameId, filterProfanity(t));
    if (!r.ok) setChat((c) => [...c, { id: Date.now(), who: 'sys', text: r.error }]);
  };

  if (!mg) return <div className="mg-mute p-6" data-testid="online-loading">{error ?? 'Loading the game...'}</div>;

  const live = mg.status === 'live';
  const orientation = (flip ? ((myColor ?? 0) ^ 1) : (myColor ?? 0)) as 0 | 1;
  const topSide = (orientation === 0 ? 1 : 0) as 0 | 1, botSide = (orientation === 0 ? 0 : 1) as 0 | 1;
  const nm = (s: 0 | 1) => (s === 0 ? mg.p0Name : mg.p1Name);
  const rt = (s: 0 | 1) => String(s === 0 ? mg.p0Rating : mg.p1Rating);
  const clk = (s: 0 | 1) => api.clockLeft(mg, s, now);
  const mat = materialBalance(game.pos.board);
  const cap = (s: 0 | 1) => (s === 0 ? mat.black : mat.white).map((t, i) => (t > 0 ? unicodePiece(s === 0 ? -(i + 1) : i + 1).repeat(t) : '')).join('');
  const sans = game.sanList();
  const result = mg.result ? api.resultFor(mg, myColor ?? 0) : null;
  const delta = myColor === null ? null : myColor === 0 ? mg.p0Delta : mg.p1Delta;
  const offerFromOpp = mg.drawOffer !== null && myColor !== null && mg.drawOffer !== myColor;
  const reviewing = view !== null && view < game.plies.length;
  const bar = (s: 0 | 1) => <PlayerBar name={nm(s)} rating={rt(s)} clock={clockText(clk(s))} active={live && mg.turn === s && mg.plies >= 2} low={live && clk(s) < 20000} sub={cap(s)} />;
  const clockText = api.clockText;

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,640px)_1fr]" data-testid="chess-online">
      <div className="min-w-0">
        {bar(topSide)}
        <ChessBoardView game={game} version={ver} orientation={orientation} myColor={myColor} canMove={live && !error} onUserMove={(u) => void onUserMove(u)} viewPly={view} prefs={prefs} fx={fx}>
          {!live && (
            <div className="absolute inset-0 z-30 flex items-center justify-center p-3" style={{ background: 'rgba(10,12,16,.62)' }} data-testid="end-card">
              <div className="mg-card p-5 text-center w-full max-w-xs">
                {mg.status === 'disputed' ? <><div className="mg-h1 mb-1">Result disputed</div><p className="text-sm mg-mute">The two games did not agree how it ended. Nobody's rating changed.</p></> : (
                  <>
                    <div className="mg-h1 mb-1">{myColor === null ? (mg.result === '1/2-1/2' ? 'Draw' : mg.result === '1-0' ? `${mg.p0Name} won` : `${mg.p1Name} won`) : result === 'win' ? 'You won' : result === 'loss' ? 'You lost' : 'Draw'}</div>
                    <div className="text-sm mg-mute mb-2">By {api.REASON_TEXT[mg.reason ?? ''] ?? mg.reason}</div>
                    {delta !== null && myColor !== null && <div className="text-sm" data-testid="rating-delta">Rating {delta >= 0 ? '+' : ''}{delta} <span className="mg-mute">({displayRating({ r: (myColor === 0 ? mg.p0Rating : mg.p1Rating) + delta, n: 5, sumOpp: 0, pts: 0, peak: 0 }).label})</span></div>}
                    {!mg.rated && <div className="text-xs mg-mute">Unrated game</div>}
                  </>
                )}
                <div className="flex flex-col gap-2 mt-3">
                  <button className="mg-btn mg-btn-primary" onClick={() => onReview({ moves: game.uciList(), orientation, title: `${mg.p0Name} vs ${mg.p1Name}` })} data-testid="review-game">Review the game</button>
                  <button className="mg-btn" onClick={onBack} data-testid="online-done">Back to games</button>
                </div>
              </div>
            </div>
          )}
        </ChessBoardView>
        {bar(botSide)}
      </div>
      <div className="space-y-3 min-w-0">
        {error && <div className="mg-card p-3 text-sm" style={{ borderColor: 'var(--mg-bad)' }} data-testid="online-error">{error}</div>}
        {offerFromOpp && live && (
          <div className="mg-card p-3 flex items-center gap-2 text-sm" data-testid="draw-offer"><span className="flex-1">{nm(((myColor ?? 0) ^ 1) as 0 | 1)} offers a draw.</span>
            <button className="mg-btn mg-btn-sm mg-btn-primary" onClick={() => void api.answerDraw(gameId, true)} data-testid="draw-accept">Accept</button>
            <button className="mg-btn mg-btn-sm" onClick={() => void api.answerDraw(gameId, false)} data-testid="draw-decline">Decline</button></div>
        )}
        <div className="mg-card p-3">
          <div className="flex items-center justify-between mb-1"><span className="mg-h2">{openingName(sans) ?? 'Moves'}</span><span className="mg-chip">{mg.baseS / 60 >= 1 ? `${mg.baseS / 60}${mg.incS ? '|' + mg.incS : ' min'}` : `${mg.baseS}s`}{mg.rated ? ' · rated' : ''}</span></div>
          <MoveList moves={sans} view={view ?? sans.length} onView={(p) => setView(p >= sans.length ? null : p)} />
          {reviewing && <button className="mg-btn mg-btn-sm mt-2" onClick={() => setView(null)}>Back to the live position</button>}
        </div>
        <div className="mg-card p-3 grid grid-cols-2 gap-2">
          {myColor !== null && live && (
            <>
              <button className="mg-btn" disabled={mg.drawOffer === myColor || mg.plies < 2} onClick={() => void api.offerDraw(gameId)} data-testid="draw-btn">{mg.drawOffer === myColor ? 'Draw offered' : 'Offer draw'}</button>
              {mg.plies < 2 ? <button className="mg-btn" onClick={() => setConfirm('abort')} data-testid="abort-btn">Cancel game</button> : <button className="mg-btn mg-btn-danger" onClick={() => setConfirm('resign')} data-testid="resign-btn">Resign</button>}
            </>
          )}
          <button className="mg-btn" onClick={() => setFlip((f) => !f)}>Flip board</button>
          <button className="mg-btn" onClick={() => trigger('throw')} title="Press T">Throw pieces (T)</button>
          <button className="mg-btn" style={{ gridColumn: 'span 2' }} onClick={() => trigger('slam')} title="Press F">Crash out (F)</button>
        </div>
        <div className="mg-card p-3">
          <div className="mg-h2 mb-1">Chat</div>
          <div className="mg-scroll overflow-y-auto max-h-32 text-sm space-y-0.5" data-testid="online-chat">
            {!chat.length && <div className="mg-mute text-xs">No messages yet.</div>}
            {chat.map((c) => <div key={c.id} className={c.who === 'sys' ? 'mg-mute text-xs italic' : ''}>{c.who !== 'sys' && <b className="mr-1" style={{ color: c.who === 'me' ? 'var(--mg-accent)' : undefined }}>{c.name}</b>}{c.text}</div>)}
          </div>
          {myColor !== null ? (
            <div className="flex gap-2 mt-2"><input className="mg-input" placeholder="Say something nice" maxLength={200} value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') void send(); }} data-testid="online-chat-input" /><button className="mg-btn" onClick={() => void send()}>Send</button></div>
          ) : <div className="text-xs mg-mute mt-2">You're watching. Only the players can chat.</div>}
        </div>
        {fair && <div className="text-xs mg-mute" data-testid="fair-note">Thanks. This game was sent to the fair-play team to look at.</div>}
        {myColor === null && <button className="mg-btn" onClick={onBack}>Stop watching</button>}
      </div>
      {confirm === 'resign' && <Confirm title="Resign this game?" body="You'll lose the game." yes="Resign" danger onYes={() => { setConfirm(null); void api.resign(gameId); }} onNo={() => setConfirm(null)} />}
      {confirm === 'abort' && <Confirm title="Cancel this game?" body="Nobody's rating changes." yes="Cancel game" onYes={() => { setConfirm(null); void api.abort(gameId); }} onNo={() => setConfirm(null)} />}
    </div>
  );
}
