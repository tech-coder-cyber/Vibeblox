// The Games area: chess, checkers, 2048, tic tac toe, puzzles, lessons, analysis, leaderboards, history and settings.
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { Game } from '../chess/rules';
import { loadPrefs, savePrefs, loadProgress, type HistoryEntry, type Prefs } from '../store';
import * as api from '../api';
import { setServerPresence } from '../../social';
import ChessBotGame, { type ReviewRequest } from './ChessBotGame';
import ChessOnline from './ChessOnline';
import CheckersBotGame, { type CheckersReview } from './CheckersBotGame';
import CheckersOnline from './CheckersOnline';
import { Game2048, TicTacToe } from './ArcadeGames';
import PuzzlesView from './PuzzlesView';
import LearnView from './LearnView';
import AnalysisView from './AnalysisView';
import { CheckersReplay, HistoryView, Leaderboards, RatingCard, Settings } from './Panels';
import './mg.css';

export type GameIntent = { kind: 'join'; friendId: string; friendName: string } | { kind: 'spectate'; game: api.GameKind; gameId: string } | null;
export type MgAccount = { userId: string; username: string } | null;

type Screen =
  | { k: 'home' } | { k: 'chessBot'; bot?: string } | { k: 'ckBot' } | { k: 'lobby'; game: api.GameKind }
  | { k: 'online'; game: api.GameKind; id: string } | { k: 'puzzles' } | { k: 'learn' } | { k: 'g2048' } | { k: 'ttt' }
  | { k: 'analysis'; req: ReviewRequest } | { k: 'loadAnalysis' } | { k: 'ckReplay'; req: CheckersReview } | { k: 'boards' } | { k: 'history' } | { k: 'settings' };

