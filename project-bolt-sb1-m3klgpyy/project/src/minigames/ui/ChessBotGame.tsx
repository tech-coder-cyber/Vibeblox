// Playing chess against a bot: pick one, then play with hints, takebacks, draw offers, resignation and bot chat.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Game, Position, materialBalance, moveFrom, moveTo, unicodePiece } from '../chess/rules';
import { CHESS_BOTS, chessBot, engineBot, botAcceptsDraw, botShouldResign, type ChessBot } from '../chess/bots';
import { openingName } from '../chess/openings';
import { barFraction, scoreText } from '../chess/engine';
import { engine, analysisEngine, hasStockfish, stockfishMove } from '../engineClient';
import { botSays, botsOpen, botsByTier, TIERS, type ChatEvent } from '../botCore';
import { crownsFor, bestCrowns, crownText } from '../ratings';
import { addHistory, update, loadProgress, type Prefs, type HistoryEntry, type BoardTheme, type Celebration } from '../store';
import { PieceSvg } from './pieces';
import ChessBoardView, { uciSquares, kingSquare } from './ChessBoardView';
import { useBoardFx } from './Board';
import { BotChat, Confirm, Crowns, MoveList, PlayerBar, Toggle, type ChatLine } from './kit';
import { playSfx } from './sfx';

export type ReviewRequest = { moves: string[]; startFen?: string; orientation: 0 | 1; title: string; /** an analysis board: play moves and watch the engine, instead of grading a game */ explore?: boolean };

const END_TEXT: Record<string, string> = { checkmate: 'checkmate', stalemate: 'stalemate', insufficient: 'insufficient material', fifty: 'the 50-move rule', repetition: 'repetition', agreement: 'agreement', resign: 'resignation' };

const THEME_POOL: BoardTheme[] = ['green', 'brown', 'blue', 'slate', 'rose', 'night', 'grass', 'candy', 'sand', 'ice'];
/** The board a bot "brings" when Showcase Opponent Theme is on. */
export function botTheme(id: string): BoardTheme { let h = 0; for (const c of id) h = (h * 31 + c.charCodeAt(0)) >>> 0; return THEME_POOL[h % THEME_POOL.length]; }
const ENGINE_STEPS = [100, 200, 300, 400, 500, 600, 700, 800, 900, 1000, 1100, 1200, 1300, 1400, 1500, 1600, 1700, 1800, 1900, 2000, 2100, 2200, 2300, 2400, 2500, 2600, 2700, 2800, 2900, 3000];

