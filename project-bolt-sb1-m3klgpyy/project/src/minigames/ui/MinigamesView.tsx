// The Games area: chess, 2048, minesweeper, connect 4, puzzles, lessons, analysis, leaderboards, history and settings.
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { loadPrefs, savePrefs, loadProgress, reviewsLeft, type HistoryEntry, type Prefs } from '../store';
import * as api from '../api';
import { setServerPresence } from '../../social';
import ChessBotGame, { type ReviewRequest } from './ChessBotGame';
import ChessOnline from './ChessOnline';
import CheckersBotGame, { type CheckersReview } from './CheckersBotGame';
import CheckersOnline from './CheckersOnline';
import { Game2048 } from './ArcadeGames';
import { Minesweeper, Connect4 } from './MoreGames';
import PuzzlesView from './PuzzlesView';
import LearnView from './LearnView';
import AnalysisView from './AnalysisView';
import AnalysisSetup from './AnalysisSetup';
import { RankBadges, SelfBadgeContext, type BadgeInfo } from './Badge';
import { CheckersReplay, HistoryView, Leaderboards, RatingCard, Settings } from './Panels';
import './mg.css';

export type GameIntent = { kind: 'join'; friendId: string; friendName: string } | { kind: 'spectate'; game: api.GameKind; gameId: string } | null;
export type MgAccount = { userId: string; username: string } | null;

type Screen =
  | { k: 'home' } | { k: 'chessBot'; bot?: string } | { k: 'ckBot' } | { k: 'lobby'; game: api.GameKind }
  | { k: 'online'; game: api.GameKind; id: string } | { k: 'puzzles' } | { k: 'learn' } | { k: 'g2048' } | { k: 'mines' } | { k: 'c4' }
  | { k: 'analysis'; req: ReviewRequest } | { k: 'loadAnalysis' } | { k: 'ckReplay'; req: CheckersReview } | { k: 'boards' } | { k: 'history' }
  | { k: 'chessHub' } | { k: 'ckHub' } | { k: 'chessSettings' } | { k: 'ckSettings' };