export default function MinigamesView({ account, rank, intent, onIntentDone }: { account: MgAccount; rank: string; intent?: GameIntent; onIntentDone?: () => void }) {
  const [screen, setScreen] = useState<Screen>({ k: 'home' });
  const [prefs, setPrefsState] = useState<Prefs>(loadPrefs);
  const [presence, setPresence] = useState<string | null>(null);
  const [notice, setNotice] = useState('');
  const setPrefs = useCallback((p: Prefs) => { setPrefsState(p); savePrefs(p); }, []);
  const signedIn = !!account;
  const go = (s: Screen) => setScreen(s);
  const home = () => go({ k: 'home' });

  // a friend's "Join" or "Spectate" from Social
  useEffect(() => {
    if (!intent || !account) return;
    let alive = true;
    void (async () => {
      if (intent.kind === 'spectate') { go({ k: 'online', game: intent.game, id: intent.gameId }); }
      else {
        const r = await api.joinFriend(intent.friendId);
        if (!alive) return;
        if (r.ok) { const g = await api.getGame(r.value); if (g.ok && g.value) go({ k: 'online', game: g.value.game, id: r.value }); }
        else setNotice(r.error);
      }
      onIntentDone?.();
    })();
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [intent, account?.userId]);

  // let friends see what you are doing (searching / in a game) and clear it when you leave
  useEffect(() => {
    if (!account) return;
    if (!presence) return;
    void setServerPresence(presence);
    const t = window.setInterval(() => { void setServerPresence(presence); }, 30_000);
    return () => { window.clearInterval(t); void setServerPresence(null); };
  }, [presence, account?.userId]);

  const review = (r: ReviewRequest) => go({ k: 'analysis', req: r });
  const ckReview = (r: CheckersReview) => go({ k: 'ckReplay', req: r });
  const fromHistory = (h: HistoryEntry) => review({ moves: h.moves, startFen: h.startFen, orientation: h.color, title: `${h.color === 0 ? 'You' : h.opp} vs ${h.color === 0 ? h.opp : 'You'}` });

  let body: ReactNode;
  switch (screen.k) {
    case 'home': body = <Home onGo={go} account={account} signedIn={signedIn} notice={notice} />; break;
    case 'chessBot': body = <ChessBotGame rank={rank} prefs={prefs} onPrefs={setPrefs} onReview={review} initialBot={screen.bot} onBack={home} />; break;
    case 'ckBot': body = <CheckersBotGame rank={rank} prefs={prefs} onPrefs={setPrefs} onReview={ckReview} onBack={home} />; break;
    case 'lobby': body = account ? <Lobby game={screen.game} account={account} onPresence={setPresence} onStart={(id) => go({ k: 'online', game: screen.game, id })} onBack={home} /> : <NeedAccount onBack={home} />; break;
    case 'online': body = screen.game === 'chess'
      ? <ChessOnline key={screen.id} gameId={screen.id} me={account?.userId ?? ''} prefs={prefs} onReview={review} onBack={home} />
      : <CheckersOnline key={screen.id} gameId={screen.id} me={account?.userId ?? ''} prefs={prefs} onReview={ckReview} onBack={home} />; break;
    case 'puzzles': body = <PuzzlesView prefs={prefs} signedIn={signedIn} onBack={home} />; break;
    case 'learn': body = <LearnView prefs={prefs} onBack={home} />; break;
    case 'g2048': body = <Game2048 prefs={prefs} signedIn={signedIn} onBack={home} />; break;
    case 'ttt': body = <TicTacToe prefs={prefs} signedIn={signedIn} onBack={home} />; break;
    case 'analysis': body = <AnalysisView req={screen.req} prefs={prefs} onPrefs={setPrefs} onBack={home} />; break;
    case 'loadAnalysis': body = <LoadAnalysis onLoad={review} onBack={home} />; break;
    case 'ckReplay': body = <CheckersReplay moves={screen.req.moves} orientation={screen.req.orientation} title={screen.req.title} prefs={prefs} onBack={home} />; break;
    case 'boards': body = <Leaderboards signedIn={signedIn} onBack={home} />; break;
    case 'history': body = <HistoryView onAnalyse={fromHistory} onReplay={(h) => ckReview({ kind: 'checkers', moves: h.moves, orientation: h.color, title: `Checkers vs ${h.opp}` })} onBack={home} />; break;
    case 'settings': body = <Settings prefs={prefs} onPrefs={setPrefs} onBack={home} />; break;
  }
  // online games must not remember a stale "searching" status
  useEffect(() => { if (screen.k === 'online' && account) { setPresence(`mg:${screen.game}:${screen.id}`); } else if (screen.k !== 'lobby') setPresence(null); }, [screen, account]);

  return (
    <div className="mg min-h-full p-4 sm:p-6 max-w-6xl mx-auto" data-testid="minigames">
      {screen.k === 'home' ? (
        <div className="grid gap-5 lg:grid-cols-[1fr_300px]">
          <div className="min-w-0">{body}</div>
          <div className="space-y-4 min-w-0"><RatingCard signedIn={signedIn} /><LiveGames onSpectate={(g) => go({ k: 'online', game: g.game, id: g.id })} signedIn={signedIn} /></div>
        </div>
      ) : body}
    </div>
  );
}

function Home({ onGo, account, signedIn, notice }: { onGo: (s: Screen) => void; account: MgAccount; signedIn: boolean; notice: string }) {
  const Card = ({ title, blurb, tag, children, testid }: { title: string; blurb: string; tag: string; children: ReactNode; testid: string }) => (
    <div className="mg-card p-4 flex flex-col gap-3" data-testid={testid}>
      <div><div className="flex items-center justify-between"><h3 className="mg-h2">{title}</h3><span className="mg-chip">{tag}</span></div><p className="text-sm mg-mute mt-1">{blurb}</p></div>
      <div className="flex flex-wrap gap-2 mt-auto">{children}</div>
    </div>
  );
  const online = signedIn ? undefined : 'Sign in from the Social tab to play online';
  return (
    <div data-testid="games-home">
      <h1 className="mg-h1 mb-1">Games</h1>
      <p className="text-sm mg-mute mb-4">Board games and puzzles to play while you take a break from building{account ? `, ${account.username}` : ''}. Most of them work with no internet.</p>
      {notice && <div className="mg-card p-3 text-sm mb-3" style={{ borderColor: 'var(--mg-bad)' }} data-testid="games-notice">{notice}</div>}
      <div className="grid gap-4 sm:grid-cols-2">
        <Card testid="card-chess" title="Chess" tag="Online and offline" blurb="Play real people, or one of 32 bots that each have their own style and personality.">
          <button className="mg-btn mg-btn-primary" disabled={!signedIn} title={online} onClick={() => onGo({ k: 'lobby', game: 'chess' })} data-testid="chess-online">Play online</button>
          <button className="mg-btn" onClick={() => onGo({ k: 'chessBot' })} data-testid="chess-bots">Play a bot</button>
        </Card>
        <Card testid="card-checkers" title="Checkers" tag="Online and offline" blurb="American checkers with jumps you must take. 24 bots to play, from careful to wild.">
          <button className="mg-btn mg-btn-primary" disabled={!signedIn} title={online} onClick={() => onGo({ k: 'lobby', game: 'checkers' })} data-testid="ck-online-btn">Play online</button>
          <button className="mg-btn" onClick={() => onGo({ k: 'ckBot' })} data-testid="ck-bots">Play a bot</button>
        </Card>
        <Card testid="card-puzzles" title="Puzzles" tag="Offline" blurb="100 chess puzzles from easy to hard, with your own puzzle rating."><button className="mg-btn mg-btn-primary" onClick={() => onGo({ k: 'puzzles' })} data-testid="open-puzzles">Solve puzzles</button></Card>
        <Card testid="card-learn" title="Learn chess" tag="Offline" blurb="How the pieces move, the rules, simple tactics, and openings like the Queen's Gambit and Ruy Lopez."><button className="mg-btn mg-btn-primary" onClick={() => onGo({ k: 'learn' })} data-testid="open-learn">Start learning</button></Card>
        <Card testid="card-2048" title="2048" tag="Offline" blurb="Slide the tiles and join matching numbers."><button className="mg-btn mg-btn-primary" onClick={() => onGo({ k: 'g2048' })} data-testid="open-2048">Play 2048</button></Card>
        <Card testid="card-ttt" title="Tic Tac Toe" tag="Offline" blurb="Play the computer on easy, normal or hard. Hard never loses."><button className="mg-btn mg-btn-primary" onClick={() => onGo({ k: 'ttt' })} data-testid="open-ttt">Play</button></Card>
        <Card testid="card-analysis" title="Analysis" tag="Offline" blurb="Check a game move by move, with an evaluation bar and a grade for each move."><button className="mg-btn" onClick={() => onGo({ k: 'loadAnalysis' })} data-testid="open-analysis">Analyse a game</button><button className="mg-btn" onClick={() => onGo({ k: 'history' })} data-testid="open-history">Game history</button></Card>
        <Card testid="card-more" title="Boards and style" tag="Everyone" blurb="See who's on top, and pick your board colours and piece style."><button className="mg-btn" onClick={() => onGo({ k: 'boards' })} data-testid="open-boards">Leaderboards</button><button className="mg-btn" onClick={() => onGo({ k: 'settings' })} data-testid="open-settings">Board and pieces</button></Card>
      </div>
    </div>
  );
}

function NeedAccount({ onBack }: { onBack: () => void }) {
  return <div className="mg-card p-6 max-w-md mx-auto text-center"><h2 className="mg-h2 mb-1">Sign in to play online</h2><p className="text-sm mg-mute mb-3">Open the Social tab and sign in. You can still play the bots and solo games without an account.</p><button className="mg-btn" onClick={onBack}>Back to games</button></div>;
}

function Lobby({ game, account, onPresence, onStart, onBack }: { game: api.GameKind; account: NonNullable<MgAccount>; onPresence: (s: string | null) => void; onStart: (id: string) => void; onBack: () => void }) {
  const [tc, setTc] = useState('10+0');
  const [state, setState] = useState<'idle' | 'searching'>('idle');
  const [secs, setSecs] = useState(0);
  const [err, setErr] = useState('');
  const alive = useRef(true);
  const prog = loadProgress();
  const rating = game === 'chess' ? prog.chessRating : prog.checkersRating;
  useEffect(() => { alive.current = true; return () => { alive.current = false; onPresence(null); void api.leaveQueue(); }; }, [onPresence]);

  const search = async () => {
    const c = api.TIME_CONTROLS.find((x) => x.id === tc)!;
    setErr(''); setState('searching'); setSecs(0); onPresence(`mgq:${game}`);
    const r = await api.findMatch(game, c.base, c.inc);
    if (!alive.current) return;
    if (!r.ok) { setErr(r.error); setState('idle'); onPresence(null); return; }
    if (r.value) { onPresence(null); onStart(r.value); return; }
    const t0 = Date.now();
    const poll = async () => {
      while (alive.current) {
        await new Promise((res) => setTimeout(res, 1500));
        if (!alive.current || stateRef.current !== 'searching') return;
        setSecs(Math.floor((Date.now() - t0) / 1000));
        const id = await api.myGame();
        if (id) { onPresence(null); onStart(id); return; }
        if (Date.now() - t0 > 10 * 60_000) { await api.leaveQueue(); setState('idle'); onPresence(null); setErr('Nobody was found. Try again, or play a bot.'); return; }
      }
    };
    void poll();
  };
  const stateRef = useRef(state); stateRef.current = state;
  const cancel = async () => { setState('idle'); onPresence(null); await api.leaveQueue(); };
  return (
    <div className="max-w-lg mx-auto" data-testid="lobby">
      <h2 className="mg-h1 mb-1">{game === 'chess' ? 'Chess' : 'Checkers'} online</h2>
      <p className="text-sm mg-mute mb-4">Playing as {account.username}. Your first 5 rated games set your rating.</p>
      <div className="mg-card p-4 space-y-4">
        <div><div className="text-xs mg-mute mb-1">Time</div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">{api.TIME_CONTROLS.map((c) => (
            <button key={c.id} className="mg-btn" style={{ flexDirection: 'column', gap: 0, borderColor: tc === c.id ? 'var(--mg-accent)' : undefined }} aria-pressed={tc === c.id} disabled={state === 'searching'} onClick={() => setTc(c.id)} data-testid={`tc-${c.id}`}>
              <b>{c.label}</b><span className="text-[10px] mg-mute">{c.kind}</span></button>))}</div></div>
        <div className="text-sm mg-mute" data-testid="lobby-rating">Your rating: <b className="text-[var(--mg-text)]">{rating.n === 0 ? 'not rated yet' : rating.n < 5 ? `${rating.r}? (${5 - rating.n} more to settle)` : rating.r}</b></div>
        {state === 'idle' ? (
          <button className="mg-btn mg-btn-primary w-full" onClick={() => void search()} data-testid="find-game">Find a game</button>
        ) : (
          <div className="text-center space-y-2" data-testid="searching"><div className="animate-pulse">Looking for an opponent... {secs}s</div><button className="mg-btn w-full" onClick={() => void cancel()} data-testid="cancel-search">Stop looking</button></div>
        )}
        {err && <div className="text-sm" style={{ color: 'var(--mg-bad)' }} data-testid="lobby-error">{err}</div>}
        <p className="text-xs mg-mute">Friends can see that you're looking and press Join in Social to play you.</p>
      </div>
      <button className="mg-btn mg-btn-ghost mt-3" onClick={onBack}>Back to games</button>
    </div>
  );
}

