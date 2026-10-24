// Touch controls for phones and tablets (like Minecraft Bedrock on a phone), in four layouts (Settings > Controls):
//   classic : a joystick on the left, drag the right side to look, tap to place / use, hold still to break, HIT and USE buttons
//   dynamic : a floating joystick (it appears under your left thumb) and a crosshair; HIT and USE buttons act on the crosshair
//   dpad    : a D-pad (with a RUN toggle) to walk, drag to look, tap / hold on the view, HIT and USE buttons
//   tap     : a clean screen: tap the view to place / use, hold still to break / attack (no HIT and USE buttons)
//   buttons: jump (double-tap to fly in creative), sneak, inventory, drop, chat, menu. Every button reacts the moment
//   a finger lands (not when it lifts), so they all work while the other thumb is busy walking.
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
/** The on-screen layout: classic (the original), dynamic (floating joystick + crosshair), a D-pad, or tap to interact. */
export type TouchScheme = 'classic' | 'dynamic' | 'dpad' | 'tap';
export const TOUCH_SCHEMES: Array<{ id: TouchScheme; name: string; blurb: string }> = [
  { id: 'classic', name: 'Classic', blurb: 'Fixed joystick, drag to look, tap to use, hold to break.' },
  { id: 'dynamic', name: 'Dynamic', blurb: 'A joystick that appears under your thumb, and a crosshair. HIT and USE act on the crosshair.' },
  { id: 'dpad', name: 'D-pad', blurb: 'Arrow buttons to walk (with a RUN switch), drag to look.' },
  { id: 'tap', name: 'Tap to interact', blurb: 'No HIT or USE buttons: tap the view to use, hold still to break.' },
];
export function loadTouchScheme(): TouchScheme {
  try { const v = localStorage.getItem('vb-touch-scheme'); return v === 'dynamic' || v === 'dpad' || v === 'tap' ? v : 'classic'; } catch { return 'classic'; }
}
export function saveTouchScheme(v: TouchScheme) {
  try { localStorage.setItem('vb-touch-scheme', v); } catch { /* storage blocked */ }
  try { window.dispatchEvent(new CustomEvent('vb-touch-scheme', { detail: v })); } catch { /* no window */ }
}
function useTouchScheme(): TouchScheme {
  const [v, setV] = useState<TouchScheme>(loadTouchScheme);
  useEffect(() => {
    const f = (e: Event) => { const d = (e as CustomEvent).detail; if (d === 'classic' || d === 'dynamic' || d === 'dpad' || d === 'tap') setV(d); };
    addEventListener('vb-touch-scheme', f);
    return () => removeEventListener('vb-touch-scheme', f);
  }, []);
  return v;
}
/** A tiny buzz when a button is pressed (phones that can). */
function buzz(ms = 8) { try { navigator.vibrate?.(ms); } catch { /* not supported */ } }

/** How fast dragging turns the camera (Settings > Controls). */
export function loadLookSpeed(): number {
  try { const v = Number(localStorage.getItem('vb-touch-look')); return v >= 0.3 && v <= 3 ? v : 1; } catch { return 1; }
}
export function saveLookSpeed(v: number) { try { localStorage.setItem('vb-touch-look', String(v)); } catch { /* storage blocked */ } }
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