export default function ChessBotGame({ rank, prefs, onPrefs, onReview, initialBot, onBack }: { rank: string; prefs: Prefs; onPrefs: (p: Prefs) => void; onReview: (r: ReviewRequest) => void; initialBot?: string; onBack: () => void }) {
  const [bot, setBot] = useState<ChessBot | null>(initialBot && initialBot !== 'engine' ? chessBot(initialBot) : CHESS_BOTS[0]);
  const [engineOn, setEngineOn] = useState(initialBot === 'engine');
  const [elo, setElo] = useState(1500);
  const [color, setColor] = useState<'white' | 'black' | 'random'>('white');
  const [started, setStarted] = useState(false);
  const [sf, setSf] = useState<boolean | null>(null);
  const progress = loadProgress();
  useEffect(() => { let live = true; void hasStockfish().then((v) => { if (live) setSf(v); }); return () => { live = false; }; }, []);
  const active: ChessBot | null = engineOn ? engineBot(elo) : bot;
  const previewGame = useMemo(() => new Game(), []);

  if (!started || !active) {
    const open = botsOpen(rank);
    const theme = prefs.showcaseTheme && active ? botTheme(active.id) : undefined;
    const bubble = active ? (engineOn ? `I'll play at about ${elo}${elo >= 3000 ? ' (max)' : ''}. Ready?` : botSays(active.voice, 'start', () => 0)) : '';
    const kings: Array<{ id: 'white' | 'random' | 'black'; label: string }> = [{ id: 'white', label: 'Play as white' }, { id: 'random', label: 'Random colour' }, { id: 'black', label: 'Play as black' }];
    return (
      <div data-testid="chess-setup" className="grid gap-5 lg:grid-cols-[minmax(0,620px)_minmax(320px,400px)] items-start">
        <div>
          {active && <PlayerBar name={active.name} emoji={active.emoji} color={active.color + '33'} rating={String(active.rating)} />}
          <ChessBoardView game={previewGame} version={0} orientation={color === 'black' ? 1 : 0} myColor={null} canMove={false} onUserMove={() => {}} viewPly={null} prefs={prefs} theme={theme} noPremove />
          <PlayerBar name="You" self emoji="🙂" />
        </div>
        <div className="rounded-xl overflow-hidden" style={{ background: '#262522', color: '#fff', border: '1px solid #3a3835' }} data-testid="bot-panel">
          <div className="px-4 py-3 font-bold text-lg flex items-center gap-2" style={{ background: '#21201d', borderBottom: '1px solid #3a3835' }}>🤖 Play Bots</div>
          {active && (
            <div className="px-4 pt-4 flex items-start gap-3">
              <div className="w-20 h-20 rounded-xl flex items-center justify-center text-5xl shrink-0" style={{ background: active.color + '55' }} data-testid="bot-avatar">{active.emoji}</div>
              <div className="relative rounded-xl px-3 py-2 text-sm flex-1" style={{ background: '#3d3b37' }} data-testid="bot-bubble">
                <div className="font-semibold mb-0.5">{active.name} <span style={{ color: '#a8a6a2', fontWeight: 400 }}>({active.rating})</span></div>
                <div style={{ color: '#e8e6e3' }}>{engineOn ? bubble : `Hi, I'm ${active.name}! ${bubble}`}</div>
              </div>
            </div>
          )}
          <div className="px-4 pt-3 pb-1 mg-scroll overflow-y-auto" style={{ maxHeight: 330 }}>
            <BotGrid bots={CHESS_BOTS} open={open} crowns={progress.crowns} pickedId={engineOn ? null : bot?.id ?? null} onPick={(b) => { setBot(b); setEngineOn(false); }} />
            <div className="mt-3 mb-1 flex items-center justify-between text-xs font-semibold" style={{ color: '#c3c1bd' }}><span>Engine</span><span>{elo >= 3000 ? 'Max' : elo}</span></div>
            <button className="w-full text-left rounded-lg p-3" onClick={() => setEngineOn(true)} data-testid="bot-engine" aria-pressed={engineOn} style={{ background: engineOn ? '#3d5a32' : '#33312e', border: `1px solid ${engineOn ? '#81b64c' : '#44423e'}` }}>
              <div className="flex items-center gap-3"><span className="text-2xl">⚙️</span><span className="text-sm font-semibold flex-1">Engine · choose any level</span>{sf === false && <span className="text-xs" style={{ color: '#a8a6a2' }}>built-in</span>}</div>
              <input type="range" min={0} max={ENGINE_STEPS.length - 1} step={1} value={Math.max(0, ENGINE_STEPS.indexOf(elo))} className="w-full mt-2" data-testid="engine-slider" aria-label="Engine rating"
                onChange={(e) => { setElo(ENGINE_STEPS[parseInt(e.target.value, 10)]); setEngineOn(true); }} style={{ accentColor: '#81b64c' }} />
              <div className="flex justify-between text-xs" style={{ color: '#a8a6a2' }}><span>100</span><span>1500</span><span>3000</span></div>
            </button>
          </div>
          <div className="px-4 pb-4 pt-2">
            <details className="mb-3" data-testid="bot-options">
              <summary className="cursor-pointer text-sm font-semibold py-1">Options</summary>
              <div className="pt-1 text-sm"><Toggle on={prefs.botChat} onChange={(v) => onPrefs({ ...prefs, botChat: v })} label="Show what the bot says" testid="opt-botchat" /></div>
            </details>
            <div className="grid grid-cols-3 gap-2 mb-3" role="group">
              {kings.map((k) => (
                <button key={k.id} aria-pressed={color === k.id} onClick={() => setColor(k.id)} data-testid={`color-${k.id}`} title={k.label} aria-label={k.label}
                  className="h-14 rounded-lg flex items-center justify-center" style={{ background: color === k.id ? '#4b4a47' : '#33312e', border: `2px solid ${color === k.id ? '#81b64c' : '#44423e'}` }}>
                  {k.id === 'random' ? <span className="relative w-9 h-9 flex"><span className="w-1/2 overflow-hidden"><PieceSvg set={prefs.pieceSet} type={6} white id="rk1" /></span><span className="w-1/2 overflow-hidden relative"><span className="absolute right-0 w-[200%]"><PieceSvg set={prefs.pieceSet} type={6} white={false} id="rk2" /></span></span></span>
                    : <span className="w-9 h-9"><PieceSvg set={prefs.pieceSet} type={6} white={k.id === 'white'} id={'k' + k.id} /></span>}
                </button>
              ))}
            </div>
            <button className="w-full rounded-lg font-extrabold text-lg py-3" style={{ background: '#81b64c', color: '#fff', boxShadow: '0 4px 0 #537133' }} onClick={() => setStarted(true)} data-testid="start-bot-game">Play</button>
            <p className="text-xs mt-2" style={{ color: '#a8a6a2' }}>Practice games never change your rating. Win with no help to earn three crowns.</p>
            <button className="mg-btn mg-btn-ghost w-full mt-2" onClick={onBack}>Back</button>
          </div>
        </div>
      </div>
    );
  }
  return <Playing key={active.id + (engineOn ? elo : '') + color + String(started)} bot={active} colorChoice={color} prefs={prefs} onPrefs={onPrefs} onReview={onReview} onNewBot={() => setStarted(false)} onBack={onBack} />;
}