export default function MinigamesView({ account, rank, badge = null, intent, onIntentDone }: { account: MgAccount; rank: string; badge?: BadgeInfo | null; intent?: GameIntent; onIntentDone?: () => void }) {
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
    case 'home': body = <Home onGo={go} account={account} signedIn={signedIn} notice={notice} badge={badge} />; break;
    case 'chessHub': body = <ChessHub signedIn={signedIn} onGo={go} onBack={home} />; break;
    case 'ckHub': body = <CheckersHub signedIn={signedIn} onGo={go} onBack={home} />; break;
    case 'chessBot': body = <ChessBotGame rank={rank} prefs={prefs} onPrefs={setPrefs} onReview={review} initialBot={screen.bot} onBack={() => go({ k: 'chessHub' })} />; break;
    case 'ckBot': body = <CheckersBotGame rank={rank} prefs={prefs} onPrefs={setPrefs} onReview={ckReview} onBack={() => go({ k: 'ckHub' })} />; break;
    case 'lobby': body = account ? <Lobby game={screen.game} account={account} onPresence={setPresence} onStart={(id) => go({ k: 'online', game: screen.game, id })} onBack={() => go({ k: screen.game === 'chess' ? 'chessHub' : 'ckHub' })} /> : <NeedAccount onBack={home} />; break;
    case 'online': body = screen.game === 'chess'
      ? <ChessOnline key={screen.id} gameId={screen.id} me={account?.userId ?? ''} prefs={prefs} onReview={review} onBack={home} />
      : <CheckersOnline key={screen.id} gameId={screen.id} me={account?.userId ?? ''} prefs={prefs} onReview={ckReview} onBack={home} />; break;
    case 'puzzles': body = <PuzzlesView prefs={prefs} signedIn={signedIn} onBack={() => go({ k: 'chessHub' })} />; break;
    case 'learn': body = <LearnView prefs={prefs} onBack={() => go({ k: 'chessHub' })} />; break;
    case 'g2048': body = <Game2048 prefs={prefs} signedIn={signedIn} onBack={home} />; break;
    case 'mines': body = <Minesweeper prefs={prefs} onBack={home} />; break;
    case 'c4': body = <Connect4 prefs={prefs} onBack={home} />; break;
    case 'analysis': body = <AnalysisView req={screen.req} rank={rank} prefs={prefs} onPrefs={setPrefs} onBack={() => go({ k: 'loadAnalysis' })} />; break;
    case 'loadAnalysis': body = <AnalysisSetup prefs={prefs} onLoad={review} left={reviewsLeft(rank)} onBack={() => go({ k: 'chessHub' })} />; break;
    case 'ckReplay': body = <CheckersReplay moves={screen.req.moves} orientation={screen.req.orientation} title={screen.req.title} prefs={prefs} onBack={home} />; break;
    case 'boards': body = <Leaderboards signedIn={signedIn} onBack={home} />; break;
    case 'history': body = <HistoryView onAnalyse={fromHistory} onReplay={(h) => ckReview({ kind: 'checkers', moves: h.moves, orientation: h.color, title: `Checkers vs ${h.opp}` })} onBack={home} />; break;
    case 'chessSettings': body = <Settings game="chess" prefs={prefs} onPrefs={setPrefs} onBack={() => go({ k: 'chessHub' })} />; break;
    case 'ckSettings': body = <Settings game="checkers" prefs={prefs} onPrefs={setPrefs} onBack={() => go({ k: 'ckHub' })} />; break;
  }
  // online games must not remember a stale "searching" status
  useEffect(() => { if (screen.k === 'online' && account) { setPresence(`mg:${screen.game}:${screen.id}`); } else if (screen.k !== 'lobby') setPresence(null); }, [screen, account]);

  return (
    <SelfBadgeContext.Provider value={badge}>
    <div className="mg min-h-full p-4 sm:p-6 max-w-6xl mx-auto" data-testid="minigames">
      {screen.k === 'home' ? (
        <div className="grid gap-5 lg:grid-cols-[1fr_300px]">
          <div className="min-w-0">{body}</div>
          <div className="space-y-4 min-w-0"><RatingCard signedIn={signedIn} /><LiveGames onSpectate={(g) => go({ k: 'online', game: g.game, id: g.id })} signedIn={signedIn} /></div>
        </div>
      ) : body}
    </div>
    </SelfBadgeContext.Provider>
  );
}

function Home({ onGo, account, signedIn, notice, badge }: { onGo: (s: Screen) => void; account: MgAccount; signedIn: boolean; notice: string; badge: BadgeInfo | null }) {
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
      <p className="text-sm mg-mute mb-4">Board games and puzzles to play while you take a break from building{account ? `, ${account.username}` : ''} <RankBadges badge={badge} />. Most of them work with no internet.</p>
      {notice && <div className="mg-card p-3 text-sm mb-3" style={{ borderColor: 'var(--mg-bad)' }} data-testid="games-notice">{notice}</div>}
      <div className="grid gap-4 sm:grid-cols-2">
        <Card testid="card-chess" title="Chess" tag="Online and offline" blurb="Play real people or one of 32 bots, solve puzzles, learn openings, analyse games, and set up your board.">
          <button className="mg-btn mg-btn-primary" onClick={() => onGo({ k: 'chessHub' })} data-testid="open-chess">Open chess</button>
        </Card>
        <Card testid="card-2048" title="2048" tag="Offline" blurb="Slide the tiles and join matching numbers."><button className="mg-btn mg-btn-primary" onClick={() => onGo({ k: 'g2048' })} data-testid="open-2048">Play 2048</button></Card>
        <Card testid="card-mines" title="Minesweeper" tag="Offline" blurb="Find every mine without opening one. Three sizes, flags, and a best time for each."><button className="mg-btn mg-btn-primary" onClick={() => onGo({ k: 'mines' })} data-testid="open-mines">Play Minesweeper</button></Card>
        <Card testid="card-c4" title="Connect 4" tag="Offline" blurb="Drop discs and get four in a row. Play the computer on easy, normal or hard, or take turns with a friend."><button className="mg-btn mg-btn-primary" onClick={() => onGo({ k: 'c4' })} data-testid="open-c4">Play Connect 4</button></Card>
        <Card testid="card-more" title="Leaderboards and history" tag="Everyone" blurb="See who is on top, and look back at the games you played."><button className="mg-btn" onClick={() => onGo({ k: 'boards' })} data-testid="open-boards">Leaderboards</button><button className="mg-btn" onClick={() => onGo({ k: 'history' })} data-testid="open-history">History</button></Card>
      </div>
    </div>
  );
}

