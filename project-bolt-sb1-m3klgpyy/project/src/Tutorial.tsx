// The first-time tutorial: shown the first time someone plays a world (never again unless they ask for it in
// Settings > Controls). Each step finishes by itself when you do it; Skip ends it at any time.
import { useEffect, useRef, useState } from 'react';

const KEY = 'vb-tutorial-done';
export function tutorialDone(): boolean { try { return localStorage.getItem(KEY) === '1'; } catch { return true; } }
function markDone() { try { localStorage.setItem(KEY, '1'); } catch { /* storage blocked */ } }

type Info = { x: number; y: number; z: number; yaw: number; pitch: number; flying?: boolean } | null;
type StepId = 'welcome' | 'look' | 'move' | 'jump' | 'break' | 'place' | 'hotbar' | 'inventory' | 'chat' | 'menu' | 'done';
const ORDER: StepId[] = ['welcome', 'look', 'move', 'jump', 'break', 'place', 'hotbar', 'inventory', 'chat', 'menu', 'done'];

function text(step: StepId, touch: boolean): { title: string; body: string } {
  switch (step) {
    case 'welcome': return { title: 'Welcome to VibeBlox!', body: 'This quick tutorial shows you how to play. It only takes a minute, and you can skip it any time.' };
    case 'look': return { title: 'Look around', body: touch ? 'Drag your finger on the right side of the screen to look around.' : 'Move your mouse to look around. (Click the game first if the mouse is free.)' };
    case 'move': return { title: 'Walk', body: touch ? 'Use the joystick on the left to walk. Push it all the way up to sprint.' : 'Walk with W, A, S and D. Hold Shift while walking forward to sprint.' };
    case 'jump': return { title: 'Jump', body: touch ? 'Tap JUMP to jump up onto blocks. In creative, tap it twice quickly to fly.' : 'Press Space to jump onto blocks. In creative, press it twice quickly to fly.' };
    case 'break': return { title: 'Break a block', body: touch ? 'Look at a block, then hold your finger still on it (or hold HIT) until it breaks.' : 'Look at a block and hold the left mouse button until it breaks. Stone needs a pickaxe.' };
    case 'place': return { title: 'Place a block', body: touch ? 'Pick up the block you broke, then tap where you want to put it (or press USE).' : 'Walk over the block you broke to pick it up, then right-click to place it.' };
    case 'hotbar': return { title: 'Your hotbar', body: touch ? 'The row of slots at the bottom is your hotbar. Tap a different slot to hold something else.' : 'The row of slots at the bottom is your hotbar. Press 1 to 9 or scroll the mouse wheel to switch.' };
    case 'inventory': return { title: 'Your inventory', body: touch ? 'Tap BAG to open your inventory. Craft planks from wood, then a crafting table. Tap ✕ to close it.' : 'Press E to open your inventory. Craft planks from wood, then a crafting table. Press E again to close it.' };
    case 'chat': return { title: 'Chat and commands', body: touch ? 'Tap 💬 to chat. Type /help to see every command. Tap ✕ to close it.' : 'Press T to chat, or / to type a command. /help lists them all. Esc closes chat.' };
    case 'menu': return { title: 'The menu', body: touch ? 'Tap ❚❚ for the menu: settings, mods, scripts, who can join your world, and leaving.' : 'Press Esc for the menu: settings, mods, scripts, who can join your world, and leaving.' };
    case 'done': return { title: "You're ready!", body: 'Gather wood, make tools, build a shelter before night falls, and have fun. You can see this again from Settings > Controls.' };
  }
}

