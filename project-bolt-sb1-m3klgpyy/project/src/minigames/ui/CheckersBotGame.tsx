// Playing checkers against a bot, with hints, takebacks, draw offers, resignation and bot chat.
import { useCallback, useEffect, useRef, useState } from 'react';
import { CheckersGame, RED, numToSq, type Move, type Side } from '../checkers/rules';
import { CHECKERS_BOTS, checkersBot, type CheckersBot } from '../checkers/bots';
import { engine } from '../engineClient';
import { botSays, type ChatEvent } from '../botCore';
import { crownsFor, bestCrowns } from '../ratings';
import { addHistory, update, loadProgress, type Prefs, type HistoryEntry } from '../store';
import CheckersBoardView from './CheckersBoardView';
import { useBoardFx } from './Board';
import { BotPicker, BotChat, Confirm, Crowns, MoveList, PlayerBar, Toggle, type ChatLine } from './kit';
import { playSfx } from './sfx';
import type { ReviewRequest } from './ChessBotGame';

const END_TEXT: Record<string, string> = { 'no-moves': 'no moves left', resign: 'resignation', agreed: 'agreement', repetition: 'repetition', 'forty-move': 'no progress', timeout: 'time', abandoned: 'leaving' };
export type CheckersReview = Omit<ReviewRequest, 'startFen'> & { kind: 'checkers' };

export default function CheckersBotGame({ rank, prefs, onPrefs, onReview, onBack }: { rank: string; prefs: Prefs; onPrefs: (p: Prefs) => void; onReview: (r: CheckersReview) => void; onBack: () => void }) {
  const [bot, setBot] = useState<CheckersBot | null>(null);
  const [color, setColor] = useState<'red' | 'white' | 'random'>('red');
  const [started, setStarted] = useState(false);
  const progress = loadProgress();
  if (!started || !bot) {
    return (
      <div data-testid="ck-setup" className="grid gap-5 lg:grid-cols-[1fr_300px]">
        <div>
          <h2 className="mg-h2 mb-1">Choose who to play</h2>
          <p className="text-sm mg-mute mb-3">Each bot plays in its own way. Jumps are required, as in real checkers. Practice games never change your rating.</p>
          <BotPicker bots={CHECKERS_BOTS} rank={rank} crowns={progress.crowns} picked={bot?.id ?? null} onPick={setBot} />
        </div>
        <div className="mg-card p-4 h-fit space-y-3">
          {bot ? (
            <>
              <div className="flex items-center gap-3"><div className="text-3xl">{bot.emoji}</div><div><div className="font-semibold">{bot.name} <span className="mg-chip">{bot.rating}</span></div><div className="text-xs mg-mute">{bot.plays}</div></div></div>
              <div><div className="text-xs mg-mute mb-1">You play (Red moves first)</div>
                <div className="mg-seg" role="group">{(['red', 'white', 'random'] as const).map((c) => <button key={c} aria-pressed={color === c} onClick={() => setColor(c)} data-testid={`ck-color-${c}`}>{c[0].toUpperCase() + c.slice(1)}</button>)}</div></div>
              <Toggle on={prefs.botChat} onChange={(v) => onPrefs({ ...prefs, botChat: v })} label="Show what the bot says" testid="opt-botchat" />
              <button className="mg-btn mg-btn-primary w-full" onClick={() => setStarted(true)} data-testid="start-ck-game">Play {bot.name}</button>
            </>
          ) : <p className="text-sm mg-mute">Pick a bot on the left to begin.</p>}
          <button className="mg-btn mg-btn-ghost w-full" onClick={onBack}>Back</button>
        </div>
      </div>
    );
  }
  return <Playing key={bot.id + color} bot={bot} colorChoice={color} prefs={prefs} onPrefs={onPrefs} onReview={onReview} onNewBot={() => setStarted(false)} onBack={onBack} />;
}

