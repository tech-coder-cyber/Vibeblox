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
export type Sfx = 'move' | 'capture' | 'check' | 'end' | 'win' | 'lose' | 'slam' | 'throw' | 'tick' | 'ping';
export function playSfx(kind: Sfx, on = true) {
  if (!on) return;
  switch (kind) {
    case 'move': tone(210, 0.07, 'triangle', 0.16, 0, -60); noise(0.04, 0.12, 0, 2200); break;
    case 'capture': tone(160, 0.12, 'triangle', 0.22, 0, -70); noise(0.09, 0.25, 0, 1800); break;
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