function LiveGames({ onSpectate, signedIn }: { onSpectate: (g: api.MgGame) => void; signedIn: boolean }) {
  const [games, setGames] = useState<api.MgGame[] | null>(null);
  const [err, setErr] = useState('');
  useEffect(() => {
    if (!signedIn) return;
    let live = true;
    const load = async () => { const r = await api.liveGames('all', 8); if (!live) return; if (r.ok) { setGames(r.value); setErr(''); } else setErr(r.error); };
    void load(); const t = window.setInterval(load, 8000);
    return () => { live = false; window.clearInterval(t); };
  }, [signedIn]);
  return (
    <div className="mg-card p-4" data-testid="live-games">
      <div className="mg-h2 mb-2">Games happening now</div>
      {!signedIn && <p className="text-xs mg-mute">Sign in to watch live games.</p>}
      {signedIn && err && <p className="text-xs mg-mute">{err}</p>}
      {signedIn && !err && games && !games.length && <p className="text-xs mg-mute">No games right now. Be the first!</p>}
      <div className="space-y-2">
        {(games ?? []).map((g) => (
          <div key={g.id} className="mg-card-flat p-2 flex items-center gap-2" data-testid="live-row">
            <div className="min-w-0 flex-1 text-xs"><div className="font-semibold truncate">{g.p0Name} <span className="mg-mute">({g.p0Rating})</span></div><div className="font-semibold truncate">{g.p1Name} <span className="mg-mute">({g.p1Rating})</span></div><div className="mg-mute">{g.game === 'chess' ? 'Chess' : 'Checkers'} · {g.baseS >= 60 ? g.baseS / 60 + ' min' : g.baseS + 's'}</div></div>
            <button className="mg-btn mg-btn-sm" onClick={() => onSpectate(g)} data-testid="spectate-btn">Spectate</button>
          </div>
        ))}
      </div>
    </div>
  );
}

