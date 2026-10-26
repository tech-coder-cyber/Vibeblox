// Chess puzzles: find the best move. Your puzzle rating is separate from your game rating.
import { useEffect, useMemo, useRef, useState } from 'react';
import { Game, parseSq } from '../chess/rules';
import { PUZZLES, PuzzleRun, pickPuzzle, puzzleById, themeName, type Puzzle } from '../chess/puzzles';
import { applyPuzzle, ratingLabel } from '../ratings';
import { loadProgress, update, type Prefs } from '../store';
import * as api from '../api';
import ChessBoardView from './ChessBoardView';
import { useBoardFx } from './Board';
import { playSfx } from './sfx';

type Phase = 'play' | 'solved' | 'failed';

export default function PuzzlesView({ prefs, signedIn, onBack }: { prefs: Prefs; signedIn: boolean; onBack: () => void }) {
  const [progress, setProgress] = useState(loadProgress);
  const [puzzle, setPuzzle] = useState<Puzzle>(() => pickPuzzle(loadProgress().puzzle.r, loadProgress().solved));
  const [list, setList] = useState(false);
  const [nonce, setNonce] = useState(0);
  const rating = progress.puzzle;
  return list ? (
    <div data-testid="puzzle-list">
      <div className="flex items-center gap-2 mb-3"><h2 className="mg-h2 flex-1">All puzzles</h2><button className="mg-btn" onClick={() => setList(false)}>Back to the puzzle</button></div>
      <div className="grid grid-cols-5 sm:grid-cols-10 gap-2">
        {PUZZLES.map((p) => {
          const done = progress.solved.includes(p.id);
          return <button key={p.id} className="mg-btn" style={{ flexDirection: 'column', padding: '.4rem', background: done ? 'rgba(92,189,157,.18)' : undefined }} onClick={() => { setPuzzle(p); setList(false); }} data-testid={`pz-${p.id}`}>
            <b>{p.id}</b><span className="text-[10px] mg-mute">{p.rating}</span></button>;
        })}
      </div>
    </div>
  ) : (
    <PuzzleRunView key={puzzle.id + ':' + nonce} puzzle={puzzle} prefs={prefs} signedIn={signedIn}
      progress={progress} onDone={() => setProgress(loadProgress())} onNext={() => { const p = loadProgress(); setProgress(p); setPuzzle(pickPuzzle(p.puzzle.r, p.solved)); setNonce((n) => n + 1); }}
      onList={() => setList(true)} onBack={onBack} />
  );
}

