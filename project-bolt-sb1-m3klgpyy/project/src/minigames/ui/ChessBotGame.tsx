// Playing chess against a bot: pick one, then play with hints, takebacks, draw offers, resignation and bot chat.
import { Component, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Game, Position, materialBalance, moveFrom, moveTo, unicodePiece } from '../chess/rules';
import { CHESS_BOTS, chessBot, engineBot, botShouldResign, type ChessBot } from '../chess/bots';
import { botSaysExtra, isBlunder, botThinkMs, drawDecision, ratingPenalty, clockText, timeCtl, TIME_CONTROLS, type ExtraEvent, type TimeCtl } from '../chess/botTalk';
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

const END_TEXT: Record<string, string> = { checkmate: 'checkmate', stalemate: 'stalemate', insufficient: 'insufficient material', fifty: 'the 50-move rule', repetition: 'repetition', agreement: 'agreement', resign: 'resignation', timeout: 'time running out' };

/** The game in progress is kept on this device, so a crash or a closed tab does not lose it. */
type BotSave = { v: 1; botId: string; engine: boolean; elo: number; mine: 0 | 1; moves: string[]; startFen: string; tc: string; clocks: [number, number]; hints: number; takebacks: number; at: number };
const SAVE_KEY = 'vb-chess-bot-save';
function loadSave(): BotSave | null {
  try {
    const s = JSON.parse(localStorage.getItem(SAVE_KEY) ?? 'null') as BotSave | null;
    if (!s || s.v !== 1 || !Array.isArray(s.moves) || !s.moves.length || Date.now() - s.at > 7 * 86_400_000) return null;
    return s;
  } catch { return null; }
}
function writeSave(s: BotSave) { try { localStorage.setItem(SAVE_KEY, JSON.stringify(s)); } catch { /* storage may be full or blocked */ } }
function clearSave() { try { localStorage.removeItem(SAVE_KEY); } catch { /* ignore */ } }

