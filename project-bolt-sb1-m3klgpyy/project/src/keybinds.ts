// ---------------------------------------------------------------------------
//  Rebindable keys (Settings > Controls). The engine reads the bindings from
//  voxelGame.ts; this file remembers them and tells the engine about changes.
// ---------------------------------------------------------------------------
import { useSyncExternalStore } from 'react';
import { DEFAULT_KEYBINDS, setKeybinds, type KeyAction } from './voxelGame';

export const KEY_ACTIONS: KeyAction[] = ['forward', 'back', 'left', 'right', 'jump', 'sprint', 'crouch', 'inventory', 'drop', 'offhand', 'zoom', 'pause'];

/** Keys with a fixed job (menu, chat, hotbar, advancements, debug, player list): they can't be given to an action. */
export function isReservedKey(code: string): boolean {
  return code === 'Escape' || code === 'Enter' || code === 'NumpadEnter' || code === 'Tab' || code === 'KeyT' || code === 'KeyL' || code === 'KeyG' || code === 'Slash'
    || /^F\d{1,2}$/.test(code) || /^Digit[0-9]$/.test(code) || code.startsWith('Meta') || code === 'ContextMenu' || code === 'CapsLock';
}

const KEYS_STORE = 'vb-keys';
function load(): Record<KeyAction, string> {
  const out = { ...DEFAULT_KEYBINDS };
  try {
    const raw = JSON.parse(localStorage.getItem(KEYS_STORE) ?? '{}') as Record<string, unknown>;
    for (const a of KEY_ACTIONS) {
      const v = raw[a];
      if (typeof v === 'string' && v && !isReservedKey(v)) out[a] = v;
    }
  } catch { /* storage blocked or damaged: defaults */ }
  // The same key on two actions would make one of them dead: fall back to the defaults if that ever happens
  if (new Set(Object.values(out)).size !== KEY_ACTIONS.length) return { ...DEFAULT_KEYBINDS };
  return out;
}

let current = load();
setKeybinds(current);
const listeners = new Set<() => void>();
function commit(next: Record<KeyAction, string>) {
  current = next;
  setKeybinds(next);
  try { localStorage.setItem(KEYS_STORE, JSON.stringify(next)); } catch { /* storage blocked */ }
  for (const l of listeners) l();
}

/** True while the Controls screen is waiting for a key: the game's own Esc handling must stay out of the way. */
let capturing = false;
export function setCapturingKey(on: boolean) { capturing = on; }
export function isCapturingKey(): boolean { return capturing; }

export function getBinds(): Record<KeyAction, string> { return current; }
export function useKeybinds(): Record<KeyAction, string> {
  return useSyncExternalStore((cb) => { listeners.add(cb); return () => { listeners.delete(cb); }; }, () => current, () => DEFAULT_KEYBINDS);
}

export type RebindResult = { ok: true; swapped?: { action: KeyAction; now: string } } | { ok: false; reason: 'reserved' };
/** Gives an action a new key. If another action already had that key, the two swap so nothing is left without one. */
export function rebind(action: KeyAction, code: string): RebindResult {
  if (isReservedKey(code)) return { ok: false, reason: 'reserved' };
  const next = { ...current };
  const old = next[action];
  // Left and right twins (Shift, Alt, Ctrl) count as the same key
  const twin = (c: string) => c.replace(/(Left|Right)$/, '');
  const clash = KEY_ACTIONS.find((a) => a !== action && (next[a] === code || (/^(Shift|Alt|Control)(Left|Right)$/.test(code) && twin(next[a]) === twin(code))));
  next[action] = code;
  let swapped: { action: KeyAction; now: string } | undefined;
  if (clash) { next[clash] = old; swapped = { action: clash, now: old }; }
  commit(next);
  return swapped ? { ok: true, swapped } : { ok: true };
}
export function resetBinds() { commit({ ...DEFAULT_KEYBINDS }); }

/** A key's name for the screen: KeyW -> W, ShiftLeft -> Left Shift. */
export function keyLabel(code: string): string {
  const m = /^(Shift|Alt|Control)(Left|Right)$/.exec(code);
  if (m) return `${m[2]} ${m[1] === 'Control' ? 'Ctrl' : m[1]}`;
  if (/^Key[A-Z]$/.test(code)) return code.slice(3);
  if (/^Digit\d$/.test(code)) return code.slice(5);
  const arrows: Record<string, string> = { ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→', Space: 'Space', Backquote: '`', Minus: '-', Equal: '=', BracketLeft: '[', BracketRight: ']', Semicolon: ';', Quote: "'", Comma: ',', Period: '.', Backslash: '\\', Backspace: 'Backspace' };
  if (arrows[code]) return arrows[code];
  if (code.startsWith('Numpad')) return 'Num ' + code.slice(6);
  return code;
}