function PuzzleRunView({ puzzle, prefs, signedIn, progress, onDone, onNext, onList, onBack }: { puzzle: Puzzle; prefs: Prefs; signedIn: boolean; progress: ReturnType<typeof loadProgress>; onDone: () => void; onNext: () => void; onList: () => void; onBack: () => void }) {
  const runRef = useRef(new PuzzleRun(puzzle));
  const run = runRef.current;
  const gameRef = useRef(new Game(puzzle.fen));
  const game = gameRef.current;
  const [ver, setVer] = useState(0);
  const [phase, setPhase] = useState<Phase>('play');
  const [hint, setHint] = useState<{ from: number; to?: number } | null>(null);
  const [note, setNote] = useState('');
  const [delta, setDelta] = useState<number | null>(null);
  const counted = useRef(false);
  const { fx } = useBoardFx({ allowSlam: false, sound: prefs.sound, enabled: false });
  const sq = (u: string) => ({ from: parseSq(u.slice(0, 2)), to: parseSq(u.slice(2, 4)) });

  const settle = (score: number) => {
    if (counted.current) return; counted.current = true;
    const before = loadProgress();
    const next = applyPuzzle(before.puzzle, puzzle.rating, score);
    const p = update((q) => {
      q.puzzle = next;
      if (score > 0) { if (!q.solved.includes(puzzle.id)) q.solved.push(puzzle.id); q.puzzleStreak++; q.bestStreak = Math.max(q.bestStreak, q.puzzleStreak); } else q.puzzleStreak = 0;
    });
    setDelta(next.r - before.puzzle.r);
    if (signedIn) void api.savePuzzle(p.puzzle.r, p.puzzle.n, p.solved);
    onDone();
  };

  const onUserMove = (uci: string) => {
    if (phase !== 'play') return;
    const r = run.attempt(uci);
    if (r === 'wrong') {
      playSfx('lose', prefs.sound); setHint(null); setPhase('failed'); setNote("That's not the move."); settle(0); return;
    }
    game.play(uci); setHint(null); setVer((v) => v + 1); playSfx('move', prefs.sound);
    if (r === 'solved') { setPhase('solved'); setNote(run.hints ? 'Solved with a hint.' : 'Solved!'); playSfx('win', prefs.sound); settle(run.score); return; }
    const reply = run.reply;
    if (reply) setTimeout(() => { game.play(reply); setVer((v) => v + 1); playSfx('move', prefs.sound); }, 450);
  };
  const askHint = () => { if (phase !== 'play') return; const h = run.hint(); setHint({ from: parseSq(h.from), to: h.to ? parseSq(h.to) : undefined }); };
  const showAnswer = () => { const m = run.puzzle.moves[run.step]; if (m) setHint(sq(m)); };
  useEffect(() => { void ver; }, [ver]);

  const sideText = useMemo(() => `${run.toMove === 0 ? 'White' : 'Black'} to move`, [run]);
  const streak = progress.puzzleStreak;
  const solvedCount = progress.solved.length;

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,640px)_1fr]" data-testid="puzzles">
      <div className="min-w-0">
        <ChessBoardView game={game} version={ver} orientation={run.toMove} myColor={run.toMove} canMove={phase === 'play'} onUserMove={onUserMove} viewPly={null} prefs={{ ...prefs, autoQueen: true }} hint={hint} fx={fx} />
      </div>
      <div className="space-y-3 min-w-0">
        <div className="mg-card p-4">
          <div className="flex items-center justify-between"><h2 className="mg-h2">Puzzle {puzzle.id}</h2><span className="mg-chip" data-testid="pz-rating-chip">{puzzle.rating}</span></div>
          <div className="text-sm mg-mute mt-1">{themeName(puzzle.themes[0])} · {sideText}</div>
          <div className="mt-3 text-sm" data-testid="pz-status">
            {phase === 'play' && 'Find the best move.'}
            {phase === 'solved' && <span style={{ color: 'var(--mg-good)' }}>{note}</span>}
            {phase === 'failed' && <span style={{ color: 'var(--mg-bad)' }}>{note} The answer is marked on the board.</span>}
          </div>
          {delta !== null && <div className="text-sm mt-1" data-testid="pz-delta">Puzzle rating {delta >= 0 ? '+' : ''}{delta}</div>}
          <div className="grid grid-cols-2 gap-2 mt-3">
            {phase === 'play' ? (
              <>
                <button className="mg-btn" onClick={askHint} data-testid="pz-hint">Hint{run.hints > 0 ? ` (${run.hints})` : ''}</button>
                <button className="mg-btn" onClick={() => { run.failed = true; setPhase('failed'); setNote('You gave up on this one.'); showAnswer(); settle(0); }} data-testid="pz-giveup">Show answer</button>
              </>
            ) : (
              <>
                {phase === 'failed' && <button className="mg-btn" onClick={showAnswer} data-testid="pz-show">Show the move</button>}
                <button className="mg-btn mg-btn-primary" style={phase === 'solved' ? { gridColumn: 'span 2' } : undefined} onClick={onNext} data-testid="pz-next">Next puzzle</button>
              </>
            )}
          </div>
        </div>
        <div className="mg-card p-4 text-sm space-y-1" data-testid="pz-stats">
          <div className="flex justify-between"><span className="mg-mute">Your puzzle rating</span><b>{progress.puzzle.r}{progress.puzzle.n < 10 ? '?' : ''}</b></div>
          <div className="flex justify-between"><span className="mg-mute">About the level of</span><span>{ratingLabel(progress.puzzle.r)}</span></div>
          <div className="flex justify-between"><span className="mg-mute">Solved</span><span>{solvedCount} of {PUZZLES.length}</span></div>
          <div className="flex justify-between"><span className="mg-mute">Streak (best {progress.bestStreak})</span><span>{streak}</span></div>
          <p className="text-xs mg-mute pt-1">This rating only changes when you solve puzzles. Using a hint counts as half a solve.</p>
        </div>
        <div className="flex gap-2"><button className="mg-btn mg-btn-ghost" onClick={onList} data-testid="pz-all">All puzzles</button><button className="mg-btn mg-btn-ghost" onClick={onBack}>Back to games</button></div>
      </div>
    </div>
  );
}
void puzzleById;
