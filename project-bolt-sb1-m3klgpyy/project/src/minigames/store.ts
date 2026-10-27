// What the minigames remember on this device: settings, your rating while signed out, puzzle progress, crowns, history, bests.
import { newRating, newPuzzleRating, type RatingState, type PuzzleRating } from './ratings';

export type BoardTheme = 'green' | 'brown' | 'blue' | 'slate' | 'rose' | 'night' | 'grass' | 'candy' | 'sand' | 'ice' | 'vibeblox';
export type PieceSet = 'classic' | 'neo' | 'cartoon' | 'flat' | 'outline' | 'glass' | 'blocks' | 'letters' | 'vibeblox';
export const BOARD_THEMES: Record<BoardTheme, { name: string; light: string; dark: string; accent: string; texture?: 'vibeblox' }> = {
  green: { name: 'Green', light: '#eeeed2', dark: '#769656', accent: '#f6f669' },
  brown: { name: 'Walnut', light: '#f0d9b5', dark: '#b58863', accent: '#f7ec59' },
  blue: { name: 'Ocean', light: '#dee3e6', dark: '#8ca2ad', accent: '#7fc8f8' },
  slate: { name: 'Slate', light: '#c9ced6', dark: '#5f6b7a', accent: '#ffd166' },
  rose: { name: 'Rose', light: '#f7e3e1', dark: '#c97b84', accent: '#ffe08a' },
  night: { name: 'Night', light: '#4b5568', dark: '#2a3140', accent: '#f4c95d' },
  grass: { name: 'Meadow', light: '#e9f0c8', dark: '#6aa36a', accent: '#fff176' },
  candy: { name: 'Candy', light: '#fff1f7', dark: '#b794f4', accent: '#fbd38d' },
  sand: { name: 'Sand', light: '#efe3c6', dark: '#c4a574', accent: '#f4e27a' },
  ice: { name: 'Ice', light: '#e8f1f8', dark: '#7da3c6', accent: '#8fe3ff' },
  vibeblox: { name: 'VibeBlox', light: '#d9b87c', dark: '#5fa34a', accent: '#ffe066', texture: 'vibeblox' },
};
export const PIECE_SETS: Record<PieceSet, string> = { classic: 'Classic', neo: 'Neo', cartoon: '3D Cartoon', flat: 'Flat', outline: 'Outline', glass: 'Glass', blocks: 'Pixel', letters: 'Letters', vibeblox: 'VibeBlox' };

export type AnimSpeed = 'slow' | 'medium' | 'fast' | 'natural' | 'arcade' | 'dynamic';
export const ANIM_SPEEDS: Record<AnimSpeed, { name: string; ms: number; ease: string; trail?: boolean }> = {
  slow: { name: 'Slow', ms: 480, ease: 'ease-in-out' }, medium: { name: 'Medium (default)', ms: 260, ease: 'ease-out' }, fast: { name: 'Fast', ms: 140, ease: 'ease-out' },
  natural: { name: 'Natural', ms: 340, ease: 'cubic-bezier(.3,.7,.35,1)' }, arcade: { name: 'Arcade', ms: 380, ease: 'cubic-bezier(.34,1.56,.64,1)' }, dynamic: { name: 'Dynamic', ms: 300, ease: 'cubic-bezier(.16,.85,.25,1)', trail: true },
};
export type MoveInput = 'both' | 'click' | 'drag';
export type SoundTheme = 'default' | 'wood' | 'bubble' | 'retro' | 'blocks';
export const SOUND_THEMES: Record<SoundTheme, string> = { default: 'Default', wood: 'Wood', bubble: 'Bubble', retro: 'Retro', blocks: 'Blocks' };
export type Celebration = 'none' | 'confetti' | 'stars' | 'cubes' | 'fireworks';
export const CELEBRATIONS: Record<Celebration, string> = { none: 'None', confetti: 'Confetti', stars: 'Stars', cubes: 'Falling blocks', fireworks: 'Fireworks' };