export default function Tutorial({ touch, getInfo, inventoryOpen, chatOpen, menuOpen, selectedSlot, subscribeBlocks, onDone }: {
  touch: boolean;
  getInfo: () => Info;
  inventoryOpen: boolean;
  chatOpen: boolean;
  menuOpen: boolean;
  selectedSlot: number;
  /** the game calls back on every block you break or place */
  subscribeBlocks: (cb: (type: 'break' | 'place') => void) => () => void;
  onDone: () => void;
}) {
  const [step, setStep] = useState<StepId>('welcome');
  const [cheer, setCheer] = useState(false);
  const stepRef = useRef(step);
  stepRef.current = step;
  const start = useRef<{ info: Info; slot: number; turned: number; lastYaw: number | null }>({ info: null, slot: selectedSlot, turned: 0, lastYaw: null });

  // Showing it once counts: it never comes back by itself, even if you leave half-way
  useEffect(() => { markDone(); }, []);

  function advance() {
    setCheer(true);
    window.setTimeout(() => {
      setCheer(false);
      setStep((s) => ORDER[Math.min(ORDER.length - 1, ORDER.indexOf(s) + 1)]);
    }, 700);
  }
  function finish() { markDone(); onDone(); }
  // With the mouse captured you can't click the buttons: K skips the whole tutorial, and the first and last cards
  // move on by themselves
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.code === 'KeyK' && !chatOpen && !(e.target instanceof HTMLInputElement) && !(e.target instanceof HTMLTextAreaElement)) finish(); };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chatOpen]);
  useEffect(() => {
    if (step !== 'welcome' && step !== 'done') return;
    const t = window.setTimeout(() => (step === 'done' ? finish() : advance()), step === 'done' ? 8000 : 6000);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  // A new step remembers where you started it
  useEffect(() => {
    const info = getInfo();
    start.current = { info, slot: selectedSlot, turned: 0, lastYaw: info ? info.yaw : null };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  // Looking, walking and jumping are checked a few times a second
  useEffect(() => {
    if (step !== 'look' && step !== 'move' && step !== 'jump') return;
    const t = window.setInterval(() => {
      if (cheerRef.current) return;
      const i = getInfo(), s = start.current;
      if (!i) return;
      if (!s.info) { s.info = i; s.lastYaw = i.yaw; return; }
      if (step === 'look') {
        if (s.lastYaw !== null) { let d = Math.abs(i.yaw - s.lastYaw); if (d > 180) d = 360 - d; s.turned += d; }
        s.lastYaw = i.yaw;
        if (s.turned + Math.abs(i.pitch - s.info.pitch) > 70) advance();
      } else if (step === 'move') {
        if (Math.hypot(i.x - s.info.x, i.z - s.info.z) > 4) advance();
      } else if (i.y - s.info.y > 0.7 || (i.flying && !s.info.flying)) advance();
    }, 150);
    return () => window.clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);
  const cheerRef = useRef(false);
  cheerRef.current = cheer;

  // Breaking and placing
  useEffect(() => subscribeBlocks((type) => {
    if (cheerRef.current) return;
    if ((stepRef.current === 'break' && type === 'break') || (stepRef.current === 'place' && type === 'place')) advance();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), []);

  // The hotbar, inventory, chat and menu
  useEffect(() => { if (step === 'hotbar' && selectedSlot !== start.current.slot && !cheer) advance(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [selectedSlot]);
  const opened = useRef(false);
  useEffect(() => { opened.current = false; }, [step]);
  useEffect(() => {
    const open = step === 'inventory' ? inventoryOpen : step === 'chat' ? chatOpen : step === 'menu' ? menuOpen : false;
    if (open) opened.current = true;
    else if (opened.current && !cheer) { opened.current = false; advance(); } // done once you've opened it and closed it again
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inventoryOpen, chatOpen, menuOpen]);

  // Out of the way while a screen is open
  if (inventoryOpen || chatOpen || menuOpen) return null;
  const n = ORDER.indexOf(step);
  const { title, body } = text(step, touch);
  const manual = step === 'welcome' || step === 'done';
  return (
    <div className={`absolute z-[40] pointer-events-auto vb-fade-in ${touch ? 'top-2 left-2 w-[300px] max-w-[46vw]' : 'top-16 left-1/2 -translate-x-1/2 w-[420px] max-w-[92vw]'}`} data-testid="tutorial">
      <div className={`rounded-2xl border-2 ${touch ? 'px-3 py-2.5' : 'px-5 py-4'} shadow-2xl backdrop-blur-sm transition-colors ${cheer ? 'bg-[#0f3a24]/95 border-[#00e676]' : 'bg-[#0d131b]/92 border-[#243044]'}`}>
        <div className="flex items-center justify-between gap-3 mb-1">
          <span className="text-[10px] font-bold tracking-wider text-[#00e676]" data-testid="tutorial-progress">TUTORIAL · {Math.min(n + 1, ORDER.length - 1)}/{ORDER.length - 1}</span>
          {step !== 'done' && <button onClick={finish} className="text-[#8ea0b8] hover:text-white text-xs font-bold px-2 py-1 rounded-lg hover:bg-white/10" data-testid="tutorial-skip">{touch ? 'Skip tutorial' : 'Skip (K)'}</button>}
        </div>
        <div className="text-white font-bold text-base" data-testid="tutorial-title">{cheer ? 'Nice!' : title}</div>
        {!cheer && <p className={`text-[#c8d2e0] ${touch ? 'text-xs' : 'text-sm'} mt-1 leading-snug`} data-testid="tutorial-body">{body}</p>}
        <div className="flex gap-1 mt-3">
          {ORDER.slice(0, -1).map((s, i) => <span key={s} className={`h-1 flex-1 rounded-full ${i < n || (i === n && cheer) ? 'bg-[#00e676]' : i === n ? 'bg-white/50' : 'bg-white/10'}`} />)}
        </div>
        {manual && !cheer && (
          <div className="flex justify-end mt-3">
            <button onClick={step === 'done' ? finish : advance} data-testid="tutorial-next"
              className="px-5 py-2 rounded-xl bg-gradient-to-r from-[#00e676] to-[#00b248] text-[#0a0e14] text-sm font-bold active:scale-95">{step === 'done' ? 'Start playing' : "Let's go"}</button>
          </div>
        )}
        {!manual && !cheer && (
          <div className="flex justify-end mt-2">
            <button onClick={advance} className="text-[#5a6b80] hover:text-white text-[11px]" data-testid="tutorial-skip-step">Skip this step</button>
          </div>
        )}
      </div>
    </div>
  );
}
