// Small synthesized sounds for the board games (no files to load). Everything is optional and quiet by default.
let ctx: AudioContext | null = null;
function ac(): AudioContext | null {
  try {
    if (!ctx) { const C = (window as any).AudioContext || (window as any).webkitAudioContext; if (!C) return null; ctx = new C(); }
    if (ctx!.state === 'suspended') void ctx!.resume();
    return ctx;
  } catch { return null; }
}
function tone(freq: number, dur: number, type: OscillatorType, vol: number, when = 0, slide = 0) {
  const c = ac(); if (!c) return;
  const t = c.currentTime + when;
  const o = c.createOscillator(), g = c.createGain();
  o.type = type; o.frequency.setValueAtTime(freq, t);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq + slide), t + dur);
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g); g.connect(c.destination); o.start(t); o.stop(t + dur + 0.02);
}
function noise(dur: number, vol: number, when = 0, lowpass = 1200) {
  const c = ac(); if (!c) return;
  const n = Math.floor(c.sampleRate * dur), buf = c.createBuffer(1, n, c.sampleRate), d = buf.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
  const s = c.createBufferSource(); s.buffer = buf;
  const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = lowpass;
  const g = c.createGain(); g.gain.value = vol;
  s.connect(f); f.connect(g); g.connect(c.destination); s.start(c.currentTime + when);
}
export type Sfx = 'move' | 'capture' | 'check' | 'end' | 'win' | 'lose' | 'slam' | 'throw' | 'tick' | 'ping' | 'castle' | 'promote';
import type { SoundTheme } from '../store';
export type { SoundTheme };
/** Plays one sound. `theme` changes how moves, captures and checks sound. */
export function playSfx(kind: Sfx, on = true, theme: SoundTheme = 'default') {
  if (!on) return;
  if (theme !== 'default' && themed(kind, theme)) return;
  switch (kind) {
    case 'move': tone(210, 0.07, 'triangle', 0.16, 0, -60); noise(0.04, 0.12, 0, 2200); break;
    case 'capture': tone(160, 0.12, 'triangle', 0.22, 0, -70); noise(0.09, 0.25, 0, 1800); break;
    case 'castle': tone(210, 0.07, 'triangle', 0.16, 0, -60); noise(0.04, 0.12, 0, 2200); tone(190, 0.08, 'triangle', 0.16, 0.1, -60); noise(0.04, 0.12, 0.1, 2200); break;
    case 'promote': [440, 554, 659].forEach((f, i) => tone(f, 0.1, 'triangle', 0.12, i * 0.06)); break;
    case 'check': tone(620, 0.1, 'square', 0.07); tone(820, 0.12, 'square', 0.07, 0.09); break;
    case 'end': tone(330, 0.2, 'sine', 0.14); tone(247, 0.3, 'sine', 0.14, 0.18); break;
    case 'win': [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.18, 'triangle', 0.14, i * 0.1)); break;
    case 'lose': [392, 349, 294].forEach((f, i) => tone(f, 0.25, 'sine', 0.13, i * 0.14)); break;
    case 'slam': tone(70, 0.5, 'sine', 0.5, 0.3, -35); noise(0.35, 0.55, 0.3, 700); noise(0.5, 0.2, 0.33, 300); break;
    case 'throw': noise(0.35, 0.18, 0, 3500); tone(300, 0.3, 'sawtooth', 0.04, 0, 500); break;
    case 'tick': tone(900, 0.03, 'square', 0.04); break;
    case 'ping': tone(880, 0.1, 'sine', 0.1); tone(1320, 0.12, 'sine', 0.08, 0.08); break;
  }
}
/** The sounds that change with the theme; returns true when it played one. */
function themed(kind: Sfx, t: SoundTheme): boolean {
  switch (t) {
    case 'wood': // dry knocks
      if (kind === 'move' || kind === 'castle') { noise(0.05, 0.4, 0, 900); tone(140, 0.06, 'sine', 0.22, 0, -40); return true; }
      if (kind === 'capture') { noise(0.09, 0.55, 0, 1100); tone(110, 0.1, 'sine', 0.3, 0, -40); noise(0.05, 0.3, 0.05, 700); return true; }
      if (kind === 'check') { noise(0.04, 0.4, 0, 1500); noise(0.04, 0.4, 0.11, 1500); return true; }
      return false;
    case 'bubble': // soft pops
      if (kind === 'move' || kind === 'castle') { tone(520, 0.09, 'sine', 0.16, 0, 380); return true; }
      if (kind === 'capture') { tone(700, 0.1, 'sine', 0.2, 0, -450); tone(300, 0.12, 'sine', 0.14, 0.05, 200); return true; }
      if (kind === 'check') { tone(900, 0.08, 'sine', 0.12); tone(1200, 0.1, 'sine', 0.12, 0.07); return true; }
      return false;
    case 'retro': // 8-bit beeps
      if (kind === 'move' || kind === 'castle') { tone(440, 0.05, 'square', 0.07); return true; }
      if (kind === 'capture') { tone(330, 0.06, 'square', 0.09); tone(220, 0.08, 'square', 0.09, 0.06); return true; }
      if (kind === 'check') { tone(880, 0.05, 'square', 0.07); tone(660, 0.05, 'square', 0.07, 0.06); tone(880, 0.05, 'square', 0.07, 0.12); return true; }
      if (kind === 'win') { [392, 523, 659, 784, 1046].forEach((f, i) => tone(f, 0.09, 'square', 0.07, i * 0.07)); return true; }
      return false;
    case 'blocks': // blocky clunks, a nod to the game
      if (kind === 'move' || kind === 'castle') { tone(180, 0.06, 'square', 0.1, 0, -90); noise(0.03, 0.18, 0, 1600); return true; }
      if (kind === 'capture') { tone(130, 0.1, 'square', 0.14, 0, -70); noise(0.08, 0.3, 0, 1300); tone(90, 0.1, 'square', 0.1, 0.07, -30); return true; }
      if (kind === 'check') { tone(300, 0.06, 'square', 0.09); tone(300, 0.06, 'square', 0.09, 0.1); return true; }
      return false;
    default: return false;
  }
}
