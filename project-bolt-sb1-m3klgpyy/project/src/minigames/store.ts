// What the minigames remember on this device: settings, your rating while signed out, puzzle progress, crowns, history, bests.
import { newRating, newPuzzleRating, type RatingState, type PuzzleRating } from './ratings';

export type BoardTheme = 'green' | 'brown' | 'blue' | 'slate' | 'rose' | 'night' | 'grass' | 'candy';
export type PieceSet = 'classic' | 'flat' | 'outline' | 'glass' | 'blocks' | 'letters';
export const BOARD_THEMES: Record<BoardTheme, { name: string; light: string; dark: string; accent: string }> = {
  green: { name: 'Green', light: '#eeeed2', dark: '#769656', accent: '#f6f669' },
  brown: { name: 'Walnut', light: '#f0d9b5', dark: '#b58863', accent: '#f7ec59' },
  blue: { name: 'Ocean', light: '#dee3e6', dark: '#8ca2ad', accent: '#7fc8f8' },
  slate: { name: 'Slate', light: '#c9ced6', dark: '#5f6b7a', accent: '#ffd166' },
  rose: { name: 'Rose', light: '#f7e3e1', dark: '#c97b84', accent: '#ffe08a' },
  night: { name: 'Night', light: '#4b5568', dark: '#2a3140', accent: '#f4c95d' },
  grass: { name: 'Meadow', light: '#e9f0c8', dark: '#6aa36a', accent: '#fff176' },
  candy: { name: 'Candy', light: '#fff1f7', dark: '#b794f4', accent: '#fbd38d' },
};
export const PIECE_SETS: Record<PieceSet, string> = { classic: 'Classic', flat: 'Flat', outline: 'Outline', glass: 'Glass', blocks: 'Blocks', letters: 'Letters' };

export type Prefs = {
  boardTheme: BoardTheme; pieceSet: PieceSet; coords: boolean; sound: boolean; botChat: boolean;
  legalDots: boolean; autoQueen: boolean; highlightLast: boolean; engine: 'builtin' | 'stockfish'; animate: boolean; showEval: boolean;
};
export const DEFAULT_PREFS: Prefs = { boardTheme: 'green', pieceSet: 'classic', coords: true, sound: true, botChat: true, legalDots: true, autoQueen: true, highlightLast: true, engine: 'builtin', animate: true, showEval: false };

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
};
export const newProgress = (): Progress => ({
  chessRating: newRating(), checkersRating: newRating(), puzzle: newPuzzleRating(), solved: [], puzzleStreak: 0, bestStreak: 0,
  crowns: {}, best2048: 0, ttt: { easy: [0, 0, 0], normal: [0, 0, 0], hard: [0, 0, 0] }, history: [], lessonsDone: [], openingsDone: [],
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
  for (const k of ['coords', 'sound', 'botChat', 'legalDots', 'autoQueen', 'highlightLast', 'animate', 'showEval'] as const) if (typeof p[k] === 'boolean') out[k] = p[k] as boolean;
  if (p.engine === 'builtin' || p.engine === 'stockfish') out.engine = p.engine;
  return out;
}
export function savePrefs(p: Prefs) { write(PREF_KEY, p); }

export function loadProgress(): Progress {
  const p = read<Partial<Progress>>(PROG_KEY) ?? {};
  const d = newProgress();
  return {
    ...d, ...p,
    chessRating: { ...d.chessRating, ...(p.chessRating ?? {}) }, checkersRating: { ...d.checkersRating, ...(p.checkersRating ?? {}) },
    puzzle: { ...d.puzzle, ...(p.puzzle ?? {}) }, ttt: { ...d.ttt, ...(p.ttt ?? {}) },
    solved: Array.isArray(p.solved) ? p.solved : [], crowns: p.crowns && typeof p.crowns === 'object' ? p.crowns : {},
    history: Array.isArray(p.history) ? p.history.slice(0, 150) : [], lessonsDone: Array.isArray(p.lessonsDone) ? p.lessonsDone : [], openingsDone: Array.isArray(p.openingsDone) ? p.openingsDone : [],
  };
}
export function saveProgress(p: Progress) { write(PROG_KEY, { ...p, history: p.history.slice(0, 150), solved: p.solved.slice(-300) }); }
export function update(fn: (p: Progress) => void): Progress { const p = loadProgress(); fn(p); saveProgress(p); return p; }
export function addHistory(e: HistoryEntry): Progress { return update((p) => { p.history = [e, ...p.history.filter((x) => x.id !== e.id)].slice(0, 150); }); }