export type Prefs = {
  boardTheme: BoardTheme; pieceSet: PieceSet; coords: boolean; sound: boolean; botChat: boolean;
  legalDots: boolean; autoQueen: boolean; highlightLast: boolean; engine: 'builtin' | 'stockfish'; animate: boolean; showEval: boolean;
  /** queue a move while it is the other side's turn */ premoves: boolean;
  /** how pieces are moved: click, drag, or both */ moveInput: MoveInput;
  animSpeed: AnimSpeed; soundTheme: SoundTheme;
  /** show the opponent's theme in new-game animations and previews */ showcaseTheme: boolean;
  /** bots and events may use their own board look */ specialThemes: boolean;
  /** an animation on the board when a game ends */ resultAnims: boolean;
  celebration: Celebration;
};
export const DEFAULT_PREFS: Prefs = {
  boardTheme: 'green', pieceSet: 'classic', coords: true, sound: true, botChat: true, legalDots: true, autoQueen: true, highlightLast: true, engine: 'stockfish', animate: true, showEval: false,
  premoves: true, moveInput: 'both', animSpeed: 'medium', soundTheme: 'default', showcaseTheme: true, specialThemes: true, resultAnims: true, celebration: 'confetti',
};

export type HistoryEntry = {
  id: string; game: 'chess' | 'checkers'; mode: 'bot' | 'online' | 'local'; opp: string; oppId?: string; oppRating?: number;
  color: 0 | 1; result: 'win' | 'draw' | 'loss'; reason: string; moves: string[]; startFen?: string; at: number;
  crowns?: number; hints?: number; takebacks?: number; accuracy?: number; ratingDelta?: number; serverId?: string;
  /** server-measured think time per move (ms), when known */ times?: number[];
};
export type TttRecord = { easy: [number, number, number]; normal: [number, number, number]; hard: [number, number, number] };
export type Progress = {
  chessRating: RatingState; checkersRating: RatingState; puzzle: PuzzleRating; solved: number[]; puzzleStreak: number; bestStreak: number;
  crowns: Record<string, number>; best2048: number; ttt: TttRecord; history: HistoryEntry[];
  lessonsDone: string[]; openingsDone: string[];
  /** game reviews started today: the day (YYYY-MM-DD) and a short key for every game reviewed */ reviews: { day: string; keys: string[] };
};
export const newProgress = (): Progress => ({
  chessRating: newRating(), checkersRating: newRating(), puzzle: newPuzzleRating(), solved: [], puzzleStreak: 0, bestStreak: 0,
  crowns: {}, best2048: 0, ttt: { easy: [0, 0, 0], normal: [0, 0, 0], hard: [0, 0, 0] }, history: [], lessonsDone: [], openingsDone: [], reviews: { day: '', keys: [] },
});

export interface KV { getItem(k: string): string | null; setItem(k: string, v: string): void }
const mem = new Map<string, string>();
const fallback: KV = { getItem: (k) => mem.get(k) ?? null, setItem: (k, v) => { mem.set(k, v); } };
let kv: KV | null = null;
function store(): KV { if (kv) return kv; try { localStorage.setItem('vb-mg-test', '1'); localStorage.removeItem('vb-mg-test'); kv = localStorage; } catch { kv = fallback; } return kv; }
export function useStorage(s: KV | null) { kv = s; }

const PREF_KEY = 'vb-mg-prefs', PROG_KEY = 'vb-mg-progress';
function read<T>(key: string): T | null { try { const v = store().getItem(key); return v ? (JSON.parse(v) as T) : null; } catch { return null; } }
function write(key: string, v: unknown) { try { store().setItem(key, JSON.stringify(v)); } catch { /* storage full or blocked */ } }