function LoadAnalysis({ onLoad, onBack }: { onLoad: (r: ReviewRequest) => void; onBack: () => void }) {
  const [text, setText] = useState('');
  const [err, setErr] = useState('');
  const recent = loadProgress().history.filter((h) => h.game === 'chess').slice(0, 6);
  const go = () => {
    const g = Game.fromPgn(text);
    if (!g || !g.plies.length) { setErr('That does not look like a list of chess moves. Try something like: 1. e4 e5 2. Nf3 Nc6'); return; }
    onLoad({ moves: g.uciList(), startFen: g.startFen, orientation: 0, title: 'Pasted game' });
  };
  return (
    <div className="max-w-xl mx-auto space-y-3" data-testid="load-analysis">
      <h2 className="mg-h1">Analyse a game</h2>
      <div className="mg-card p-4 space-y-2">
        <div className="text-sm">Paste moves or a PGN:</div>
        <textarea className="mg-input" rows={5} value={text} onChange={(e) => { setText(e.target.value); setErr(''); }} placeholder="1. e4 e5 2. Nf3 Nc6 3. Bb5 a6" data-testid="pgn-input" />
        {err && <div className="text-sm" style={{ color: 'var(--mg-bad)' }} data-testid="pgn-error">{err}</div>}
        <button className="mg-btn mg-btn-primary" onClick={go} data-testid="pgn-go">Analyse</button>
      </div>
      {recent.length > 0 && (
        <div className="mg-card p-4"><div className="mg-h2 mb-2">Or pick one of your games</div>
          {recent.map((h) => <button key={h.id} className="mg-btn w-full justify-between mb-2" onClick={() => onLoad({ moves: h.moves, startFen: h.startFen, orientation: h.color, title: `vs ${h.opp}` })}><span>vs {h.opp}</span><span className="mg-mute">{h.result} · {h.moves.length} moves</span></button>)}</div>
      )}
      <button className="mg-btn mg-btn-ghost" onClick={onBack}>Back to games</button>
    </div>
  );
}
