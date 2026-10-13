// The built-in soundtracks. Each soundtrack is a playlist of several tracks that follow one another (shuffled), made from
// notes played live with the Web Audio API, so there are no audio files to load.
// `buildTrack` is pure (just numbers), `MusicPlayer` turns the notes into sound.
//
// The classical pieces are old public-domain works (Bach, Pachelbel, Satie, Beethoven), written out in simplified form.

export type SoundtrackStyle = 'overworld' | 'phonk' | 'arcade' | 'classical';
/** The built-in styles, or the playlist of real song files in public/music (see playlist.ts). */
export type AnySoundtrack = SoundtrackStyle | 'playlist';
export const SOUNDTRACKS: Array<{ value: SoundtrackStyle; label: string }> = [
  { value: 'overworld', label: 'Overworld' },
  { value: 'classical', label: 'Classical' },
  { value: 'phonk', label: 'Phonk' },
  { value: 'arcade', label: 'Arcade' },
];

export type Voice = 'piano' | 'pad' | 'pluck' | 'bass' | 'square' | 'tri' | 'kick' | 'snare' | 'hat' | 'cow';
/** One note: starts `t` seconds into the track, lasts `dur` seconds. Drums ignore `midi`. */
export type Ev = { t: number; dur: number; midi: number; v: Voice; vel: number };
export type Track = { name: string; length: number; events: Ev[] };