/** If the game screen ever throws, the saved game is offered back instead of a blank page. */
class BotBoundary extends Component<{ onRecover: () => void; onBack: () => void; children: ReactNode }, { err: Error | null }> {
  state = { err: null as Error | null };
  static getDerivedStateFromError(err: Error) { return { err }; }
  render() {
    if (!this.state.err) return this.props.children;
    return (
      <div className="mg-card p-5 max-w-md mx-auto text-center" data-testid="bot-crash">
        <div className="mg-h2 mb-2">Something went wrong</div>
        <p className="text-sm mg-mute mb-3">Your game was saved after your last move. You can carry on from there.</p>
        <div className="flex gap-2 justify-center"><button className="mg-btn mg-btn-primary" onClick={() => { this.setState({ err: null }); this.props.onRecover(); }} data-testid="bot-recover">Resume my game</button><button className="mg-btn mg-btn-ghost" onClick={this.props.onBack}>Back to games</button></div>
      </div>
    );
  }
}

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
  const [tcId, setTcId] = useState('none');
  const [saved, setSaved] = useState<BotSave | null>(() => loadSave());
  const [resumeNow, setResumeNow] = useState(false);
  const [playKey, setPlayKey] = useState(0);
  const [sf, setSf] = useState<boolean | null>(null);
  const progress = loadProgress();
  useEffect(() => { let live = true; void hasStockfish().then((v) => { if (live) setSf(v); }); return () => { live = false; }; }, []);
  const active: ChessBot | null = engineOn ? engineBot(elo) : bot;
  const doResume = (s: BotSave) => {
    if (s.engine) { setEngineOn(true); setElo(s.elo); } else { const b = chessBot(s.botId); if (b) { setBot(b); setEngineOn(false); } }
    setColor(s.mine === 0 ? 'white' : 'black'); setTcId(s.tc); setResumeNow(true); setPlayKey((k) => k + 1); setStarted(true);
  };
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
          {saved && (
            <div className="mx-4 mt-3 rounded-lg p-3 text-sm" style={{ background: '#33312e', border: '1px solid #81b64c' }} data-testid="resume-card">
              <div className="font-semibold mb-1">You have a game in progress</div>
              <div style={{ color: '#c3c1bd' }} className="mb-2">{saved.engine ? `Engine (${saved.elo})` : chessBot(saved.botId)?.name ?? 'A bot'} · {Math.ceil(saved.moves.length / 2)} moves</div>
              <div className="flex gap-2"><button className="mg-btn mg-btn-primary mg-btn-sm" onClick={() => doResume(saved)} data-testid="resume-game">Resume</button><button className="mg-btn mg-btn-ghost mg-btn-sm" onClick={() => { clearSave(); setSaved(null); }}>Discard</button></div>
            </div>
          )}
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
            <details className="mb-3" open data-testid="bot-options">
              <summary className="cursor-pointer text-sm font-semibold py-1">Options</summary>
              <div className="pt-1 text-sm space-y-2">
                <div>
                  <div className="text-xs mb-1" style={{ color: '#c3c1bd' }}>Timer</div>
                  <div className="flex flex-wrap gap-1.5" role="group" aria-label="Time control">
                    {TIME_CONTROLS.map((t) => (
                      <button key={t.id} aria-pressed={tcId === t.id} onClick={() => setTcId(t.id)} data-testid={`tc-${t.id}`} className="px-2.5 py-1 rounded-md text-xs font-semibold"
                        style={{ background: tcId === t.id ? '#4b4a47' : '#33312e', border: `1px solid ${tcId === t.id ? '#81b64c' : '#44423e'}` }}>{t.label}</button>
                    ))}
                  </div>
                  {tcId !== 'none' && <div className="text-[11px] mt-1" style={{ color: '#a8a6a2' }}>Bots play faster with a timer, but make weaker moves.</div>}
                </div>
                {!engineOn && <Toggle on={prefs.botChat} onChange={(v) => onPrefs({ ...prefs, botChat: v })} label="Show what the bot says" testid="opt-botchat" />}
                <Toggle on={prefs.showcaseTheme} onChange={(v) => onPrefs({ ...prefs, showcaseTheme: v })} label="Use the bot's own board colours" testid="opt-showcase" />
              </div>
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
            <button className="w-full rounded-lg font-extrabold text-lg py-3" style={{ background: '#81b64c', color: '#fff', boxShadow: '0 4px 0 #537133' }} onClick={() => { clearSave(); setSaved(null); setResumeNow(false); setPlayKey((k) => k + 1); setStarted(true); }} data-testid="start-bot-game">Play</button>
            <p className="text-xs mt-2" style={{ color: '#a8a6a2' }}>Practice games never change your rating. Win with no help to earn three crowns.</p>
            <button className="mg-btn mg-btn-ghost w-full mt-2" onClick={onBack}>Back</button>
          </div>
        </div>
      </div>
    );
  }
  return (
    <BotBoundary onBack={onBack} onRecover={() => { setSaved(loadSave()); setResumeNow(true); setPlayKey((k) => k + 1); }}>
      <Playing key={active.id + (engineOn ? elo : '') + color + String(started) + playKey} bot={active} colorChoice={color} tc={timeCtl(tcId)} resume={resumeNow ? loadSave() : null} prefs={prefs} onPrefs={onPrefs} onReview={onReview}
        onNewBot={() => { clearSave(); setSaved(null); setResumeNow(false); setStarted(false); }} onBack={onBack} />
    </BotBoundary>
  );
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