export function loadPrefs(): Prefs {
  const p = read<Partial<Prefs>>(PREF_KEY) ?? {};
  const out = { ...DEFAULT_PREFS };
  if (p.boardTheme && p.boardTheme in BOARD_THEMES) out.boardTheme = p.boardTheme;
  if (p.pieceSet && p.pieceSet in PIECE_SETS) out.pieceSet = p.pieceSet;
  for (const k of ['coords', 'sound', 'botChat', 'legalDots', 'autoQueen', 'highlightLast', 'animate', 'showEval', 'premoves', 'showcaseTheme', 'specialThemes', 'resultAnims'] as const) if (typeof p[k] === 'boolean') out[k] = p[k] as boolean;
  if (p.engine === 'builtin' || p.engine === 'stockfish') out.engine = p.engine;
  if (p.moveInput === 'both' || p.moveInput === 'click' || p.moveInput === 'drag') out.moveInput = p.moveInput;
  if (p.animSpeed && p.animSpeed in ANIM_SPEEDS) out.animSpeed = p.animSpeed;
  if (p.soundTheme && p.soundTheme in SOUND_THEMES) out.soundTheme = p.soundTheme;
  if (p.celebration && p.celebration in CELEBRATIONS) out.celebration = p.celebration;
  // before Indev 37.1 the default engine was the built-in one: move people over to Stockfish unless they picked it themselves
  if (!(p as { v?: number }).v && p.engine === 'builtin') out.engine = 'stockfish';
  return out;
}
export function savePrefs(p: Prefs) { write(PREF_KEY, { ...p, v: 2 }); }

export function loadProgress(): Progress {
  const p = read<Partial<Progress>>(PROG_KEY) ?? {};
  const d = newProgress();
  return {
    ...d, ...p,
    chessRating: { ...d.chessRating, ...(p.chessRating ?? {}) }, checkersRating: { ...d.checkersRating, ...(p.checkersRating ?? {}) },
    puzzle: { ...d.puzzle, ...(p.puzzle ?? {}) }, ttt: { ...d.ttt, ...(p.ttt ?? {}) },
    solved: Array.isArray(p.solved) ? p.solved : [], crowns: p.crowns && typeof p.crowns === 'object' ? p.crowns : {},
    reviews: p.reviews && typeof p.reviews === 'object' && Array.isArray((p.reviews as { keys?: unknown }).keys) ? (p.reviews as Progress['reviews']) : d.reviews,
    history: Array.isArray(p.history) ? p.history.slice(0, 150) : [], lessonsDone: Array.isArray(p.lessonsDone) ? p.lessonsDone : [], openingsDone: Array.isArray(p.openingsDone) ? p.openingsDone : [],
  };
}
export function saveProgress(p: Progress) { write(PROG_KEY, { ...p, history: p.history.slice(0, 150), solved: p.solved.slice(-300) }); }
export function update(fn: (p: Progress) => void): Progress { const p = loadProgress(); fn(p); saveProgress(p); return p; }
export function addHistory(e: HistoryEntry): Progress { return update((p) => { p.history = [e, ...p.history.filter((x) => x.id !== e.id)].slice(0, 150); }); }

// ---------- game reviews per day ----------
/** Reviews of finished games per day by rank: Everyone 3, Vanguard 10, Elite and Champion no limit. */
export const REVIEW_LIMITS: Record<string, number> = { none: 3, vanguard: 10, elite: Infinity, champion: Infinity };
export const reviewLimit = (rank: string | null | undefined): number => REVIEW_LIMITS[rank ?? 'none'] ?? REVIEW_LIMITS.none;
const dayKey = (now = Date.now()) => { const d = new Date(now); return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`; };
export const reviewKey = (moves: string[], startFen?: string): string => { let h = 2166136261; for (const c of (startFen ?? '') + moves.join(' ')) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619) >>> 0; } return h.toString(36) + ':' + moves.length; };
/** How many new reviews are left today (Infinity for no limit). Reviewing a game you already reviewed today is free. */
export function reviewsLeft(rank: string | null | undefined, now = Date.now()): number {
  const lim = reviewLimit(rank); if (lim === Infinity) return Infinity;
  const r = loadProgress().reviews;
  return Math.max(0, lim - (r.day === dayKey(now) ? r.keys.length : 0));
}
/** Start a review: true if it may go ahead (and counts it), false when today's limit is used up. */
export function useReview(rank: string | null | undefined, key: string, now = Date.now()): boolean {
  const lim = reviewLimit(rank);
  const p = loadProgress();
  const today = dayKey(now);
  const keys = p.reviews.day === today ? p.reviews.keys : [];
  if (keys.includes(key)) return true;
  if (lim !== Infinity && keys.length >= lim) return false;
  if (lim !== Infinity) { p.reviews = { day: today, keys: [...keys, key] }; saveProgress(p); }
  return true;
}