function Playing({ bot, colorChoice, prefs, onPrefs, onReview, onNewBot, onBack }: { bot: CheckersBot; colorChoice: 'red' | 'white' | 'random'; prefs: Prefs; onPrefs: (p: Prefs) => void; onReview: (r: CheckersReview) => void; onNewBot: () => void; onBack: () => void }) {
  const gameRef = useRef(new CheckersGame());
  const game = gameRef.current;
  const [ver, setVer] = useState(0);
  const [mine] = useState<Side>(() => (colorChoice === 'red' ? 0 : colorChoice === 'white' ? 1 : Math.random() < 0.5 ? 0 : 1));
  const [flip, setFlip] = useState(false);
  const [thinking, setThinking] = useState(false);
  const [view, setView] = useState<number | null>(null);
  const [hints, setHints] = useState(0), [takebacks, setTakebacks] = useState(0);
  const [hint, setHint] = useState<{ from: number; to: number } | null>(null);
  const [chat, setChat] = useState<ChatLine[]>([]);
  const [confirm, setConfirm] = useState<null | 'resign' | 'new'>(null);
  const [done, setDone] = useState<null | { crowns: number; result: 'win' | 'draw' | 'loss'; text: string }>(null);
  const chatId = useRef(0), savedRef = useRef(false), botTurnRef = useRef(false), aliveRef = useRef(true);
  const { fx, trigger } = useBoardFx({ allowSlam: false, sound: prefs.sound, soundTheme: prefs.soundTheme });

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
    const entry: HistoryEntry = { id: `c${Date.now()}`, game: 'checkers', mode: 'bot', opp: bot.name, oppId: bot.id, oppRating: bot.rating, color: mine, result: res, reason: END_TEXT[game.reason] ?? game.reason, moves: game.sanList(), at: Date.now(), crowns, hints, takebacks };
    addHistory(entry);
    if (res === 'win') update((p) => { p.crowns[bot.id] = bestCrowns(p.crowns[bot.id], crowns); });
    say(res === 'win' ? 'lose' : res === 'loss' ? 'win' : 'draw');
    playSfx(res === 'win' ? 'win' : res === 'loss' ? 'lose' : 'end', prefs.sound, prefs.soundTheme);
    setDone({ crowns, result: res, text: END_TEXT[game.reason] ?? game.reason });
  }, [game, mine, hints, takebacks, bot, say, prefs.sound]);

  const afterMove = useCallback((byBot: boolean, captured: boolean) => {
    setHint(null); setVer((v) => v + 1); setView(null);
    playSfx(captured ? 'capture' : 'move', prefs.sound, prefs.soundTheme);
    if (!game.over) { if (byBot && captured && Math.random() < 0.5) say('capture'); else if (!byBot && captured && Math.random() < 0.4) say('lostPiece'); }
    finishCheck();
  }, [game, prefs.sound, say, finishCheck]);
  const afterMoveRef = useRef(afterMove); afterMoveRef.current = afterMove;

  useEffect(() => { aliveRef.current = true; return () => { aliveRef.current = false; botTurnRef.current = false; }; }, []);
  useEffect(() => {
    if (game.over || game.pos.turn === mine || botTurnRef.current) return;
    botTurnRef.current = true; setThinking(true);
    const started = Date.now();
    void (async () => {
      let text: string | null = null;
      try { text = (await engine.checkersBot(bot.id, game.sanList())).text; } catch { /* below */ }
      const wait = Math.max(0, 450 + Math.random() * 450 - (Date.now() - started));
      await new Promise((r) => setTimeout(r, wait));
      botTurnRef.current = false;
      if (!aliveRef.current) return;
      setThinking(false);
      if (!text) { const ms = game.pos.moves(); if (ms.length) text = game.pos.notation(ms[0]); }
      if (!text) return;
      const cap = text.includes('x');
      game.play(text);
      afterMoveRef.current(true, cap);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ver]);

  const onUserMove = (m: Move) => {
    if (game.over || thinking || game.pos.turn !== mine) return;
    const cap = m.caps.length > 0;
    if (!game.play(m)) return;
    afterMove(false, cap);
  };
  const askHint = async () => {
    if (game.over || thinking || game.pos.turn !== mine) return;
    setHints((h) => h + 1); say('hint');
    try {
      const r = await engine.checkersHint(game.sanList(), 9, 900);
      const mv = game.pos.moves().find((x) => game.pos.notation(x) === r.text);
      if (mv) setHint({ from: mv.from, to: mv.to });
    } catch { sys('The hint engine did not answer. Try again.'); }
  };
  const undo = () => {
    if (game.over || thinking || !game.moves.length) return;
    const n = game.pos.turn === mine ? (game.moves.length >= 2 ? 2 : 0) : 1;
    if (!n) return;
    for (let i = 0; i < n; i++) game.undo();
    setTakebacks((t) => t + 1); say('takeback'); setHint(null); setVer((v) => v + 1); setView(null);
  };
  const offerDraw = () => {
    if (game.over || thinking) return;
    const even = Math.abs(game.pos.board.reduce((a, v) => a + (v > 0 ? (v === 2 ? 1.6 : 1) : v < 0 ? -(v === -2 ? 1.6 : 1) : 0), 0)) < 1.5;
    if (game.moves.length >= 24 && even && Math.random() < 0.3 + bot.drawLove * 0.5) { say('drawAccepted'); game.finish('1/2-1/2', 'agreed'); setVer((v) => v + 1); finishCheck(); }
    else { say('drawDeclined'); sys(`${bot.name} declined the draw.`); }
  };
  const resign = () => { game.finish(mine === 0 ? '0-1' : '1-0', 'resign'); setConfirm(null); setVer((v) => v + 1); finishCheck(); };

  const sans = game.sanList();
  const flipped = (flip ? mine ^ 1 : mine) as 0 | 1;
  const reviewing = view !== null && view < sans.length;
  const count = (s: Side) => game.pos.board.reduce((a, v) => a + ((v > 0 ? 0 : v < 0 ? 1 : -1) === s ? 1 : 0), 0);

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,640px)_1fr]" data-testid="ck-game">
      <div className="min-w-0">
        <PlayerBar name={bot.name} emoji={bot.emoji} color={bot.color + '33'} rating={String(bot.rating)} sub={thinking ? 'Thinking...' : `${count((mine ^ 1) as Side)} pieces`} />
        <CheckersBoardView game={game} version={ver} orientation={flipped} myColor={mine} canMove={!thinking && !done} onUserMove={onUserMove} viewPly={view} prefs={prefs} hint={hint} fx={fx}>
          {done && (
            <div className="absolute inset-0 z-30 flex items-center justify-center p-3" style={{ background: 'rgba(10,12,16,.62)' }} data-testid="end-card">
              <div className="mg-card p-5 text-center w-full max-w-xs">
                <div className="mg-h1 mb-1">{done.result === 'win' ? 'You won' : done.result === 'loss' ? 'You lost' : 'Draw'}</div>
                <div className="text-sm mg-mute mb-2">By {done.text}</div>
                {done.result === 'win' && <div className="mb-1"><Crowns n={done.crowns} size={28} /><div className="text-xs mg-mute mt-1" data-testid="crown-note">{done.crowns === 3 ? 'No hints or takebacks: 3 crowns.' : done.crowns === 2 ? 'Won with one hint or takeback: 2 crowns.' : 'Won with several hints or takebacks: 1 crown.'}</div></div>}
                <div className="flex flex-col gap-2 mt-3">
                  <button className="mg-btn mg-btn-primary" onClick={() => onReview({ kind: 'checkers', moves: sans, orientation: mine, title: `You vs ${bot.name}` })} data-testid="review-game">Look back at the game</button>
                  <button className="mg-btn" onClick={onNewBot} data-testid="play-again">Play another bot</button>
                </div>
              </div>
            </div>
          )}
        </CheckersBoardView>
        <PlayerBar name="You" self emoji="🙂" sub={`${count(mine)} pieces`} />
      </div>
      <div className="space-y-3 min-w-0">
        <div className="mg-card p-3">
          <div className="flex items-center justify-between mb-1"><span className="mg-h2">Moves</span>{reviewing && <button className="mg-btn mg-btn-sm" onClick={() => setView(null)}>Back to game</button>}</div>
          <MoveList moves={sans} view={view ?? sans.length} onView={(p) => setView(p >= sans.length ? null : p)} />
        </div>
        <div className="mg-card p-3 grid grid-cols-2 gap-2">
          <button className="mg-btn" disabled={!!done || thinking || game.pos.turn !== mine} onClick={askHint} data-testid="hint-btn">Hint {hints > 0 && <span className="mg-chip">{hints}</span>}</button>
          <button className="mg-btn" disabled={!!done || thinking || game.moves.length < (mine === RED ? 2 : 2)} onClick={undo} data-testid="undo-btn">Take back {takebacks > 0 && <span className="mg-chip">{takebacks}</span>}</button>
          <button className="mg-btn" disabled={!!done || thinking} onClick={offerDraw} data-testid="draw-btn">Offer draw</button>
          <button className="mg-btn mg-btn-danger" disabled={!!done} onClick={() => setConfirm('resign')} data-testid="resign-btn">Resign</button>
          <button className="mg-btn" onClick={() => setFlip((f) => !f)}>Flip board</button>
          <button className="mg-btn" onClick={() => trigger('throw')} title="Press T">Throw pieces (T)</button>
        </div>
        {prefs.botChat && (
          <div className="mg-card p-3">
            <div className="flex items-center justify-between"><div className="mg-h2 mb-1">{bot.emoji} {bot.name}</div><Toggle on={prefs.botChat} onChange={(v) => onPrefs({ ...prefs, botChat: v })} label="Bot chat" /></div>
            <BotChat lines={chat} emoji={bot.emoji} />
            <div className="text-xs mg-mute mt-2">Bots can talk, but you can't talk back.</div>
          </div>
        )}
        <div className="flex gap-2"><button className="mg-btn mg-btn-ghost" onClick={() => setConfirm('new')}>Choose another bot</button><button className="mg-btn mg-btn-ghost" onClick={onBack}>Back to games</button></div>
      </div>
      {confirm === 'resign' && <Confirm title="Resign this game?" body="You'll lose the game." yes="Resign" danger onYes={resign} onNo={() => setConfirm(null)} />}
      {confirm === 'new' && <Confirm title="Leave this game?" body={done ? undefined : 'The game ends and counts as unfinished.'} yes="Choose another bot" onYes={() => { setConfirm(null); onNewBot(); }} onNo={() => setConfirm(null)} />}
    </div>
  );
}
void numToSq;