function Playing({ bot, colorChoice, tc, resume, prefs, onPrefs, onReview, onNewBot, onBack }: { bot: ChessBot; colorChoice: 'white' | 'black' | 'random'; tc: TimeCtl; resume: BotSave | null; prefs: Prefs; onPrefs: (p: Prefs) => void; onReview: (r: ReviewRequest) => void; onNewBot: () => void; onBack: () => void }) {
  const isEngine = bot.id === 'engine';
  const gameRef = useRef<Game | null>(null);
  if (!gameRef.current) {
    const g = new Game(resume?.startFen);
    if (resume) for (const u of resume.moves) { try { if (!g.play(u)) break; } catch { break; } } // pick the saved game up again
    gameRef.current = g;
  }
  const game = gameRef.current;
  const [ver, setVer] = useState(0);
  const [mine] = useState<0 | 1>(() => (resume ? resume.mine : colorChoice === 'white' ? 0 : colorChoice === 'black' ? 1 : Math.random() < 0.5 ? 0 : 1));
  const [flip, setFlip] = useState(false);
  const [thinking, setThinking] = useState(false);
  const [view, setView] = useState<number | null>(null);
  const [hints, setHints] = useState(resume?.hints ?? 0), [takebacks, setTakebacks] = useState(resume?.takebacks ?? 0);
  const [hint, setHint] = useState<{ from: number; to: number } | null>(null);
  const [chat, setChat] = useState<ChatLine[]>([]);
  const [confirm, setConfirm] = useState<null | 'resign' | 'new'>(null);
  const [evalOn, setEvalOn] = useState(false);
  const [evalScore, setEvalScore] = useState(0);
  const [done, setDone] = useState<null | { crowns: number; result: 'win' | 'draw' | 'loss'; text: string }>(null);
  const [note, setNote] = useState('');
  const [drawBusy, setDrawBusy] = useState(false);
  const lastBotScore = useRef(0);
  const chatId = useRef(0);
  const savedRef = useRef(false);
  const botTurnRef = useRef(false);
  const drawCool = useRef(0);          // the draw button works again from this ply on
  const lastBlunder = useRef(false);   // the bot's last move was a blunder
  const lastOpening = useRef<string | null>(null);
  const hintsRef = useRef(hints); hintsRef.current = hints;
  const takebacksRef = useRef(takebacks); takebacksRef.current = takebacks;
  const { fx, stop: stopFx } = useBoardFx({ allowSlam: true, sound: prefs.sound, soundTheme: prefs.soundTheme });
  const [celebrate, setCelebrate] = useState<{ id: number; kind: Celebration } | null>(null);
  const [fallSq, setFallSq] = useState<number | null>(null);

  // clocks (only with a timer)
  const base = tc.base * 1000;
  const clockRef = useRef<[number, number]>(resume?.clocks ?? [base, base]);
  const lastTick = useRef(Date.now());
  const [, setTick] = useState(0);

  const noteLater = (text: string) => { setNote(text); window.setTimeout(() => setNote((n) => (n === text ? '' : n)), 4200); };
  const say = useCallback((ev: ChatEvent) => {
    if (isEngine) return; // the engine does not talk
    const text = botSays(bot.voice, ev);
    if (text) setChat((c) => [...c.slice(-40), { id: ++chatId.current, who: 'bot', name: bot.name, text }]);
  }, [bot, isEngine]);
  const sayEx = useCallback((ev: ExtraEvent, opening?: string) => {
    if (isEngine) return;
    setChat((c) => [...c.slice(-40), { id: ++chatId.current, who: 'bot', name: bot.name, text: botSaysExtra(bot.voice, ev, opening) }]);
  }, [bot, isEngine]);
  const sys = (text: string) => { if (!isEngine) setChat((c) => [...c.slice(-40), { id: ++chatId.current, who: 'sys', text }]); noteLater(text); };

  const greeted = useRef(false);
  useEffect(() => { void engine.newGame(); if (!greeted.current) { greeted.current = true; if (!resume) say('start'); } }, [say, resume]);

  const persist = useCallback(() => {
    if (game.over) { clearSave(); return; }
    if (!game.plies.length) return;
    writeSave({ v: 1, botId: bot.id, engine: isEngine, elo: bot.rating, mine, moves: game.uciList(), startFen: game.startFen, tc: tc.id, clocks: [Math.round(clockRef.current[0]), Math.round(clockRef.current[1])], hints: hintsRef.current, takebacks: takebacksRef.current, at: Date.now() });
  }, [game, bot, isEngine, mine, tc.id]);

  const finishCheck = useCallback(() => {
    if (!game.over || savedRef.current) return;
    savedRef.current = true; clearSave();
    const res = game.result === '1/2-1/2' ? 'draw' : (game.result === '1-0') === (mine === 0) ? 'win' : 'loss';
    const crowns = crownsFor(res, hintsRef.current, takebacksRef.current);
    const entry: HistoryEntry = { id: `b${Date.now()}`, game: 'chess', mode: 'bot', opp: bot.name, oppId: bot.id, oppRating: bot.rating, color: mine, result: res, reason: END_TEXT[game.reason] ?? game.reason, moves: game.uciList(), at: Date.now(), crowns, hints: hintsRef.current, takebacks: takebacksRef.current };
    addHistory(entry);
    if (res === 'win' && bot.id !== 'engine') update((p) => { p.crowns[bot.id] = bestCrowns(p.crowns[bot.id], crowns); });
    say(res === 'win' ? 'lose' : res === 'loss' ? 'win' : 'draw');
    playSfx(res === 'win' ? 'win' : res === 'loss' ? 'lose' : 'end', prefs.sound, prefs.soundTheme);
    if (res === 'win') setCelebrate({ id: Date.now(), kind: prefs.celebration }); else if (res === 'loss' && game.reason === 'checkmate') setFallSq(kingSquare(game.pos, mine));
    setDone({ crowns, result: res, text: `${res === 'win' ? 'You won' : res === 'loss' ? 'You lost' : 'Draw'} by ${END_TEXT[game.reason] ?? game.reason}` });
  }, [game, mine, bot, say, prefs.sound, prefs.soundTheme, prefs.celebration]);

  /** capType: the kind of piece that was taken (0 = nothing), promoted: a pawn became a piece */
  const afterMove = useCallback((byBot: boolean, capType: number, promoted: boolean) => {
    setHint(null);
    if (tc.inc && game.plies.length > 2) clockRef.current[byBot ? mine ^ 1 : mine] += tc.inc * 1000;
    lastTick.current = Date.now();
    setVer((v) => v + 1);
    setView(null);
    const gaveCheck = game.pos.inCheck();
    playSfx(game.over && game.reason === 'checkmate' ? 'end' : gaveCheck ? 'check' : capType ? 'capture' : 'move', prefs.sound, prefs.soundTheme);
    if (!game.over) {
      let spoke = false;
      if (byBot) {
        const bad = isBlunder(game.pos); // did the bot just leave something hanging, or allow mate?
        lastBlunder.current = bad;
        if (bad) { if (Math.random() < (bot.rating < 1000 ? 0.7 : 0.35)) { sayEx('blunder'); spoke = true; } }
        else if (capType === 5) { sayEx('queenWon'); spoke = true; }
        else if (promoted) { sayEx('promotion'); spoke = true; }
        else if (capType && Math.random() < 0.55) { say('capture'); spoke = true; }
        else if (gaveCheck && Math.random() < 0.7) { say('check'); spoke = true; }
      } else {
        if (capType === 5) { sayEx('queenLost'); spoke = true; }
        else if (promoted && Math.random() < 0.8) { sayEx('promotion'); spoke = true; }
        else if (capType >= 2 && !lastBlunder.current && Math.random() < 0.4) { say('lostPiece'); spoke = true; } // no "nice grab" when the bot just gave the piece away
        lastBlunder.current = false;
      }
      // name the opening when it first appears (only in the first moves)
      const name = openingName(game.sanList());
      if (name && name !== lastOpening.current && game.plies.length <= 12) { lastOpening.current = name; if (!spoke && Math.random() < 0.55) sayEx('opening', name); }
    }
    persist();
    finishCheck();
  }, [game, mine, tc.inc, prefs.sound, prefs.soundTheme, say, sayEx, bot.rating, finishCheck, persist]);

  // the bot's turn. (Callbacks come through refs so a re-render never cancels a move that is being thought out.)
  const afterMoveRef = useRef(afterMove); afterMoveRef.current = afterMove;
  const sayRef = useRef(say); sayRef.current = say;
  const aliveRef = useRef(true);
  useEffect(() => { aliveRef.current = true; return () => { aliveRef.current = false; botTurnRef.current = false; }; }, []);
  useEffect(() => {
    if (game.over || game.turn === mine || botTurnRef.current) return;
    botTurnRef.current = true; setThinking(true);
    const started = Date.now();
    const effRating = Math.max(100, bot.rating - ratingPenalty(tc)); // a fast timer makes the bot play worse
    void (async () => {
      let uci = '', score = 0;
      try {
        if (bot.id === 'engine') { try { uci = (await stockfishMove(game.pos.toFen(), effRating)) ?? ''; } catch { uci = ''; } if (uci && !game.pos.parseUci(uci)) uci = ''; }
        if (!uci) { try { const r = await engine.chessBot(bot.id, game.startFen, game.uciList(), effRating); uci = r.uci; score = r.score; } catch { /* below */ } }
      } catch { /* below */ }
      // it takes a moment, like a person would: about 2 to 3 seconds, quicker with a timer, longer in hard positions
      let target = 1500;
      try { target = botThinkMs(game, bot.voice, tc, tc.base ? clockRef.current[mine ^ 1] : null); } catch { /* use the default */ }
      await new Promise((r) => setTimeout(r, Math.max(0, target - (Date.now() - started))));
      botTurnRef.current = false;
      if (!aliveRef.current) return;
      setThinking(false);
      if (game.over || game.turn === mine) return; // the game ended (or changed) while it was thinking
      if (!uci || !game.pos.parseUci(uci)) { const ms = game.legalMoves(); uci = ms.length ? game.pos.uci(ms[Math.floor(Math.random() * ms.length)]) : ''; }
      if (!uci) return;
      lastBotScore.current = score;
      if (botShouldResign(bot, score, game.plies.length) && game.plies.length > 30) { game.finish(mine === 0 ? '1-0' : '0-1', 'resign'); sys(`${bot.name} resigned.`); afterMoveRef.current(true, 0, false); return; }
      const { from, to } = uciSquares(uci);
      const piece = Math.abs(game.pos.board[from]);
      const capType = Math.abs(game.pos.board[to]) || (piece === 1 && (from & 7) !== (to & 7) ? 1 : 0);
      game.play(uci);
      afterMoveRef.current(true, capType, uci.length === 5);
      if (!game.over) {
        if (score > 350 && Math.random() < 0.25) sayRef.current('winning'); else if (score < -350 && Math.random() < 0.25) sayRef.current('trouble');
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ver]);

  // the clocks
  useEffect(() => {
    if (!tc.base || done) return;
    lastTick.current = Date.now();
    const id = window.setInterval(() => {
      const now = Date.now(), dt = now - lastTick.current; lastTick.current = now;
      if (game.over || game.plies.length < 2) return; // the clocks start once both sides have moved
      const side = game.turn;
      clockRef.current[side] = Math.max(0, clockRef.current[side] - dt);
      if (clockRef.current[side] <= 0) { game.finish(side === 0 ? '0-1' : '1-0', 'timeout'); setVer((v) => v + 1); finishCheck(); return; }
      setTick((t) => t + 1);
    }, 100);
    return () => window.clearInterval(id);
  }, [tc.base, done, game, finishCheck]);

  // a leftover save is removed when the game is over; when you leave a game that is still going it stays so you can resume it
  useEffect(() => { if (game.over) clearSave(); }, [ver, game]);

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
    const { from, to } = uciSquares(uci);
    const piece = Math.abs(game.pos.board[from]);
    const capType = Math.abs(game.pos.board[to]) || (piece === 1 && (from & 7) !== (to & 7) ? 1 : 0);
    if (!game.play(uci)) return;
    afterMove(false, capType, uci.length === 5);
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
    setTakebacks((t) => t + 1); say('takeback'); setHint(null); setVer((v) => v + 1); setView(null); persist();
  };
  // A bot looks at the position as it is right now. It never takes a draw when it is better, and after a "no" you have to wait
  // a few moves, so spamming the button does not work.
  const offerDraw = async () => {
    if (game.over || thinking || drawBusy) return;
    if (game.plies.length < drawCool.current) { noteLater(`${bot.name} just said no. Try again in ${Math.max(1, Math.ceil((drawCool.current - game.plies.length) / 2))} moves.`); return; }
    setDrawBusy(true);
    let score = lastBotScore.current;
    try {
      const e = await analysisEngine(prefs.engine);
      const l = await e.lines(game.pos.toFen(), 1, 8, 400);
      if (l[0]) score = game.pos.turn === (mine ^ 1) ? l[0].score : -l[0].score; // from the bot's side
    } catch { /* use the last score */ }
    setDrawBusy(false);
    if (game.over) return;
    if (drawDecision(score, game.plies.length, bot.drawLove, bot.rating)) { say('drawAccepted'); game.finish('1/2-1/2', 'agreement'); setVer((v) => v + 1); finishCheck(); }
    else { drawCool.current = game.plies.length + 12; say('drawDeclined'); sys(game.plies.length < 24 ? `${bot.name} wants to play on a little longer.` : `${bot.name} declined the draw.`); }
  };
  const resign = () => { game.finish(mine === 0 ? '0-1' : '1-0', 'resign'); setConfirm(null); setVer((v) => v + 1); finishCheck(); };
  const toggleEval = (v: boolean) => { if (v && !evalOn && !game.over) setHints((h) => h + 1); setEvalOn(v); };

  const flipped = flip ? ((mine ^ 1) as 0 | 1) : mine;
  const sans = game.sanList();
  const mat = materialBalance(game.pos.board);
  const opening = openingName(sans);
  const reviewing = view !== null && view < game.plies.length;
  const lastBotLine = [...chat].reverse().find((l) => l.who === 'bot');
  const clockOf = (side: 0 | 1) => (tc.base ? clockText(clockRef.current[side]) : undefined);
  const clockLow = (side: 0 | 1) => !!tc.base && clockRef.current[side] < 10_000;
  const clockOn = (side: 0 | 1) => !game.over && !done && game.turn === side && game.plies.length >= 2;

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
            <span className="absolute left-0 right-0 text-center font-bold" data-testid="eval-num" style={{ fontSize: 10, [evalScore >= 0 === (flipped === 0) ? 'bottom' : 'top']: 2, color: evalScore >= 0 ? '#262522' : '#f2efe6' }}>{scoreText(evalScore)}</span>
          </div>
        )}
        <div className="flex-1 min-w-0">
          <PlayerBar name={bot.name} emoji={bot.emoji} color={bot.color + '33'} rating={String(bot.rating)} sub={thinking ? 'Thinking...' : captured(mine === 0 ? 1 : 0)} clock={clockOf((mine ^ 1) as 0 | 1)} active={clockOn((mine ^ 1) as 0 | 1)} low={clockLow((mine ^ 1) as 0 | 1)} />
          <ChessBoardView game={game} version={ver} orientation={flipped} myColor={mine} canMove={!thinking && game.turn === mine && !done} onUserMove={onUserMove} viewPly={view} prefs={prefs}
            hint={hint} fx={fx} onStopFx={stopFx} theme={prefs.showcaseTheme ? botTheme(bot.id) : undefined} celebrate={celebrate} fallSq={fallSq}>
            {done && (
              <div className="absolute inset-0 z-30 flex items-center justify-center p-3" style={{ background: 'rgba(10,12,16,.62)' }} data-testid="end-card">
                <div className="mg-card p-5 text-center w-full max-w-xs">
                  <div className="mg-h1 mb-1">{done.result === 'win' ? 'You won' : done.result === 'loss' ? 'You lost' : 'Draw'}</div>
                  <div className="text-sm mg-mute mb-2">{done.text.replace(/^You (won|lost) by /, 'By ').replace(/^Draw by /, 'By ')}</div>
                  {done.result === 'win' && <div className="mb-1"><Crowns n={done.crowns} size={28} /><div className="text-xs mg-mute mt-1" data-testid="crown-note">{done.crowns === 3 ? 'No hints or takebacks: 3 crowns.' : done.crowns > 0 ? 'Hints and takebacks cost you crowns.' : 'No crowns this time.'}</div></div>}
                  <div className="flex flex-col gap-2 mt-3">
                    <button className="mg-btn mg-btn-primary" onClick={() => onReview({ moves: game.uciList(), orientation: mine, title: `You vs ${bot.name}` })} data-testid="review-game">Review the game</button>
                    <button className="mg-btn" onClick={onNewBot} data-testid="play-again">Play another bot</button>
                  </div>
                </div>
              </div>
            )}
          </ChessBoardView>
          <PlayerBar name="You" self emoji="🙂" sub={captured(mine)} clock={clockOf(mine)} active={clockOn(mine)} low={clockLow(mine)} />
        </div>
      </div>

      <div className="space-y-3 min-w-0">
        {/* the bot, on top (the engine does not talk) */}
        {!isEngine && prefs.botChat && (
          <div className="rounded-xl overflow-hidden" style={{ background: '#262522', border: '1px solid #3a3835', color: '#fff' }} data-testid="bot-card">
            <div className="p-3 flex items-start gap-3">
              <div className="w-14 h-14 rounded-xl flex items-center justify-center text-4xl shrink-0" style={{ background: bot.color + '55' }}>{bot.emoji}</div>
              <div className="rounded-xl px-3 py-2 text-sm flex-1 min-w-0" style={{ background: '#3d3b37' }} data-testid="bot-bubble-live">
                <div className="font-semibold mb-0.5">{bot.name} <span style={{ color: '#a8a6a2', fontWeight: 400 }}>({bot.rating})</span></div>
                <div style={{ color: '#e8e6e3' }}>{thinking ? 'Hmm, let me think...' : lastBotLine?.text ?? 'Good luck!'}</div>
              </div>
            </div>
            {chat.length > 1 && <div className="px-3 pb-3"><BotChat lines={chat} emoji={bot.emoji} /></div>}
          </div>
        )}

        <div className="mg-card p-3">
          <div className="flex items-center justify-between mb-1"><span className="mg-h2" data-testid="opening-name">{opening ?? 'Moves'}</span>{reviewing && <button className="mg-btn mg-btn-sm" onClick={() => setView(null)}>Back to game</button>}</div>
          {opening && <div className="text-xs mg-mute mb-1">Opening</div>}
          <MoveList moves={sans} view={view ?? sans.length} onView={(p) => setView(p >= sans.length ? null : p)} />
        </div>

        {/* the buttons are at the bottom */}
        <div className="mg-card p-3 grid grid-cols-2 gap-2">
          <button className="mg-btn" disabled={!!done || thinking || game.turn !== mine} onClick={askHint} data-testid="hint-btn" title="Shows the best move. Counts against your crowns.">Hint {hints > 0 && <span className="mg-chip">{hints}</span>}</button>
          <button className="mg-btn" disabled={!!done || thinking || game.plies.length < (mine === 0 ? 2 : 1)} onClick={undo} data-testid="undo-btn" title="Takes back your last move. Counts against your crowns.">Take back {takebacks > 0 && <span className="mg-chip">{takebacks}</span>}</button>
          <button className="mg-btn" disabled={!!done || thinking || drawBusy} onClick={offerDraw} data-testid="draw-btn">Offer draw</button>
          <button className="mg-btn mg-btn-danger" disabled={!!done} onClick={() => setConfirm('resign')} data-testid="resign-btn">Resign</button>
          <button className="mg-btn" onClick={() => setFlip((f) => !f)} data-testid="flip-btn" style={{ gridColumn: 'span 2' }}>Flip board</button>
          {note && <div className="text-xs mg-mute col-span-2 text-center" data-testid="bot-note">{note}</div>}
        </div>
        <div className="mg-card p-3">
          <Toggle on={evalOn} onChange={toggleEval} label="Evaluation bar (counts as a hint)" testid="opt-eval" />
          {!isEngine && <Toggle on={prefs.botChat} onChange={(v) => onPrefs({ ...prefs, botChat: v })} label="Bot chat" testid="opt-botchat-live" />}
        </div>
        <div className="flex gap-2"><button className="mg-btn mg-btn-ghost" onClick={() => setConfirm('new')}>Choose another bot</button><button className="mg-btn mg-btn-ghost" onClick={onBack}>Back to games</button></div>
      </div>
      {confirm === 'resign' && <Confirm title="Resign this game?" body="You'll lose the game." yes="Resign" danger onYes={resign} onNo={() => setConfirm(null)} />}
      {confirm === 'new' && <Confirm title="Leave this game?" body={done ? undefined : "The game ends and counts as unfinished."} yes="Choose another bot" onYes={() => { setConfirm(null); onNewBot(); }} onNo={() => setConfirm(null)} />}
    </div>
  );
}
void Position; void moveFrom; void moveTo;