function BotGrid({ bots, open, crowns, pickedId, onPick }: { bots: ChessBot[]; open: number; crowns: Record<string, number>; pickedId: string | null; onPick: (b: ChessBot) => void }) {
  const names: Record<string, string> = { beginner: 'New to Chess', intermediate: 'Intermediate', advanced: 'Advanced', master: 'Master' };
  return (
    <div>
      {TIERS.map((t) => {
        const list = botsByTier(bots, t);
        return (
          <div key={t} className="mb-3" data-testid={`tier-sec-${t}`}>
            <div className="text-xs font-semibold mb-1.5 flex justify-between" style={{ color: '#c3c1bd' }}><span>{names[t]}</span><span>{list.length} bots</span></div>
            <div className="grid grid-cols-4 gap-2">
              {list.map((b, i) => {
                const unlocked = i < open;
                return (
                  <button key={b.id} disabled={!unlocked} onClick={() => onPick(b)} data-testid={`bot-${b.id}`} data-locked={!unlocked} title={`${b.name} (${b.rating})${unlocked ? '' : ' - locked'}`}
                    className="rounded-lg p-1 flex flex-col items-center disabled:opacity-50" style={{ background: pickedId === b.id ? '#4b4a47' : 'transparent', outline: pickedId === b.id ? '2px solid #81b64c' : 'none' }}>
                    <span className="w-12 h-12 rounded-lg flex items-center justify-center text-2xl relative" style={{ background: b.color + '55' }}>{b.emoji}{!unlocked && <span className="absolute inset-0 rounded-lg flex items-center justify-center text-base" style={{ background: 'rgba(20,20,20,.55)' }}>🔒</span>}</span>
                    <span className="text-[11px] mt-0.5 truncate max-w-full">{b.name}</span>
                    <span className="text-[10px]" style={{ color: unlocked ? '#f2b84b' : '#77756f' }}>{unlocked ? crownText(crowns[b.id] ?? 0) : b.rating}</span>
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function Playing({ bot, colorChoice, prefs, onPrefs, onReview, onNewBot, onBack }: { bot: ChessBot; colorChoice: 'white' | 'black' | 'random'; prefs: Prefs; onPrefs: (p: Prefs) => void; onReview: (r: ReviewRequest) => void; onNewBot: () => void; onBack: () => void }) {
  const gameRef = useRef<Game>(new Game());
  const game = gameRef.current;
  const [ver, setVer] = useState(0);
  const [mine] = useState<0 | 1>(() => (colorChoice === 'white' ? 0 : colorChoice === 'black' ? 1 : Math.random() < 0.5 ? 0 : 1));
  const [flip, setFlip] = useState(false);
  const [thinking, setThinking] = useState(false);
  const [view, setView] = useState<number | null>(null);
  const [hints, setHints] = useState(0), [takebacks, setTakebacks] = useState(0);
  const [hint, setHint] = useState<{ from: number; to: number } | null>(null);
  const [chat, setChat] = useState<ChatLine[]>([]);
  const [confirm, setConfirm] = useState<null | 'resign' | 'new'>(null);
  const [evalOn, setEvalOn] = useState(false);
  const [evalScore, setEvalScore] = useState(0);
  const [done, setDone] = useState<null | { crowns: number; result: 'win' | 'draw' | 'loss'; text: string }>(null);
  const lastBotScore = useRef(0);
  const chatId = useRef(0);
  const savedRef = useRef(false);
  const botTurnRef = useRef(false);
  const { fx, trigger } = useBoardFx({ allowSlam: true, sound: prefs.sound, soundTheme: prefs.soundTheme });
  const [celebrate, setCelebrate] = useState<{ id: number; kind: Celebration } | null>(null);
  const [fallSq, setFallSq] = useState<number | null>(null);

  const say = useCallback((ev: ChatEvent) => {
    const text = botSays(bot.voice, ev);
    if (text) setChat((c) => [...c.slice(-40), { id: ++chatId.current, who: 'bot', name: bot.name, text }]);
  }, [bot]);
  const sys = (text: string) => setChat((c) => [...c.slice(-40), { id: ++chatId.current, who: 'sys', text }]);

  const greeted = useRef(false);
  useEffect(() => { void engine.newGame(); if (!greeted.current) { greeted.current = true; say('start'); } }, [say]);

  const finishCheck = useCallback(() => {
    if (!game.over || savedRef.current) return;
    savedRef.current = true;
    const res = game.result === '1/2-1/2' ? 'draw' : (game.result === '1-0') === (mine === 0) ? 'win' : 'loss';
    const crowns = crownsFor(res, hints, takebacks);
    const entry: HistoryEntry = { id: `b${Date.now()}`, game: 'chess', mode: 'bot', opp: bot.name, oppId: bot.id, oppRating: bot.rating, color: mine, result: res, reason: END_TEXT[game.reason] ?? game.reason, moves: game.uciList(), at: Date.now(), crowns, hints, takebacks };
    addHistory(entry);
    if (res === 'win' && bot.id !== 'engine') update((p) => { p.crowns[bot.id] = bestCrowns(p.crowns[bot.id], crowns); });
    say(res === 'win' ? 'lose' : res === 'loss' ? 'win' : 'draw');
    playSfx(res === 'win' ? 'win' : res === 'loss' ? 'lose' : 'end', prefs.sound, prefs.soundTheme);
    if (res === 'win') setCelebrate({ id: Date.now(), kind: prefs.celebration }); else if (res === 'loss' && game.reason === 'checkmate') setFallSq(kingSquare(game.pos, mine));
    setDone({ crowns, result: res, text: `${res === 'win' ? 'You won' : res === 'loss' ? 'You lost' : 'Draw'} by ${END_TEXT[game.reason] ?? game.reason}` });
  }, [game, mine, hints, takebacks, bot, say, prefs.sound]);

  const afterMove = useCallback((byBot: boolean, captured: boolean) => {
    setHint(null);
    setVer((v) => v + 1);
    setView(null);
    const gaveCheck = game.pos.inCheck();
    playSfx(game.over && game.reason === 'checkmate' ? 'end' : gaveCheck ? 'check' : captured ? 'capture' : 'move', prefs.sound, prefs.soundTheme);
    if (!game.over) {
      if (byBot && captured && Math.random() < 0.6) say('capture');
      else if (!byBot && captured && Math.random() < 0.5) say('lostPiece');
      else if (byBot && gaveCheck && Math.random() < 0.7) say('check');
    }
    finishCheck();
  }, [game, prefs.sound, prefs.soundTheme, say, finishCheck]);

  // the bot's turn. (Callbacks come through refs so a re-render never cancels a move that is being thought out.)
  const afterMoveRef = useRef(afterMove); afterMoveRef.current = afterMove;
  const sayRef = useRef(say); sayRef.current = say;
  const aliveRef = useRef(true);
  useEffect(() => { aliveRef.current = true; return () => { aliveRef.current = false; botTurnRef.current = false; }; }, []);
  useEffect(() => {
    if (game.over || game.turn === mine || botTurnRef.current) return;
    botTurnRef.current = true; setThinking(true);
    const started = Date.now();
    void (async () => {
      let uci = '', score = 0;
      if (bot.id === 'engine') { try { uci = (await stockfishMove(game.pos.toFen(), bot.rating)) ?? ''; } catch { uci = ''; } if (uci && !game.pos.parseUci(uci)) uci = ''; }
      if (!uci) { try { const r = await engine.chessBot(bot.id, game.startFen, game.uciList(), bot.rating); uci = r.uci; score = r.score; } catch { /* below */ } }
      const minWait = 450 + (bot.voice === 'sleepy' ? 900 : bot.voice === 'robot' ? 0 : Math.random() * 500);
      const wait = Math.max(0, minWait - (Date.now() - started));
      await new Promise((r) => setTimeout(r, wait));
      botTurnRef.current = false;
      if (!aliveRef.current) return;
      setThinking(false);
      if (!uci) { const ms = game.legalMoves(); if (ms.length) uci = game.pos.uci(ms[0]); }
      if (!uci) return;
      lastBotScore.current = score;
      if (botShouldResign(bot, score, game.plies.length) && game.plies.length > 30) { game.finish(mine === 0 ? '1-0' : '0-1', 'resign'); sys(`${bot.name} resigned.`); afterMoveRef.current(true, false); return; }
      const cap = !!game.pos.board[uciSquares(uci).to];
      game.play(uci);
      afterMoveRef.current(true, cap);
      if (!game.over) {
        if (score > 350 && Math.random() < 0.25) sayRef.current('winning'); else if (score < -350 && Math.random() < 0.25) sayRef.current('trouble');
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ver]);

  // eval bar
  useEffect(() => {
    if (!evalOn) return;
    let live = true;
    void (async () => {
      try { const e = await analysisEngine(prefs.engine); const l = await e.lines(game.pos.toFen(), 1, 8, 500); if (live && l[0]) setEvalScore(game.pos.turn === 0 ? l[0].score : -l[0].score); } catch { /* ignore */ }
    })();
    return () => { live = false; };
  }, [evalOn, ver, game, prefs.engine]);

  const onUserMove = (uci: string) => {
    if (game.over || thinking || game.turn !== mine) return;
    const cap = !!game.pos.board[uciSquares(uci).to] || (game.pos.board[uciSquares(uci).from] !== 0 && Math.abs(game.pos.board[uciSquares(uci).from]) === 1 && (uciSquares(uci).from & 7) !== (uciSquares(uci).to & 7));
    if (!game.play(uci)) return;
    afterMove(false, cap);
  };

  const askHint = async () => {
    if (game.over || thinking || game.turn !== mine) return;
    setHints((h) => h + 1); say('hint');
    try {
      const e = await analysisEngine(prefs.engine);
      const l = await e.lines(game.pos.toFen(), 1, 9, 900);
      if (l[0]) { const u = game.pos.uci(l[0].move); setHint(uciSquares(u)); }
    } catch { sys('The hint engine did not answer. Try again.'); }
  };
  const undo = () => {
    if (game.over || thinking || game.plies.length < 1) return;
    const n = game.turn === mine ? (game.plies.length >= 2 ? 2 : 1) : 1;
    if (game.turn === mine && game.plies.length < 2 && mine === 1) return;
    for (let i = 0; i < n; i++) game.undo();
    setTakebacks((t) => t + 1); say('takeback'); setHint(null); setVer((v) => v + 1); setView(null);
  };
  const offerDraw = () => {
    if (game.over || thinking) return;
    const ok = botAcceptsDraw(bot, lastBotScore.current, game.plies.length);
    if (ok) { say('drawAccepted'); game.finish('1/2-1/2', 'agreement'); setVer((v) => v + 1); finishCheck(); }
    else { say('drawDeclined'); sys(game.plies.length < 20 ? `${bot.name} wants to play on a little longer.` : `${bot.name} declined the draw.`); }
  };
  const resign = () => { game.finish(mine === 0 ? '0-1' : '1-0', 'resign'); setConfirm(null); setVer((v) => v + 1); finishCheck(); };
  const toggleEval = (v: boolean) => { if (v && !evalOn && !game.over) setHints((h) => h + 1); setEvalOn(v); };

  const flipped = flip ? ((mine ^ 1) as 0 | 1) : mine;
  const sans = game.sanList();
  const mat = materialBalance(game.pos.board);
  const opening = openingName(sans);
  const reviewing = view !== null && view < game.plies.length;
  const botName = `${bot.emoji} ${bot.name}`;

  // keys for stepping through the moves
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null; if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA')) return;
      const cur = view ?? game.plies.length;
      if (e.key === 'ArrowLeft') { setView(Math.max(0, cur - 1)); e.preventDefault(); }
      if (e.key === 'ArrowRight') { const n = cur + 1; setView(n >= game.plies.length ? null : n); e.preventDefault(); }
    };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [view, game]);

  const captured = (side: 0 | 1) => (side === 0 ? mat.black : mat.white).map((t, i) => (t > 0 ? unicodePiece(side === 0 ? -(i + 1) : i + 1).repeat(t) : '')).join('');

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,640px)_1fr]" data-testid="chess-game">
      <div className="flex gap-2">
        {evalOn && (
          <div className="w-6 rounded overflow-hidden shrink-0 border relative" style={{ borderColor: 'var(--mg-line)', background: '#23262c' }} data-testid="eval-bar" title={scoreText(evalScore)}>
            <div style={{ height: `${(1 - barFraction(evalScore)) * 100}%`, background: '#403d39' }} /><div style={{ height: `${barFraction(evalScore) * 100}%`, background: '#f2efe6' }} />
            <span className="absolute left-0 right-0 text-center font-bold" data-testid="eval-num" style={{ fontSize: 10, [evalScore >= 0 === (flipped === 0) ? 'bottom' : 'top']: 2, color: evalScore >= 0 ? '#262522' : '#f2efe6' }}>{scoreText(evalScore).replace('+', '')}</span>
          </div>
        )}
        <div className="flex-1 min-w-0">
          <PlayerBar name={bot.name} emoji={bot.emoji} color={bot.color + '33'} rating={String(bot.rating)} sub={thinking ? 'Thinking...' : captured(mine === 0 ? 1 : 0)} />
          <ChessBoardView game={game} version={ver} orientation={flipped} myColor={mine} canMove={!thinking && game.turn === mine && !done} onUserMove={onUserMove} viewPly={view} prefs={prefs}
            hint={hint} fx={fx} theme={prefs.showcaseTheme ? botTheme(bot.id) : undefined} celebrate={celebrate} fallSq={fallSq}>
            {done && (
              <div className="absolute inset-0 z-30 flex items-center justify-center p-3" style={{ background: 'rgba(10,12,16,.62)' }} data-testid="end-card">
                <div className="mg-card p-5 text-center w-full max-w-xs">
                  <div className="mg-h1 mb-1">{done.result === 'win' ? 'You won' : done.result === 'loss' ? 'You lost' : 'Draw'}</div>
                  <div className="text-sm mg-mute mb-2">{done.text.replace(/^You (won|lost) by /, 'By ').replace(/^Draw by /, 'By ')}</div>
                  {done.result === 'win' && <div className="mb-1"><Crowns n={done.crowns} size={28} /><div className="text-xs mg-mute mt-1" data-testid="crown-note">{done.crowns === 3 ? 'No hints or takebacks: 3 crowns.' : done.crowns === 2 ? 'Won with one hint or takeback: 2 crowns.' : 'Won with several hints or takebacks: 1 crown.'}</div></div>}
                  <div className="flex flex-col gap-2 mt-3">
                    <button className="mg-btn mg-btn-primary" onClick={() => onReview({ moves: game.uciList(), orientation: mine, title: `You vs ${bot.name}` })} data-testid="review-game">Review the game</button>
                    <button className="mg-btn" onClick={onNewBot} data-testid="play-again">Play another bot</button>
                  </div>
                </div>
              </div>
            )}
          </ChessBoardView>
          <PlayerBar name="You" self emoji="🙂" sub={captured(mine)} />
        </div>
      </div>

      <div className="space-y-3 min-w-0">
        <div className="mg-card p-3">
          <div className="flex items-center justify-between mb-1"><span className="mg-h2">{opening ?? 'Moves'}</span>{reviewing && <button className="mg-btn mg-btn-sm" onClick={() => setView(null)}>Back to game</button>}</div>
          <MoveList moves={sans} view={view ?? sans.length} onView={(p) => setView(p >= sans.length ? null : p)} />
        </div>

        <div className="mg-card p-3 grid grid-cols-2 gap-2">
          <button className="mg-btn" disabled={!!done || thinking || game.turn !== mine} onClick={askHint} data-testid="hint-btn" title="Shows the best move. Counts against your crowns.">Hint {hints > 0 && <span className="mg-chip">{hints}</span>}</button>
          <button className="mg-btn" disabled={!!done || thinking || game.plies.length < (mine === 0 ? 2 : 1)} onClick={undo} data-testid="undo-btn" title="Takes back your last move. Counts against your crowns.">Take back {takebacks > 0 && <span className="mg-chip">{takebacks}</span>}</button>
          <button className="mg-btn" disabled={!!done || thinking} onClick={offerDraw} data-testid="draw-btn">Offer draw</button>
          <button className="mg-btn mg-btn-danger" disabled={!!done} onClick={() => setConfirm('resign')} data-testid="resign-btn">Resign</button>
          <button className="mg-btn" onClick={() => setFlip((f) => !f)} data-testid="flip-btn">Flip board</button>
          <button className="mg-btn" onClick={() => trigger('throw')} data-testid="throw-btn" title="Press T">Throw pieces (T)</button>
          <button className="mg-btn" onClick={() => trigger('slam')} data-testid="slam-btn" title="Press F" style={{ gridColumn: 'span 2' }}>Crash out (F)</button>
        </div>
        <div className="mg-card p-3">
          <Toggle on={evalOn} onChange={toggleEval} label="Evaluation bar (counts as a hint)" testid="opt-eval" />
          <Toggle on={prefs.botChat} onChange={(v) => onPrefs({ ...prefs, botChat: v })} label="Bot chat" testid="opt-botchat-live" />
        </div>
        {prefs.botChat && (
          <div className="mg-card p-3">
            <div className="mg-h2 mb-1">{botName}</div>
            <BotChat lines={chat} emoji={bot.emoji} />
            <div className="text-xs mg-mute mt-2">Bots can talk, but you can't talk back.</div>
          </div>
        )}
        <div className="flex gap-2"><button className="mg-btn mg-btn-ghost" onClick={() => setConfirm('new')}>Choose another bot</button><button className="mg-btn mg-btn-ghost" onClick={onBack}>Back to games</button></div>
      </div>
      {confirm === 'resign' && <Confirm title="Resign this game?" body="You'll lose the game." yes="Resign" danger onYes={resign} onNo={() => setConfirm(null)} />}
      {confirm === 'new' && <Confirm title="Leave this game?" body={done ? undefined : "The game ends and counts as unfinished."} yes="Choose another bot" onYes={() => { setConfirm(null); onNewBot(); }} onNo={() => setConfirm(null)} />}
    </div>
  );
}
void Position; void moveFrom; void moveTo;