export default function TouchControls({ getHandle, onMenu, onChat, paused, creative, onPlayers, playersOn }: {
  getHandle: () => Handle | null;
  onMenu: () => void;
  onChat: () => void;
  /** a menu, the inventory or chat is open: controls hide */
  paused: boolean;
  creative: boolean;
  /** online: show or hide the player list (there is no Tab key on a phone) */
  onPlayers?: () => void;
  playersOn?: boolean;
}) {
  const scheme = useTouchScheme();
  const floating = scheme === 'dynamic';
  const dpad = scheme === 'dpad';
  const showActions = scheme !== 'tap';       // HIT and USE buttons
  const tapToUse = scheme !== 'dynamic';      // tap on the view places / uses, hold breaks (dynamic leaves that to HIT and USE)

  // ---- walking: the joystick (fixed, or floating under the thumb) or the D-pad ----
  const stickRef = useRef<HTMLDivElement>(null);
  const floatRef = useRef<HTMLDivElement>(null); // the floating joystick's ring (dynamic layout)
  const stickId = useRef<number | null>(null);
  const origin = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const [knob, setKnob] = useState({ x: 0, y: 0 });
  const [floatAt, setFloatAt] = useState<{ x: number; y: number } | null>(null); // where the floating joystick sits now
  const [pad, setPad] = useState({ f: false, b: false, l: false, r: false });
  const [run, setRun] = useState(false);
  const held = useRef<Record<string, boolean>>({});
  const setAction = (a: KeyAction, on: boolean) => {
    if (!!held.current[a] === on) return;
    held.current[a] = on;
    sendKey(a, on);
  };
  const releaseMove = () => {
    for (const a of ['forward', 'back', 'left', 'right'] as KeyAction[]) setAction(a, false);
    if (!runRef.current) setAction('sprint', false);
    setKnob({ x: 0, y: 0 }); setFloatAt(null); setPad({ f: false, b: false, l: false, r: false });
  };
  const runRef = useRef(false);
  runRef.current = run;
  // the RUN switch of the D-pad: keeps sprint held while you walk forward
  useEffect(() => { if (dpad) setAction('sprint', run); else if (run) { setRun(false); setAction('sprint', false); } /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [run, dpad]);
  function aim(e: ReactPointerEvent, cx: number, cy: number, R: number) {
    let dx = e.clientX - cx, dy = e.clientY - cy;
    const len = Math.hypot(dx, dy);
    if (len > R) { dx *= R / len; dy *= R / len; }
    const nx = dx / R, ny = dy / R;
    if (dpad) {
      const dead = 0.3;
      const f = ny < -dead, b = ny > dead, l = nx < -dead, r = nx > dead;
      setAction('forward', f); setAction('back', b); setAction('left', l); setAction('right', r);
      setPad({ f, b, l, r });
      return;
    }
    setKnob({ x: dx, y: dy });
    const dead = 0.28;
    setAction('forward', ny < -dead);
    setAction('back', ny > dead);
    setAction('left', nx < -dead);
    setAction('right', nx > dead);
    setAction('sprint', ny < -0.92); // pushed right to the top: sprint
  }
  function moveStick(e: ReactPointerEvent) {
    if (floating) { aim(e, origin.current.x, origin.current.y, (floatRef.current?.getBoundingClientRect().width ?? 112) / 2); return; }
    const el = stickRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    aim(e, r.left + r.width / 2, r.top + r.height / 2, r.width / 2);
  }
  function stickDown(e: ReactPointerEvent) {
    if (stickId.current !== null && stickId.current !== e.pointerId) releaseMove();
    stickId.current = e.pointerId;
    capture(e);
    if (floating) {
      const host = (e.currentTarget as HTMLElement).getBoundingClientRect();
      origin.current = { x: e.clientX, y: e.clientY };
      setFloatAt({ x: e.clientX - host.left, y: e.clientY - host.top });
    }
    moveStick(e);
  }

  // ---- looking around (and tap to use, hold to break) ----
  const look = useRef<{ id: number; x: number; y: number; sx: number; sy: number; t: number; last: number; moved: boolean; breaking: boolean; timer: number } | null>(null);
  const lookSpeed = loadLookSpeed();
  const tapRef = useRef(tapToUse);
  tapRef.current = tapToUse;
  function endLook(st: NonNullable<typeof look.current>, asTap: boolean) {
    window.clearTimeout(st.timer);
    if (look.current === st) look.current = null;
    const h = getHandle();
    if (st.breaking) h?.touchPress(0, false);
    else if (tapRef.current && asTap && !st.moved && performance.now() - st.t < 280) { h?.touchPress(2, true); window.setTimeout(() => getHandle()?.touchPress(2, false), 60); } // a tap: place / use
  }
  function lookDown(e: ReactPointerEvent) {
    // a finger whose "up" got lost (the browser took it for a gesture, a call came in...) must never freeze the camera:
    // a new finger on the look area always takes over
    if (look.current) { if (look.current.id === e.pointerId || performance.now() - look.current.last > 250) endLook(look.current, false); else return; }
    capture(e);
    const st = { id: e.pointerId, x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, t: performance.now(), last: performance.now(), moved: false, breaking: false, timer: 0 };
    // hold your finger still to break the block (or hit the mob) you're looking at
    if (tapRef.current) st.timer = window.setTimeout(() => {
      if (look.current === st && !st.moved) { st.breaking = true; getHandle()?.touchPress(0, true); }
    }, 280);
    look.current = st;
  }
  function lookMove(e: ReactPointerEvent) {
    const st = look.current;
    if (!st || st.id !== e.pointerId) return;
    const dx = e.clientX - st.x, dy = e.clientY - st.y;
    st.x = e.clientX; st.y = e.clientY; st.last = performance.now();
    if (Math.hypot(e.clientX - st.sx, e.clientY - st.sy) > 10) st.moved = true;
    getHandle()?.touchLook(dx * lookSpeed, dy * lookSpeed);
  }
  function lookUp(e: ReactPointerEvent) {
    const st = look.current;
    if (!st || st.id !== e.pointerId) return;
    endLook(st, e.type === 'pointerup');
  }
  // A finger lifted anywhere (even off the look area, or after the browser stole it) lets go of looking and the joystick
  useEffect(() => {
    const up = (e: PointerEvent) => {
      const st = look.current;
      if (st && st.id === e.pointerId) endLook(st, e.type === 'pointerup');
      if (stickId.current === e.pointerId) { stickId.current = null; releaseMove(); }
    };
    addEventListener('pointerup', up, true);
    addEventListener('pointercancel', up, true);
    return () => { removeEventListener('pointerup', up, true); removeEventListener('pointercancel', up, true); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---- buttons. They all act when the finger LANDS (a "click" is not sent while another finger is busy on the joystick) ----
  const holdMouse = (button: 0 | 2) => ({
    onPointerDown: (e: ReactPointerEvent) => { e.preventDefault(); capture(e); buzz(); getHandle()?.touchPress(button, true); },
    onPointerUp: () => getHandle()?.touchPress(button, false),
    onPointerCancel: () => getHandle()?.touchPress(button, false),
  });
  // a quick tap still counts: the key stays down long enough for the game to see it
  const pressedAt = useRef<Record<string, number>>({});
  const releaseSoon = (a: KeyAction) => { const wait = Math.max(0, 140 - (performance.now() - (pressedAt.current[a] ?? 0))); window.setTimeout(() => setAction(a, false), wait); };
  const holdKey = (a: KeyAction) => ({
    onPointerDown: (e: ReactPointerEvent) => { e.preventDefault(); capture(e); buzz(); pressedAt.current[a] = performance.now(); setAction(a, true); },
    onPointerUp: () => releaseSoon(a),
    onPointerCancel: () => releaseSoon(a),
  });
  /** Runs `fn` as soon as the finger lands. */
  const onTap = (fn: () => void) => ({
    onPointerDown: (e: ReactPointerEvent) => { e.preventDefault(); e.stopPropagation(); buzz(); fn(); },
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
  // Changing the layout lets go of the walking keys (the old control may have been holding some)
  useEffect(() => { stickId.current = null; releaseMove(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [scheme]);
  useEffect(() => () => { for (const a of Object.keys(held.current)) if (held.current[a]) sendKey(a as KeyAction, false); }, []);

  if (paused) return null;
  const actionSize = floating ? 'w-16 h-16 text-xs' : 'w-14 h-14 text-[11px]';
  const arrow = (on: boolean) => `absolute w-12 h-12 flex items-center justify-center rounded-xl border-2 text-white text-lg font-bold ${on ? 'bg-white/45 border-white/70' : 'bg-black/30 border-white/25'}`;
  return (
    <div className="absolute inset-0 z-[25] pointer-events-none select-none" data-testid="touch-controls" data-scheme={scheme} style={{ touchAction: 'none' }}>
      {/* Dynamic layout: the left part of the screen holds the floating joystick, so the look area starts further right */}
      <div className={`absolute top-0 right-0 bottom-0 pointer-events-auto touch-none ${floating ? 'left-[45%]' : 'left-[38%]'}`} data-testid="touch-look"
        onPointerDown={lookDown} onPointerMove={lookMove} onPointerUp={lookUp} onPointerCancel={lookUp} />

      {/* A crosshair ring to aim with (dynamic and tap-to-interact) */}
      {(floating || scheme === 'tap') && (
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-7 h-7 rounded-full border-2 border-white/50 pointer-events-none" data-testid="touch-crosshair" />
      )}

      {/* Top: menu and chat */}
      <div className="absolute top-3 right-3 flex gap-2 vb-touch-top">
        <button className={`${btn} w-11 h-11 text-[10px]`} {...onTap(tapKey('inventory'))} data-testid="touch-inventory" aria-label="Inventory">BAG</button>
        <button className={`${btn} w-11 h-11 text-[10px]`} {...onTap(tapKey('drop'))} data-testid="touch-drop" aria-label="Drop">DROP</button>
        {onPlayers && <button className={`${btn} w-11 h-11 text-[10px] ${playersOn ? 'bg-white/40' : ''}`} {...onTap(onPlayers)} data-testid="touch-players" aria-label="Players">{playersOn ? 'HIDE' : 'LIST'}</button>}
        <button className={`${btn} w-11 h-11 text-xs`} {...onTap(onChat)} data-testid="touch-chat" aria-label="Chat">💬</button>
        <button className={`${btn} w-11 h-11 text-lg`} {...onTap(onMenu)} data-testid="touch-menu" aria-label="Menu">❚❚</button>
      </div>

      {/* Walking */}
      {floating ? (
        <div className="absolute left-0 bottom-0 w-[45%] h-[78%] pointer-events-auto touch-none" data-testid="touch-stick-zone"
          onPointerDown={stickDown}
          onPointerMove={(e) => { if (stickId.current === e.pointerId) moveStick(e); }}
          onPointerUp={(e) => { if (stickId.current === e.pointerId) { stickId.current = null; releaseMove(); } }}
          onPointerCancel={() => { stickId.current = null; releaseMove(); }}>
          {/* a faint ring shows where to put your thumb; the real one appears under it */}
          {!floatAt && <div className="absolute left-6 bottom-8 w-28 h-28 rounded-full border-2 border-dashed border-white/20 pointer-events-none" />}
          {floatAt && (
            <div ref={floatRef} className="absolute w-28 h-28 rounded-full bg-black/25 border-2 border-white/25 pointer-events-none" data-testid="touch-stick"
              style={{ left: floatAt.x, top: floatAt.y, transform: 'translate(-50%, -50%)' }}>
              <div className="absolute w-12 h-12 rounded-full bg-white/40 border-2 border-white/60"
                style={{ left: '50%', top: '50%', transform: `translate(calc(-50% + ${knob.x}px), calc(-50% + ${knob.y}px))` }} />
            </div>
          )}
        </div>
      ) : dpad ? (
        <div className="absolute left-5 bottom-6 flex flex-col items-center gap-2">
          <button className={`${btn} w-14 h-9 text-[11px] ${run ? 'bg-white/45' : ''}`} {...onTap(() => setRun((v) => !v))} data-testid="touch-run">{run ? 'RUN ON' : 'RUN'}</button>
          <div ref={stickRef} className="relative w-36 h-36 pointer-events-auto touch-none" data-testid="touch-dpad"
            onPointerDown={stickDown}
            onPointerMove={(e) => { if (stickId.current === e.pointerId) moveStick(e); }}
            onPointerUp={(e) => { if (stickId.current === e.pointerId) { stickId.current = null; releaseMove(); } }}
            onPointerCancel={() => { stickId.current = null; releaseMove(); }}>
            <div className={arrow(pad.f)} style={{ left: '50%', top: 0, transform: 'translateX(-50%)' }}>▲</div>
            <div className={arrow(pad.b)} style={{ left: '50%', bottom: 0, transform: 'translateX(-50%)' }}>▼</div>
            <div className={arrow(pad.l)} style={{ left: 0, top: '50%', transform: 'translateY(-50%)' }}>◀</div>
            <div className={arrow(pad.r)} style={{ right: 0, top: '50%', transform: 'translateY(-50%)' }}>▶</div>
          </div>
        </div>
      ) : (
        <div ref={stickRef} className="absolute left-6 bottom-8 w-36 h-36 rounded-full bg-black/25 border-2 border-white/25 pointer-events-auto touch-none" data-testid="touch-stick"
          onPointerDown={stickDown}
          onPointerMove={(e) => { if (stickId.current === e.pointerId) moveStick(e); }}
          onPointerUp={(e) => { if (stickId.current === e.pointerId) { stickId.current = null; releaseMove(); } }}
          onPointerCancel={() => { stickId.current = null; releaseMove(); }}>
          <div className="absolute w-14 h-14 rounded-full bg-white/40 border-2 border-white/60 pointer-events-none"
            style={{ left: '50%', top: '50%', transform: `translate(calc(-50% + ${knob.x}px), calc(-50% + ${knob.y}px))` }} />
        </div>
      )}

      {/* Right: action buttons */}
      <div className="absolute right-5 bottom-8 flex items-end gap-3">
        {showActions && (
          <div className="flex flex-col gap-3 items-center">
            <button className={`${btn} ${actionSize}`} {...holdMouse(2)} data-testid="touch-use">USE</button>
            <button className={`${btn} ${actionSize}`} {...holdMouse(0)} data-testid="touch-attack">HIT</button>
          </div>
        )}
        <div className="flex flex-col gap-3 items-center">
          <button className={`${btn} w-12 h-12 text-[10px] ${crouching ? 'bg-white/40' : ''}`} data-testid="touch-crouch"
            {...onTap(() => { const on = !crouching; setCrouching(on); setAction('crouch', on); })}>{crouching ? 'STAND' : 'SNEAK'}</button>
          <button className={`${btn} w-20 h-20 text-xs`} {...holdKey('jump')} data-testid="touch-jump">{creative ? 'JUMP / FLY' : 'JUMP'}</button>
        </div>
      </div>

    </div>
  );
}

/** Phones held upright can't play: the controls need the width. Turn the phone sideways to carry on. */
export function RotateHint() {
  const [portrait, setPortrait] = useState(() => typeof innerHeight === 'number' && innerHeight > innerWidth);
  useEffect(() => {
    const f = () => setPortrait(innerHeight > innerWidth);
    addEventListener('resize', f);
    addEventListener('orientationchange', f);
    // ask the browser to turn the game sideways where it can (Android, in full screen); iPhones need the player to turn it
    try { (screen.orientation as unknown as { lock?: (o: string) => Promise<void> }).lock?.('landscape').catch(() => {}); } catch { /* not supported */ }
    return () => { removeEventListener('resize', f); removeEventListener('orientationchange', f); };
  }, []);
  if (!portrait) return null;
  return (
    <div className="absolute inset-0 z-[90] bg-[#0a0e14] flex flex-col items-center justify-center gap-4 px-8 text-center text-white" data-testid="rotate-hint"
      onPointerDown={(e) => e.stopPropagation()} onContextMenu={(e) => e.preventDefault()}>
      <div className="w-16 h-24 rounded-xl border-4 border-white/80 relative vb-rotate-phone"><div className="absolute bottom-1.5 left-1/2 -translate-x-1/2 w-4 h-1 rounded bg-white/60" /></div>
      <div className="font-[var(--font-retro)] text-sm">Rotate your device</div>
      <div className="text-xs text-white/60 max-w-[260px]">VibeBlox is played sideways on phones. Turn your phone to landscape to keep playing.</div>
    </div>
  );
}