type HubItem = { id: string; title: string; blurb: string; icon: string; onClick: () => void; disabled?: boolean; hint?: string; primary?: boolean };
function HubGrid({ title, blurb, items, onBack }: { title: string; blurb: string; items: HubItem[]; onBack: () => void }) {
  return (
    <div data-testid="game-hub">
      <div className="flex items-center gap-3 mb-1"><h1 className="mg-h1 flex-1">{title}</h1><button className="mg-btn mg-btn-ghost" onClick={onBack} data-testid="hub-back">All games</button></div>
      <p className="text-sm mg-mute mb-4">{blurb}</p>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((it) => (
          <button key={it.id} className="mg-card p-4 text-left flex gap-3 items-start transition-colors disabled:opacity-50" disabled={it.disabled} title={it.hint} onClick={it.onClick} data-testid={it.id}>
            <span className="text-3xl shrink-0">{it.icon}</span><span><span className="font-semibold block">{it.title}</span><span className="text-sm mg-mute">{it.blurb}</span></span>
          </button>
        ))}
      </div>
    </div>
  );
}
function ChessHub({ signedIn, onGo, onBack }: { signedIn: boolean; onGo: (s: Screen) => void; onBack: () => void }) {
  const hint = signedIn ? undefined : 'Sign in from the Social tab to play online';
  return <HubGrid title="Chess" blurb="Everything for chess in one place." onBack={onBack} items={[
    { id: 'chess-bots', icon: '🤖', title: 'Play bots', blurb: '32 bots with their own styles, or the Engine from 100 to 3000.', onClick: () => onGo({ k: 'chessBot' }) },
    { id: 'chess-online', icon: '🌐', title: 'Play online', blurb: 'Find a real opponent and play for a rating.', onClick: () => onGo({ k: 'lobby', game: 'chess' }), disabled: !signedIn, hint },
    { id: 'open-puzzles', icon: '🧩', title: 'Puzzles', blurb: '100 puzzles from easy to hard with your own puzzle rating.', onClick: () => onGo({ k: 'puzzles' }) },
    { id: 'open-learn', icon: '📚', title: 'Learn', blurb: 'The pieces, the rules, tactics and openings.', onClick: () => onGo({ k: 'learn' }) },
    { id: 'open-analysis', icon: '🔍', title: 'Analysis', blurb: 'Review a game, paste a PGN or FEN, or set up any position.', onClick: () => onGo({ k: 'loadAnalysis' }) },
    { id: 'open-chess-settings', icon: '⚙️', title: 'Chess settings', blurb: 'Board, pieces, moves, animations, board effects and sounds.', onClick: () => onGo({ k: 'chessSettings' }) },
    { id: 'open-chess-history', icon: '🕘', title: 'History', blurb: 'Your past games, ready to review.', onClick: () => onGo({ k: 'history' }) },
  ]} />;
}
function CheckersHub({ signedIn, onGo, onBack }: { signedIn: boolean; onGo: (s: Screen) => void; onBack: () => void }) {
  const hint = signedIn ? undefined : 'Sign in from the Social tab to play online';
  return <HubGrid title="Checkers" blurb="American checkers: jumps are forced." onBack={onBack} items={[
    { id: 'ck-bots', icon: '🤖', title: 'Play bots', blurb: '24 bots, from careful to wild.', onClick: () => onGo({ k: 'ckBot' }) },
    { id: 'ck-online-btn', icon: '🌐', title: 'Play online', blurb: 'Find a real opponent and play for a rating.', onClick: () => onGo({ k: 'lobby', game: 'checkers' }), disabled: !signedIn, hint },
    { id: 'open-ck-history', icon: '🕘', title: 'History and replay', blurb: 'Step through your past games.', onClick: () => onGo({ k: 'history' }) },
    { id: 'open-ck-settings', icon: '⚙️', title: 'Checkers settings', blurb: 'Board, pieces, animations, board effects and sounds.', onClick: () => onGo({ k: 'ckSettings' }) },
  ]} />;
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