// ---------------- helpers ----------------
function rng(seed: number) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const NOTE_NAMES: Record<string, number> = { C: 0, 'C#': 1, Db: 1, D: 2, 'D#': 3, Eb: 3, E: 4, F: 5, 'F#': 6, Gb: 6, G: 7, 'G#': 8, Ab: 8, A: 9, 'A#': 10, Bb: 10, B: 11 };
export function noteNumber(name: string): number {
  const m = /^([A-G][#b]?)(-?\d)$/.exec(name);
  if (!m) throw new Error('bad note ' + name);
  return NOTE_NAMES[m[1]] + (parseInt(m[2], 10) + 1) * 12;
}
/** "E4:1 D#4:0.5 R:1" -> notes with durations in beats (R is a rest). */
function parseMelody(src: string): Array<{ midi: number; beats: number }> {
  return src.trim().split(/\s+/).map((tok) => {
    const [n, d] = tok.split(':');
    return { midi: n === 'R' ? -1 : noteNumber(n), beats: parseFloat(d) };
  });
}
function addMelody(out: Ev[], list: Array<{ midi: number; beats: number }>, start: number, beat: number, v: Voice, vel: number, sustain = 1.1) {
  let t = start;
  for (const n of list) {
    if (n.midi >= 0) out.push({ t, dur: n.beats * beat * sustain, midi: n.midi, v, vel });
    t += n.beats * beat;
  }
  return t;
}
const sorted = (events: Ev[]) => events.sort((a, b) => a.t - b.t);

// ---------------- classical ----------------
function bachPrelude(): Track {
  // C major prelude (BWV 846): every measure is five notes played as 1 2 3 4 5 3 4 5, twice
  const bars = [
    [60, 64, 67, 72, 76], [60, 62, 69, 74, 77], [59, 62, 67, 74, 77], [60, 64, 67, 72, 76],
    [60, 64, 69, 76, 81], [60, 62, 66, 69, 74], [59, 62, 67, 74, 79], [59, 60, 64, 67, 72],
    [57, 60, 64, 67, 72], [50, 57, 62, 66, 72], [55, 59, 62, 67, 71], [55, 58, 64, 67, 73],
    [53, 57, 62, 69, 74], [53, 56, 62, 65, 71], [52, 55, 60, 67, 72], [52, 53, 57, 60, 65],
  ];
  const step = 60 / 70 / 4; // sixteenth notes at 70 beats a minute
  const events: Ev[] = [];
  let t = 0.3;
  for (const b of bars) {
    for (let rep = 0; rep < 2; rep++) {
      for (const k of [0, 1, 2, 3, 4, 2, 3, 4]) {
        events.push({ t, dur: step * 5, midi: b[k], v: 'piano', vel: k === 0 ? 0.5 : 0.36 });
        t += step;
      }
    }
  }
  // the long final chord
  for (const m of [36, 48, 55, 64, 72]) events.push({ t, dur: 5, midi: m, v: 'piano', vel: 0.4 });
  return { name: 'Prelude in C (Bach, simplified)', length: t + 6, events: sorted(events) };
}

function canon(): Track {
  // Pachelbel's Canon: the same eight chords over and over, with a melody that gets busier each time round
  const beat = 60 / 54;
  const bass = [50, 45, 47, 42, 43, 38, 43, 45];
  const chords = [[62, 66, 69], [61, 64, 69], [62, 66, 71], [61, 66, 69], [62, 67, 71], [62, 66, 69], [62, 67, 71], [61, 67, 69]];
  const theme = [78, 76, 74, 73, 71, 69, 71, 73];
  const events: Ev[] = [];
  const cycles = 6, cycleBeats = 16;
  for (let c = 0; c < cycles; c++) {
    for (let i = 0; i < 8; i++) {
      const t0 = 0.3 + (c * cycleBeats + i * 2) * beat;
      events.push({ t: t0, dur: 2.1 * beat, midi: bass[i], v: 'piano', vel: 0.5 });
      if (c >= 1) for (let b = 0; b < 2; b++) for (const n of chords[i]) events.push({ t: t0 + b * beat + (n % 3) * 0.015, dur: beat * 1.05, midi: n - 12, v: 'pad', vel: 0.1 });
      const tone = chords[i];
      if (c === 1 || c === 2) events.push({ t: t0, dur: 2 * beat * 1.1, midi: theme[i], v: 'piano', vel: 0.42 });
      else if (c === 3) for (let q = 0; q < 4; q++) events.push({ t: t0 + q * 0.5 * beat, dur: beat * 0.6, midi: q % 2 ? theme[i] : tone[q % 3] + 12, v: 'piano', vel: 0.34 });
      else if (c >= 4) for (let q = 0; q < 8; q++) events.push({ t: t0 + q * 0.25 * beat, dur: beat * 0.35, midi: [tone[0], tone[1], tone[2], tone[1]][q % 4] + 12 + (q >= 4 ? 12 : 0), v: 'piano', vel: 0.28 });
    }
  }
  const end = 0.3 + cycles * cycleBeats * beat;
  for (const m of [38, 50, 57, 62, 66, 69, 74]) events.push({ t: end, dur: 5, midi: m, v: 'piano', vel: 0.34 });
  return { name: 'Canon in D (Pachelbel, simplified)', length: end + 6, events: sorted(events) };
}

function gymnopedie(): Track {
  // Satie's slow waltz: a low note, then a chord, over and over; the melody floats on top
  const beat = 60 / 66;
  const events: Ev[] = [];
  const bars = 24;
  for (let b = 0; b < bars; b++) {
    const g = b % 2 === 0;
    const t0 = 0.5 + b * 3 * beat;
    events.push({ t: t0, dur: 2.6 * beat, midi: g ? 43 : 50, v: 'piano', vel: 0.5 });
    for (const n of g ? [59, 62, 66] : [57, 61, 66]) events.push({ t: t0 + beat, dur: 2.4 * beat, midi: n, v: 'piano', vel: 0.26 });
  }
  const mel = parseMelody('F#5:2 A5:1 G5:1.5 F#5:0.5 C#5:1 B4:1 C#5:1 D5:1 R:1 E5:1 D5:1 C#5:1 A4:3 F#5:2 A5:1 G5:1.5 F#5:0.5 C#5:1 B4:1 C#5:1 D5:2 R:1 B4:3 D5:1.5 C#5:1.5 A4:3 B4:2 G#4:1 A4:3 F#5:2 A5:1 B5:1.5 A5:0.5 F#5:1 E5:1 F#5:1 D5:2 R:1 A4:3 F#4:3');
  const end = addMelody(events, mel, 0.5 + 4 * 3 * beat, beat, 'piano', 0.46, 1.3);
  return { name: 'Gymnopédie (Satie, simplified)', length: Math.max(end, 0.5 + bars * 3 * beat) + 4, events: sorted(events) };
}

function furElise(): Track {
  // Beethoven's "Für Elise", the first theme
  const eighth = 60 / 76 / 2;
  const seq: Array<[number, number]> = [
    [76, 1], [75, 1], [76, 1], [75, 1], [76, 1], [71, 1], [74, 1], [72, 1], [69, 3], [60, 1], [64, 1], [69, 1], [71, 3], [64, 1], [68, 1], [71, 1], [72, 3],
    [64, 1], [76, 1], [75, 1], [76, 1], [75, 1], [76, 1], [71, 1], [74, 1], [72, 1], [69, 3], [60, 1], [64, 1], [69, 1], [71, 3], [64, 1], [72, 1], [71, 1], [69, 4],
  ];
  const events: Ev[] = [];
  let pos = 0;
  for (const [m, d] of seq) { events.push({ t: 0.4 + pos * eighth, dur: d * eighth * 1.25, midi: m, v: 'piano', vel: 0.46 }); pos += d; }
  // the left hand, three notes a bar from the ninth eighth on
  const harmony: Array<[number, number, number[]]> = [[8, 14, [45, 52, 57]], [14, 20, [40, 47, 52]], [20, 32, [45, 52, 57]], [32, 38, [45, 52, 57]], [38, 44, [40, 47, 52]], [44, 48, [45, 52, 57]]];
  for (const [a, b, n] of harmony) for (let p = a; p < b; p += 3) n.forEach((m, i) => events.push({ t: 0.4 + (p + i) * eighth, dur: eighth * 2, midi: m, v: 'piano', vel: 0.28 }));
  const end = 0.4 + 48 * eighth;
  // then the theme once more, a little softer, with an echo of the chord
  const second = seq.map(([m, d]) => [m, d] as [number, number]);
  let p2 = 0;
  for (const [m, d] of second) { events.push({ t: end + 1.2 + p2 * eighth, dur: d * eighth * 1.25, midi: m, v: 'piano', vel: 0.36 }); p2 += d; }
  for (const m of [33, 45, 52, 57]) events.push({ t: end + 1.2 + 48 * eighth, dur: 4, midi: m, v: 'piano', vel: 0.34 });
  return { name: 'Für Elise (Beethoven)', length: end + 1.2 + 48 * eighth + 5, events: sorted(events) };
}

function odeToJoy(): Track {
  const beat = 60 / 92;
  const events: Ev[] = [];
  const mel = parseMelody(
    'E4:1 E4:1 F4:1 G4:1 G4:1 F4:1 E4:1 D4:1 C4:1 C4:1 D4:1 E4:1 E4:1.5 D4:0.5 D4:2 ' +
    'E4:1 E4:1 F4:1 G4:1 G4:1 F4:1 E4:1 D4:1 C4:1 C4:1 D4:1 E4:1 D4:1.5 C4:0.5 C4:2 ' +
    'D4:1 D4:1 E4:1 C4:1 D4:1 E4:0.5 F4:0.5 E4:1 C4:1 D4:1 E4:0.5 F4:0.5 E4:1 D4:1 C4:1 D4:1 G3:2 ' +
    'E4:1 E4:1 F4:1 G4:1 G4:1 F4:1 E4:1 D4:1 C4:1 C4:1 D4:1 E4:1 D4:1.5 C4:0.5 C4:2');
  const end = addMelody(events, mel, 0.4, beat, 'piano', 0.5, 1.0);
  // chords under it, one a bar (four beats): C G C G ...
  const prog: number[][] = [[48, 52, 55], [43, 47, 50], [48, 52, 55], [43, 47, 50], [48, 52, 55], [43, 47, 50], [48, 52, 55], [43, 47, 50]];
  const total = Math.ceil((end - 0.4) / (beat * 4));
  for (let b = 0; b < total; b++) {
    const ch = prog[b % prog.length];
    ch.forEach((m, i) => events.push({ t: 0.4 + b * 4 * beat + i * 0.02, dur: beat * 3.8, midi: m, v: 'pad', vel: 0.1 }));
    events.push({ t: 0.4 + b * 4 * beat, dur: beat * 2, midi: ch[0] - 12, v: 'piano', vel: 0.34 });
  }
  return { name: 'Ode to Joy (Beethoven)', length: end + 3, events: sorted(events) };
}

// ---------------- overworld: calm, wandering music ----------------
const MAJOR = [0, 2, 4, 5, 7, 9, 11];
const PENTA = [0, 2, 4, 7, 9];
const DORIAN = [0, 2, 3, 5, 7, 9, 10];
function overworld(i: number): Track {
  const defs = [
    { name: 'Meadow', root: 60, scale: PENTA, prog: [0, 3, 4, 0, 5, 3, 4, 0], bpm: 66, seed: 11 },
    { name: 'Daybreak', root: 62, scale: MAJOR, prog: [0, 4, 5, 3, 0, 4, 3, 4], bpm: 72, seed: 23 },
    { name: 'Quiet Hollow', root: 57, scale: DORIAN, prog: [0, 6, 3, 4, 0, 6, 5, 4], bpm: 60, seed: 37 },
    { name: 'Stargazer', root: 65, scale: PENTA, prog: [0, 5, 3, 4, 0, 5, 4, 0], bpm: 58, seed: 41 },
  ];
  const d = defs[i % defs.length];
  const r = rng(d.seed);
  const beat = 60 / d.bpm;
  const events: Ev[] = [];
  const triad = (deg: number) => [0, 2, 4].map((k) => { const x = deg + k; return d.root - 12 + MAJOR[x % 7] + 12 * Math.floor(x / 7); });
  const chords = 16;
  let lastDeg = 2;
  for (let c = 0; c < chords; c++) {
    const deg = d.prog[c % d.prog.length];
    const t0 = 0.5 + c * 4 * beat;
    const tri = triad(deg);
    tri.forEach((m, k) => events.push({ t: t0 + k * 0.04, dur: 4.4 * beat, midi: m, v: 'pad', vel: 0.12 }));
    events.push({ t: t0, dur: 3 * beat, midi: tri[0] - 12, v: 'tri', vel: 0.2 });
    // a few soft notes of a melody that wanders up and down
    for (let b = 0; b < 8; b++) {
      if (r() < 0.38) continue;
      lastDeg = Math.max(0, Math.min(d.scale.length * 2 - 1, lastDeg + Math.floor(r() * 5) - 2));
      const midi = d.root + d.scale[lastDeg % d.scale.length] + 12 * Math.floor(lastDeg / d.scale.length);
      events.push({ t: t0 + b * 0.5 * beat, dur: beat * (1 + Math.floor(r() * 2)), midi, v: 'piano', vel: 0.3 + r() * 0.12 });
    }
  }
  return { name: d.name, length: 0.5 + chords * 4 * beat + 4, events: sorted(events) };
}

// ---------------- phonk: dark, heavy bass, cowbells ----------------
function phonk(i: number): Track {
  const defs = [
    { name: 'Midnight Drift', root: 41, bpm: 132, seed: 5, riff: [0, 0, 3, 0, 5, 0, 3, 7] },
    { name: 'Neon Trunk', root: 43, bpm: 140, seed: 9, riff: [0, 3, 0, 5, 0, 3, 7, 5] },
    { name: 'Rear View', root: 38, bpm: 128, seed: 17, riff: [0, 0, 7, 0, 5, 3, 0, 10] },
  ];
  const d = defs[i % defs.length];
  const r = rng(d.seed);
  const beat = 60 / d.bpm, sixteenth = beat / 4;
  const events: Ev[] = [];
  const bars = 32;
  for (let b = 0; b < bars; b++) {
    const t0 = 0.3 + b * 4 * beat;
    const hard = b >= 8 && b < 24;
    // kick, snare, hats
    for (const k of [0, 6, 10]) events.push({ t: t0 + k * sixteenth, dur: 0.3, midi: 36, v: 'kick', vel: 0.8 });
    if (b % 4 === 3) events.push({ t: t0 + 14 * sixteenth, dur: 0.3, midi: 36, v: 'kick', vel: 0.7 });
    for (const k of [4, 12]) events.push({ t: t0 + k * sixteenth, dur: 0.2, midi: 38, v: 'snare', vel: 0.6 });
    for (let k = 0; k < 16; k += 2) events.push({ t: t0 + k * sixteenth, dur: 0.06, midi: 42, v: 'hat', vel: k % 4 === 0 ? 0.2 : 0.13 });
    if (b % 4 === 3) for (let k = 12; k < 16; k++) events.push({ t: t0 + k * sixteenth, dur: 0.05, midi: 42, v: 'hat', vel: 0.14 });
    // the 808 bass riff
    for (let k = 0; k < 8; k++) {
      const n = d.riff[k];
      if (k % 2 === 1 && r() < 0.35) continue;
      events.push({ t: t0 + k * 2 * sixteenth, dur: sixteenth * (k % 2 ? 1.6 : 3), midi: d.root + (n > 6 ? n - 12 : n), v: 'bass', vel: 0.62 });
    }
    // the cowbell hook, from the third bar of every four
    if (hard && b % 4 >= 2) for (const [k, n] of [[0, 0], [3, 3], [6, 5], [8, 3], [11, 0]] as Array<[number, number]>) events.push({ t: t0 + k * sixteenth, dur: 0.25, midi: d.root + 36 + n, v: 'cow', vel: 0.22 });
    if (b >= 24 && b % 2 === 0) events.push({ t: t0, dur: 2 * beat, midi: d.root + 24, v: 'pad', vel: 0.1 });
  }
  return { name: d.name, length: 0.3 + bars * 4 * beat + 1.5, events: sorted(events) };
}

// ---------------- arcade: chiptune ----------------
function arcade(i: number): Track {
  const defs = [
    { name: 'Level Up', root: 60, bpm: 156, prog: [0, 5, 3, 4], seed: 2 },
    { name: 'Power Pellet', root: 57, bpm: 168, prog: [5, 3, 0, 4], seed: 6 },
    { name: 'Boss Rush', root: 62, bpm: 176, prog: [0, 0, 5, 4], seed: 8 },
  ];
  const d = defs[i % defs.length];
  const r = rng(d.seed);
  const beat = 60 / d.bpm, eighth = beat / 2;
  const events: Ev[] = [];
  const bars = 32;
  for (let b = 0; b < bars; b++) {
    const deg = d.prog[Math.floor(b / 2) % d.prog.length];
    const t0 = 0.3 + b * 4 * beat;
    const rootNote = d.root - 12 + MAJOR[deg % 7];
    const minor = deg === 5;
    const third = minor ? 3 : 4;
    const tones = [0, third, 7, 12];
    for (let k = 0; k < 8; k++) events.push({ t: t0 + k * eighth, dur: eighth * 0.9, midi: rootNote - (k % 2 ? 0 : 12) + (k % 4 === 3 ? 12 : 0), v: 'tri', vel: 0.34 });
    const lead = b >= 4;
    for (let k = 0; k < 16; k++) {
      const q = b % 4 === 3 && k >= 12;
      const tone = tones[(q ? 3 - (k % 4) : (k * (b % 2 ? 3 : 1))) % 4];
      if (lead) events.push({ t: t0 + k * eighth / 2, dur: eighth * 0.45, midi: rootNote + 12 + tone + (r() < 0.12 ? 12 : 0), v: 'square', vel: 0.16 });
    }
    for (const k of [0, 4]) events.push({ t: t0 + k * eighth, dur: 0.2, midi: 36, v: 'kick', vel: 0.55 });
    for (const k of [2, 6]) events.push({ t: t0 + k * eighth, dur: 0.12, midi: 38, v: 'snare', vel: 0.28 });
    for (let k = 0; k < 8; k++) events.push({ t: t0 + k * eighth, dur: 0.04, midi: 42, v: 'hat', vel: 0.1 });
  }
  return { name: d.name, length: 0.3 + bars * 4 * beat + 1, events: sorted(events) };
}

const BUILDERS: Record<SoundtrackStyle, Array<() => Track>> = {
  overworld: [0, 1, 2, 3].map((i) => () => overworld(i)),
  classical: [bachPrelude, canon, gymnopedie, furElise, odeToJoy],
  phonk: [0, 1, 2].map((i) => () => phonk(i)),
  arcade: [0, 1, 2].map((i) => () => arcade(i)),
};
export const trackCount = (style: SoundtrackStyle) => BUILDERS[style].length;
export function buildTrack(style: SoundtrackStyle, index: number): Track {
  const list = BUILDERS[style];
  return list[((index % list.length) + list.length) % list.length]();
}

// ---------------- what is playing now (for the settings screen) ----------------
let nowName: string | null = null;
const nowListeners = new Set<() => void>();
export const getNowPlaying = () => nowName;
export function subscribeNowPlaying(f: () => void): () => void { nowListeners.add(f); return () => { nowListeners.delete(f); }; }
function setNow(n: string | null) { if (n !== nowName) { nowName = n; nowListeners.forEach((f) => f()); } }
/** The playlist of real song files reports what is playing through here too. */
export const setNowPlayingName = setNow;

// ---------------- the player ----------------
const hz = (m: number) => 440 * Math.pow(2, (m - 69) / 12);

function noiseBuffer(ctx: AudioContext): AudioBuffer {
  const b = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
  const d = b.getChannelData(0);
  const r = rng(99);
  for (let i = 0; i < d.length; i++) d[i] = r() * 2 - 1;
  return b;
}

function playNote(ctx: AudioContext, dest: AudioNode, noise: AudioBuffer, e: Ev, when: number) {
  const g = ctx.createGain();
  g.connect(dest);
  const end = when + e.dur;
  const osc = (type: OscillatorType, f: number, gain = 1) => {
    const o = ctx.createOscillator();
    o.type = type; o.frequency.value = f;
    if (gain === 1) o.connect(g); else { const gg = ctx.createGain(); gg.gain.value = gain; o.connect(gg).connect(g); }
    return o;
  };
  const stopAt = (os: OscillatorNode[], t: number) => os.forEach((o) => { o.start(when); o.stop(t); });
  const f = hz(e.midi);
  switch (e.v) {
    case 'piano': {
      const rel = Math.min(1.6, 0.35 + e.dur * 0.4);
      g.gain.setValueAtTime(0.0001, when);
      g.gain.linearRampToValueAtTime(e.vel * 0.7, when + 0.006);
      g.gain.exponentialRampToValueAtTime(e.vel * 0.28, when + Math.min(0.9, e.dur * 0.5));
      g.gain.exponentialRampToValueAtTime(0.0001, end + rel);
      stopAt([osc('triangle', f), osc('sine', f * 2, 0.35), osc('sine', f * 3, 0.12), osc('sine', f * 4.01, 0.05)], end + rel + 0.05);
      break;
    }
    case 'pad': {
      g.gain.setValueAtTime(0.0001, when);
      g.gain.linearRampToValueAtTime(e.vel, when + Math.min(0.9, e.dur * 0.4));
      g.gain.linearRampToValueAtTime(0.0001, end + 0.8);
      stopAt([osc('sine', f * 0.998), osc('triangle', f * 1.003, 0.6)], end + 0.85);
      break;
    }
    case 'pluck': {
      g.gain.setValueAtTime(e.vel, when);
      g.gain.exponentialRampToValueAtTime(0.0001, when + Math.max(0.2, e.dur));
      stopAt([osc('triangle', f)], when + Math.max(0.2, e.dur) + 0.05);
      break;
    }
    case 'tri': {
      g.gain.setValueAtTime(e.vel, when);
      g.gain.linearRampToValueAtTime(e.vel * 0.7, when + e.dur * 0.7);
      g.gain.linearRampToValueAtTime(0.0001, end + 0.05);
      stopAt([osc('triangle', f)], end + 0.1);
      break;
    }
    case 'square': {
      g.gain.setValueAtTime(e.vel, when);
      g.gain.linearRampToValueAtTime(0.0001, end + 0.03);
      stopAt([osc('square', f)], end + 0.05);
      break;
    }
    case 'bass': { // an 808: a sine that starts a little high and settles
      const o = ctx.createOscillator();
      o.type = 'sine';
      o.frequency.setValueAtTime(f * 2, when);
      o.frequency.exponentialRampToValueAtTime(f, when + 0.06);
      const dist = ctx.createWaveShaper();
      const curve = new Float32Array(256);
      for (let i = 0; i < 256; i++) { const x = (i / 255) * 2 - 1; curve[i] = Math.tanh(x * 2.2); }
      dist.curve = curve;
      g.gain.setValueAtTime(e.vel, when);
      g.gain.exponentialRampToValueAtTime(0.0001, when + Math.max(0.25, e.dur) + 0.15);
      o.connect(dist).connect(g);
      o.start(when); o.stop(when + Math.max(0.25, e.dur) + 0.2);
      break;
    }
    case 'kick': {
      const o = ctx.createOscillator();
      o.type = 'sine';
      o.frequency.setValueAtTime(150, when);
      o.frequency.exponentialRampToValueAtTime(42, when + 0.14);
      g.gain.setValueAtTime(e.vel, when);
      g.gain.exponentialRampToValueAtTime(0.0001, when + 0.3);
      o.connect(g); o.start(when); o.stop(when + 0.32);
      break;
    }
    case 'snare':
    case 'hat': {
      const src = ctx.createBufferSource();
      src.buffer = noise;
      const filt = ctx.createBiquadFilter();
      filt.type = 'highpass';
      filt.frequency.value = e.v === 'hat' ? 7000 : 1500;
      g.gain.setValueAtTime(e.vel, when);
      g.gain.exponentialRampToValueAtTime(0.0001, when + (e.v === 'hat' ? 0.06 : 0.18));
      src.connect(filt).connect(g);
      src.start(when, Math.random() * 0.5); src.stop(when + 0.2);
      break;
    }
    case 'cow': { // cowbell: two square waves
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass'; bp.frequency.value = 2000; bp.Q.value = 1.4;
      g.gain.setValueAtTime(e.vel, when);
      g.gain.exponentialRampToValueAtTime(0.0001, when + 0.28);
      const a = ctx.createOscillator(), b = ctx.createOscillator();
      a.type = 'square'; b.type = 'square';
      a.frequency.value = f * 1.5; b.frequency.value = f * 2.16;
      a.connect(bp); b.connect(bp); bp.connect(g);
      a.start(when); b.start(when); a.stop(when + 0.3); b.stop(when + 0.3);
      break;
    }
  }
}

/** Plays a soundtrack as a playlist: track after track, in shuffled order, until stopped. */
export class MusicPlayer {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private bus: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  private timer: number | null = null;
  private style: SoundtrackStyle = 'overworld';
  private track: Track | null = null;
  private trackStart = 0;
  private cursor = 0;
  private lastIndex = -1;
  private order: number[] = [];
  private volume = 0.6;
  private onTrack: ((name: string) => void) | null = null;
  playing = false;

  constructor(private getCtx: () => AudioContext) {}

  get currentName(): string | null { return this.track?.name ?? null; }

  start(style: SoundtrackStyle, onTrack?: (name: string) => void) {
    this.halt();
    this.style = style;
    this.onTrack = onTrack ?? null;
    const ctx = this.getCtx();
    if (ctx.state === 'suspended') void ctx.resume();
    this.ctx = ctx;
    this.master = ctx.createGain();
    this.master.gain.value = this.volume;
    this.master.connect(ctx.destination);
    this.noise = noiseBuffer(ctx);
    this.order = [];
    this.lastIndex = -1;
    this.playing = true;
    this.nextTrack(0.2);
    this.timer = window.setInterval(() => this.tick(), 150);
  }

  private pickNext(): number {
    const n = trackCount(this.style);
    if (!this.order.length) {
      // a fresh shuffle; the track that just played does not come first again
      const all = Array.from({ length: n }, (_, i) => i);
      for (let i = n - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [all[i], all[j]] = [all[j], all[i]]; }
      if (n > 1 && all[0] === this.lastIndex) all.push(all.shift()!);
      this.order = all;
    }
    return this.order.shift()!;
  }

  private nextTrack(delay: number) {
    const ctx = this.ctx!;
    const idx = this.pickNext();
    this.lastIndex = idx;
    this.track = buildTrack(this.style, idx);
    this.cursor = 0;
    this.trackStart = ctx.currentTime + delay;
    this.bus = ctx.createGain();
    this.bus.connect(this.master!);
    setNow(this.track.name);
    this.onTrack?.(this.track.name);
  }

  private tick() {
    const ctx = this.ctx, tr = this.track;
    if (!ctx || !tr || !this.bus || !this.noise) return;
    const horizon = ctx.currentTime + 0.9;
    while (this.cursor < tr.events.length && this.trackStart + tr.events[this.cursor].t < horizon) {
      const e = tr.events[this.cursor++];
      const when = Math.max(ctx.currentTime, this.trackStart + e.t);
      try { playNote(ctx, this.bus, this.noise, e, when); } catch { /* a bad note must never stop the music */ }
    }
    if (ctx.currentTime > this.trackStart + tr.length) this.nextTrack(this.style === 'classical' || this.style === 'overworld' ? 2.5 : 0.8);
  }

  pause() { if (this.ctx && this.playing) { void this.ctx.suspend(); this.playing = false; } }
  resume() { if (this.ctx && this.master && !this.playing) { void this.ctx.resume(); this.playing = true; } }
  setVolume(v: number) {
    this.volume = Math.max(0, Math.min(1, v));
    if (this.master && this.ctx) this.master.gain.setTargetAtTime(this.volume, this.ctx.currentTime, 0.03);
  }

  private halt() {
    if (this.timer !== null) { window.clearInterval(this.timer); this.timer = null; }
    const ctx = this.ctx, master = this.master;
    if (ctx && master) {
      try { master.gain.setTargetAtTime(0, ctx.currentTime, 0.04); } catch { /* ignore */ }
      window.setTimeout(() => { try { master.disconnect(); } catch { /* ignore */ } }, 400);
    }
    this.master = null; this.bus = null; this.track = null; this.playing = false;
    setNow(null);
  }
  stop() { this.halt(); }
}
