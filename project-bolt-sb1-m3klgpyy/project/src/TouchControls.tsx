// Touch controls for phones and tablets (like Minecraft Bedrock on a phone):
//   left thumb: a joystick to walk (push it all the way to sprint)
//   right side: drag to look around, tap to place / use, hold still to break / attack
//   buttons: jump (double-tap to fly in creative), crouch, attack, use, inventory, drop, chat, menu
// Keyboard actions are sent as the same key presses a keyboard would make, so everything the game already does
// for keys (including the player's own key bindings) works unchanged.
import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { getBinds } from './keybinds';
import type { KeyAction } from './voxelGame';

/** Does this device have a touch screen and no real mouse? (Can be forced on or off in Settings.) */
export type TouchPref = 'auto' | 'on' | 'off';
export function loadTouchPref(): TouchPref {
  try { const v = localStorage.getItem('vb-touch'); return v === 'on' || v === 'off' ? v : 'auto'; } catch { return 'auto'; }
}
export function saveTouchPref(v: TouchPref) { try { localStorage.setItem('vb-touch', v); } catch { /* storage blocked */ } }
export function isTouchDevice(): boolean {
  try {
    const coarse = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;
    const fine = typeof matchMedia === 'function' && matchMedia('(any-pointer: fine)').matches;
    return (coarse && !fine) || (('ontouchstart' in window || navigator.maxTouchPoints > 0) && !fine);
  } catch { return false; }
}
export function touchEnabled(pref: TouchPref = loadTouchPref()): boolean {
  return pref === 'on' || (pref === 'auto' && isTouchDevice());
}
/** Phones: stop pinch-zoom and double-tap zoom so the game fills the screen. */
export function lockViewportForTouch() {
  let m = document.querySelector('meta[name="viewport"]');
  if (!m) { m = document.createElement('meta'); m.setAttribute('name', 'viewport'); document.head.appendChild(m); }
  m.setAttribute('content', 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover');
}

/** Keep getting a finger's moves even when it slides off the control (some browsers refuse: that's fine). */
function capture(e: ReactPointerEvent) { try { (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); } catch { /* not allowed here */ } }

type Handle = { touchLook: (dx: number, dy: number) => void; touchPress: (button: 0 | 2, down: boolean) => void };

function sendKey(action: KeyAction, down: boolean) {
  const code = getBinds()[action];
  document.dispatchEvent(new KeyboardEvent(down ? 'keydown' : 'keyup', { code, key: code, bubbles: true }));
}

const btn = 'pointer-events-auto select-none touch-none flex items-center justify-center rounded-full bg-black/35 border-2 border-white/30 text-white font-bold active:bg-white/30 active:scale-95 transition-transform';

export default function TouchControls({ getHandle, onMenu, onChat, paused, creative }: {
  getHandle: () => Handle | null;
  onMenu: () => void;
  onChat: () => void;
  /** a menu, the inventory or chat is open: controls hide */
  paused: boolean;
  creative: boolean;
}) {
  // ---- the joystick ----
  const stickRef = useRef<HTMLDivElement>(null);
  const stickId = useRef<number | null>(null);
  const [knob, setKnob] = useState({ x: 0, y: 0 });
  const held = useRef<Record<string, boolean>>({});
  const setAction = (a: KeyAction, on: boolean) => {
    if (!!held.current[a] === on) return;
    held.current[a] = on;
    sendKey(a, on);
  };
  const releaseMove = () => { for (const a of ['forward', 'back', 'left', 'right', 'sprint'] as KeyAction[]) setAction(a, false); setKnob({ x: 0, y: 0 }); };
  function moveStick(e: ReactPointerEvent) {
    const el = stickRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const R = r.width / 2;
    let dx = e.clientX - (r.left + R), dy = e.clientY - (r.top + R);
    const len = Math.hypot(dx, dy);
    if (len > R) { dx *= R / len; dy *= R / len; }
    setKnob({ x: dx, y: dy });
    const nx = dx / R, ny = dy / R, dead = 0.28;
    setAction('forward', ny < -dead);
    setAction('back', ny > dead);
    setAction('left', nx < -dead);
    setAction('right', nx > dead);
    setAction('sprint', ny < -0.92); // pushed right to the top: sprint
  }

  // ---- looking around (and tap to use, hold to break) ----
  const look = useRef<{ id: number; x: number; y: number; sx: number; sy: number; t: number; moved: boolean; breaking: boolean; timer: number } | null>(null);
  function lookDown(e: ReactPointerEvent) {
    if (look.current) return;
    capture(e);
    const st = { id: e.pointerId, x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, t: performance.now(), moved: false, breaking: false, timer: 0 };
    // hold your finger still to break the block (or hit the mob) you're looking at
    st.timer = window.setTimeout(() => {
      if (look.current === st && !st.moved) { st.breaking = true; getHandle()?.touchPress(0, true); }
    }, 280);
    look.current = st;
  }
  function lookMove(e: ReactPointerEvent) {
    const st = look.current;
    if (!st || st.id !== e.pointerId) return;
    const dx = e.clientX - st.x, dy = e.clientY - st.y;
    st.x = e.clientX; st.y = e.clientY;
    if (Math.hypot(e.clientX - st.sx, e.clientY - st.sy) > 10) st.moved = true;
    getHandle()?.touchLook(dx, dy);
  }
  function lookUp(e: ReactPointerEvent) {
    const st = look.current;
    if (!st || st.id !== e.pointerId) return;
    window.clearTimeout(st.timer);
    look.current = null;
    const h = getHandle();
    if (st.breaking) h?.touchPress(0, false);
    else if (!st.moved && performance.now() - st.t < 280) { h?.touchPress(2, true); window.setTimeout(() => getHandle()?.touchPress(2, false), 60); } // a tap: place / use
  }

  // ---- buttons that are held (attack, use, jump, crouch) ----
  const holdMouse = (button: 0 | 2) => ({
    onPointerDown: (e: ReactPointerEvent) => { e.preventDefault(); capture(e); getHandle()?.touchPress(button, true); },
    onPointerUp: () => getHandle()?.touchPress(button, false),
    onPointerCancel: () => getHandle()?.touchPress(button, false),
  });
  // a quick tap still counts: the key stays down long enough for the game to see it
  const pressedAt = useRef<Record<string, number>>({});
  const releaseSoon = (a: KeyAction) => { const wait = Math.max(0, 140 - (performance.now() - (pressedAt.current[a] ?? 0))); window.setTimeout(() => setAction(a, false), wait); };
  const holdKey = (a: KeyAction) => ({
    onPointerDown: (e: ReactPointerEvent) => { e.preventDefault(); capture(e); pressedAt.current[a] = performance.now(); setAction(a, true); },
    onPointerUp: () => releaseSoon(a),
    onPointerCancel: () => releaseSoon(a),
  });
  const [crouching, setCrouching] = useState(false);
  const tapKey = (a: KeyAction) => () => { sendKey(a, true); window.setTimeout(() => sendKey(a, false), 50); };

  // Pausing (menu, inventory, chat) lets go of everything
  useEffect(() => {
    if (!paused) return;
    releaseMove();
    setAction('jump', false);
    if (look.current) { window.clearTimeout(look.current.timer); if (look.current.breaking) getHandle()?.touchPress(0, false); look.current = null; }
    stickId.current = null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paused]);
  useEffect(() => () => { for (const a of Object.keys(held.current)) if (held.current[a]) sendKey(a as KeyAction, false); }, []);

  if (paused) return null;
  return (
    <div className="absolute inset-0 z-[25] pointer-events-none select-none" data-testid="touch-controls" style={{ touchAction: 'none' }}>
      {/* Right side: drag to look, tap to use, hold to break */}
      <div className="absolute top-0 right-0 bottom-0 left-[38%] pointer-events-auto touch-none" data-testid="touch-look"
        onPointerDown={lookDown} onPointerMove={lookMove} onPointerUp={lookUp} onPointerCancel={lookUp} />

      {/* Top: menu and chat */}
      <div className="absolute top-3 right-3 flex gap-2">
        <button className={`${btn} w-11 h-11 text-[10px]`} onClick={tapKey('inventory')} data-testid="touch-inventory" aria-label="Inventory">BAG</button>
        <button className={`${btn} w-11 h-11 text-[10px]`} onClick={tapKey('drop')} data-testid="touch-drop" aria-label="Drop">DROP</button>
        <button className={`${btn} w-11 h-11 text-xs`} onClick={onChat} data-testid="touch-chat" aria-label="Chat">💬</button>
        <button className={`${btn} w-11 h-11 text-lg`} onClick={onMenu} data-testid="touch-menu" aria-label="Menu">❚❚</button>
      </div>

      {/* Left: the joystick */}
      <div ref={stickRef} className="absolute left-6 bottom-8 w-36 h-36 rounded-full bg-black/25 border-2 border-white/25 pointer-events-auto touch-none" data-testid="touch-stick"
        onPointerDown={(e) => { stickId.current = e.pointerId; capture(e); moveStick(e); }}
        onPointerMove={(e) => { if (stickId.current === e.pointerId) moveStick(e); }}
        onPointerUp={(e) => { if (stickId.current === e.pointerId) { stickId.current = null; releaseMove(); } }}
        onPointerCancel={() => { stickId.current = null; releaseMove(); }}>
        <div className="absolute w-14 h-14 rounded-full bg-white/40 border-2 border-white/60 pointer-events-none"
          style={{ left: '50%', top: '50%', transform: `translate(calc(-50% + ${knob.x}px), calc(-50% + ${knob.y}px))` }} />
      </div>

      {/* Right: action buttons */}
      <div className="absolute right-5 bottom-8 flex items-end gap-3">
        <div className="flex flex-col gap-3 items-center">
          <button className={`${btn} w-14 h-14 text-[11px]`} {...holdMouse(2)} data-testid="touch-use">USE</button>
          <button className={`${btn} w-14 h-14 text-[11px]`} {...holdMouse(0)} data-testid="touch-attack">HIT</button>
        </div>
        <div className="flex flex-col gap-3 items-center">
          <button className={`${btn} w-12 h-12 text-[10px] ${crouching ? 'bg-white/40' : ''}`} data-testid="touch-crouch"
            onClick={() => { const on = !crouching; setCrouching(on); setAction('crouch', on); }}>{crouching ? 'STAND' : 'SNEAK'}</button>
          <button className={`${btn} w-20 h-20 text-xs`} {...holdKey('jump')} data-testid="touch-jump">{creative ? 'JUMP / FLY' : 'JUMP'}</button>
        </div>
      </div>

    </div>
  );
}

/** Phones held upright: ask to turn sideways (the controls need the width). */
export function RotateHint() {
  const [portrait, setPortrait] = useState(() => typeof innerHeight === 'number' && innerHeight > innerWidth);
  useEffect(() => {
    const f = () => setPortrait(innerHeight > innerWidth);
    addEventListener('resize', f);
    return () => removeEventListener('resize', f);
  }, []);
  if (!portrait) return null;
  return (
    <div className="absolute top-14 left-1/2 -translate-x-1/2 z-[26] px-4 py-2 rounded-xl bg-black/70 text-white text-xs text-center pointer-events-none" data-testid="rotate-hint">
      Turn your phone sideways for the best view
    </div>
  );
}
