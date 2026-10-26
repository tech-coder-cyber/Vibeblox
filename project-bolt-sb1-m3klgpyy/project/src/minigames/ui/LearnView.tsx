// Lessons (how pieces move, rules, ideas, tactics) and openings you can walk through and practise.
import { useEffect, useRef, useState } from 'react';
import { Game, START_FEN, parseSq } from '../chess/rules';
import { LESSONS, LESSON_GROUPS, type Lesson } from '../chess/lessons';
import { OPENINGS, type Opening } from '../chess/openings';
import { loadProgress, update, type Prefs } from '../store';
import ChessBoardView, { uciSquares } from './ChessBoardView';
import { useBoardFx } from './Board';
import { Seg } from './kit';
import { playSfx } from './sfx';

export default function LearnView({ prefs, onBack }: { prefs: Prefs; onBack: () => void }) {
  const [tab, setTab] = useState<'lessons' | 'openings'>('lessons');
  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [opening, setOpening] = useState<Opening | null>(null);
  const [done, setDone] = useState(() => loadProgress());
  const refresh = () => setDone(loadProgress());
  if (lesson) return <LessonView lesson={lesson} prefs={prefs} onClose={() => { setLesson(null); refresh(); }} onNext={(l) => setLesson(l)} />;
  if (opening) return <OpeningView opening={opening} prefs={prefs} onClose={() => { setOpening(null); refresh(); }} />;
  return (
    <div data-testid="learn">
      <div className="flex items-center gap-3 mb-4 flex-wrap"><h2 className="mg-h1 flex-1">Learn chess</h2>
        <Seg value={tab} onChange={setTab} options={[{ id: 'lessons', label: 'Lessons' }, { id: 'openings', label: 'Openings' }]} testid="learn-tabs" />
        <button className="mg-btn mg-btn-ghost" onClick={onBack}>Back to games</button></div>
      {tab === 'lessons' ? (
        <div className="space-y-6">
          {LESSON_GROUPS.map((g) => (
            <section key={g.id}>
              <h3 className="mg-h2">{g.title}</h3><p className="text-sm mg-mute mb-2">{g.blurb}</p>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {LESSONS.filter((l) => l.group === g.id).map((l) => (
                  <button key={l.id} className="mg-card p-3 text-left hover:brightness-110" onClick={() => setLesson(l)} data-testid={`lesson-${l.id}`}>
                    <div className="flex items-center justify-between"><b className="text-sm">{l.title}</b>{done.lessonsDone.includes(l.id) && <span style={{ color: 'var(--mg-good)' }} aria-label="Done">✓</span>}</div>
                    <div className="text-xs mg-mute mt-1 line-clamp-2">{l.text}</div>
                  </button>
                ))}
              </div>
            </section>
          ))}
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {OPENINGS.map((o) => (
            <button key={o.id} className="mg-card p-3 text-left hover:brightness-110" onClick={() => setOpening(o)} data-testid={`opening-${o.id}`}>
              <div className="flex items-center justify-between"><b>{o.name}</b>{done.openingsDone.includes(o.id) && <span style={{ color: 'var(--mg-good)' }}>✓</span>}</div>
              <div className="flex gap-1 my-1"><span className="mg-chip">For {o.side}</span><span className="mg-chip">{o.feel}</span></div>
              <div className="text-xs mg-mute">{o.idea}</div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function marksToColors(marks?: string[]): Record<number, string> {
  const out: Record<number, string> = {};
  for (const m of marks ?? []) out[parseSq(m)] = 'rgba(61,220,154,.5)';
  return out;
}

function LessonView({ lesson, prefs, onClose, onNext }: { lesson: Lesson; prefs: Prefs; onClose: () => void; onNext: (l: Lesson) => void }) {
  const gameRef = useRef(new Game(lesson.fen));
  const game = gameRef.current;
  const [ver, setVer] = useState(0);
  const [state, setState] = useState<'ask' | 'right' | 'wrong'>(lesson.task ? 'ask' : 'right');
  const { fx } = useBoardFx({ allowSlam: false, sound: prefs.sound, enabled: false });
  const idx = LESSONS.findIndex((l) => l.id === lesson.id);
  const next = LESSONS[idx + 1];
  useEffect(() => { if (!lesson.task) update((p) => { if (!p.lessonsDone.includes(lesson.id)) p.lessonsDone.push(lesson.id); }); }, [lesson]);
  const onUserMove = (u: string) => {
    if (!lesson.task || state === 'right') return;
    if (lesson.task.answers.includes(u)) {
      game.play(u); setVer((v) => v + 1); setState('right'); playSfx('win', prefs.sound);
      update((p) => { if (!p.lessonsDone.includes(lesson.id)) p.lessonsDone.push(lesson.id); });
    } else { setState('wrong'); playSfx('lose', prefs.sound); }
  };
  const reset = () => { gameRef.current = new Game(lesson.fen); setVer((v) => v + 1); setState('ask'); };
  const empty = game.pos.board.every((v) => !v);
  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,560px)_1fr]" data-testid="lesson">
      <div>
        <ChessBoardView game={game} version={ver} orientation={0} myColor={lesson.task ? game.turn : null} canMove={!!lesson.task && state !== 'right'} onUserMove={onUserMove} viewPly={null}
          prefs={{ ...prefs, autoQueen: true }} squareColors={marksToColors(lesson.marks)} fx={fx} />
      </div>
      <div className="mg-card p-4 h-fit space-y-3">
        <div className="mg-mute text-xs">{LESSON_GROUPS.find((g) => g.id === lesson.group)?.title}</div>
        <h2 className="mg-h1">{lesson.title}</h2>
        <p className="text-sm leading-relaxed">{lesson.text}</p>
        {lesson.task && (
          <div className="mg-card-flat p-3 text-sm" data-testid="lesson-task">
            <b>Your turn:</b> {lesson.task.prompt}
            {state === 'wrong' && <div className="mt-2" style={{ color: 'var(--mg-bad)' }} data-testid="lesson-wrong">{lesson.task.wrongHint ?? 'Not quite. Try again.'}</div>}
            {state === 'right' && <div className="mt-2" style={{ color: 'var(--mg-good)' }} data-testid="lesson-right">That's it! Well done.</div>}
          </div>
        )}
        <div className="flex gap-2 flex-wrap">
          {state === 'wrong' && <button className="mg-btn" onClick={reset}>Try again</button>}
          {state === 'right' && next && <button className="mg-btn mg-btn-primary" onClick={() => onNext(next)} data-testid="lesson-next">Next: {next.title}</button>}
          <button className="mg-btn mg-btn-ghost" onClick={onClose} data-testid="lesson-close">All lessons</button>
        </div>
        {empty && <div className="text-xs mg-mute">The board is empty here on purpose.</div>}
      </div>
    </div>
  );
}

function OpeningView({ opening, prefs, onClose }: { opening: Opening; prefs: Prefs; onClose: () => void }) {
  const moves = opening.line.split(' ');
  const [mode, setMode] = useState<'watch' | 'practice'>('watch');
  const [step, setStep] = useState(0);
  const [ver, setVer] = useState(0);
  const [msg, setMsg] = useState('');
  const gameRef = useRef(new Game(START_FEN));
  const game = gameRef.current;
  const { fx } = useBoardFx({ allowSlam: false, sound: prefs.sound, enabled: false });
  const mine = opening.side === 'white' ? 0 : 1;

  const build = (n: number) => { const g = new Game(START_FEN); for (let i = 0; i < n; i++) g.play(moves[i]); gameRef.current = g; };
  const go = (n: number) => { const c = Math.max(0, Math.min(moves.length, n)); build(c); setStep(c); setVer((v) => v + 1); setMsg(''); };
  const start = (m: 'watch' | 'practice') => { setMode(m); build(0); setStep(0); setVer((v) => v + 1); setMsg(''); if (m === 'practice' && mine === 1) setTimeout(() => go(1), 350); };

  const onUserMove = (u: string) => {
    if (mode !== 'practice' || step >= moves.length) return;
    const want = game.pos.parseSan(moves[step]);
    const wantUci = want ? game.pos.uci(want) : '';
    if (u !== wantUci) { setMsg(`Not the book move. Think about the idea: ${opening.idea}`); playSfx('lose', prefs.sound); return; }
    const n = step + 1; build(n); setStep(n); setVer((v) => v + 1); setMsg(''); playSfx('move', prefs.sound);
    if (n >= moves.length) { done(); return; }
    setTimeout(() => { const m2 = n + 1; build(m2); setStep(m2); setVer((v) => v + 1); if (m2 >= moves.length) done(); }, 450);
  };
  const done = () => { setMsg('You played the whole line. Nicely done!'); update((p) => { if (!p.openingsDone.includes(opening.id)) p.openingsDone.push(opening.id); }); };
  const note = opening.notes[step] ?? '';
  const last = step > 0 ? uciSquares(game.uciList()[step - 1]) : null;
  void last;

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,560px)_1fr]" data-testid="opening">
      <div>
        <ChessBoardView game={game} version={ver} orientation={mine as 0 | 1} myColor={mode === 'practice' && step < moves.length && game.turn === mine ? mine : null} canMove={mode === 'practice'} onUserMove={onUserMove} viewPly={null} prefs={{ ...prefs, autoQueen: true }} fx={fx} />
        <div className="flex gap-2 mt-3 items-center">
          <button className="mg-btn" onClick={() => go(0)} aria-label="Start">⏮</button><button className="mg-btn" onClick={() => go(step - 1)} disabled={mode === 'practice'} aria-label="Back">◀</button>
          <button className="mg-btn mg-btn-primary" onClick={() => go(step + 1)} disabled={mode === 'practice' || step >= moves.length} data-testid="op-next" aria-label="Next">▶</button>
          <span className="text-sm mg-mute ml-2">Move {step} of {moves.length}</span>
        </div>
      </div>
      <div className="mg-card p-4 h-fit space-y-3">
        <div className="flex items-center gap-2"><h2 className="mg-h1 flex-1">{opening.name}</h2><span className="mg-chip">For {opening.side}</span></div>
        <p className="text-sm">{opening.idea}</p>
        <Seg value={mode} onChange={start} options={[{ id: 'watch', label: 'Walk through' }, { id: 'practice', label: 'Practise it' }]} testid="op-mode" />
        <div className="mg-card-flat p-3 text-sm min-h-[3.5rem]" data-testid="op-note">{mode === 'practice' ? (msg || `Play the ${opening.side} moves of the ${opening.name}.`) : (note || (step === 0 ? 'Press ▶ to play through the first moves.' : ''))}</div>
        <div><div className="text-xs mg-mute mb-1">Plans</div><ul className="text-sm list-disc pl-5 space-y-0.5">{opening.plans.map((p) => <li key={p}>{p}</li>)}</ul></div>
        <button className="mg-btn mg-btn-ghost" onClick={onClose} data-testid="op-close">All openings</button>
      </div>
    </div>
  );
}
