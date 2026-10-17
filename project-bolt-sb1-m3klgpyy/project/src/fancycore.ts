// Miniblox-style coloured text: \green\\shiny\ Hello world!
//
// Codes sit between backslashes and apply to the text after them (until \reset\):
//   colours   \red\ \gold\ \aqua\ ... or any hex colour \#ff8800\
//   styles    \bold\ \italic\ \underline\ \strike\
//   effects   \shiny\ \rainbow\ \neon\ \toxic\ \pristine\ \glitched\ \wave\ \shake\ \pulse\ \flair\
//   fonts     \serif\ \mono\ \cursive\ \comic\ \impact\ \pixel\ \retro\
// Anything between backslashes that is not a code stays exactly as typed.
// (the part with no React in it, so the 3D engine can use it too)
export const MC_COLORS: Record<string, string> = {
  black: '#000000', dark_blue: '#0000aa', dark_green: '#00aa00', dark_aqua: '#00aaaa', dark_red: '#aa0000', dark_purple: '#aa00aa',
  gold: '#ffaa00', gray: '#aaaaaa', grey: '#aaaaaa', dark_gray: '#555555', blue: '#5555ff', green: '#55ff55', lime: '#55ff55', aqua: '#55ffff',
  red: '#ff5555', light_purple: '#ff55ff', pink: '#ff77cc', yellow: '#ffff55', white: '#ffffff', orange: '#ff9933',
  cyan: '#22e6e6', purple: '#a64dff', magenta: '#ff2bd6', brown: '#a0683a', silver: '#d0d4dc', mint: '#7dffc4', sky: '#6ec6ff', crimson: '#dc143c',
};
export const FANCY_EFFECTS = ['shiny', 'rainbow', 'neon', 'toxic', 'pristine', 'glitched', 'wave', 'shake', 'pulse', 'flair'] as const;
export type FancyEffect = (typeof FANCY_EFFECTS)[number];
export const FANCY_STYLES = ['bold', 'italic', 'underline', 'strike'] as const;
export const FANCY_FONTS: Record<string, string> = {
  serif: 'Georgia, "Times New Roman", serif',
  mono: '"Courier New", Consolas, monospace',
  cursive: '"Brush Script MT", "Segoe Script", cursive',
  comic: '"Comic Sans MS", "Comic Neue", cursive',
  impact: 'Impact, "Arial Black", sans-serif',
  pixel: '"Press Start 2P", "Courier New", monospace',
  retro: 'var(--font-retro, "Press Start 2P", monospace)',
};
export const ALIASES: Record<string, string> = { glitch: 'glitched', glitchy: 'glitched', fancy: 'cursive', strikethrough: 'strike', underlined: 'underline', shine: 'shiny', gradient: 'rainbow' };
const HEX = /^#[0-9a-fA-F]{6}$/;

export type FancyStyle = {
  color?: string; bold: boolean; italic: boolean; underline: boolean; strike: boolean; font?: string; fx: FancyEffect[];
};
export type FancySeg = { text: string; style: FancyStyle };
const blank = (color?: string): FancyStyle => ({ color, bold: false, italic: false, underline: false, strike: false, fx: [] });

/** Is this word (the bit between two backslashes) one of our codes? */
export function isFancyCode(word: string): boolean {
  const w = ALIASES[word.toLowerCase()] ?? word.toLowerCase();
  return w === 'reset' || HEX.test(word) || !!MC_COLORS[w] || (FANCY_EFFECTS as readonly string[]).includes(w) || (FANCY_STYLES as readonly string[]).includes(w) || !!FANCY_FONTS[w];
}

/** Splits text into pieces that each have one style. Unknown codes stay as plain text. */
export function parseFancy(text: string, baseColor?: string): FancySeg[] {
  const segs: FancySeg[] = [];
  let st = blank(baseColor);
  let last = 0;
  const push = (t: string) => { if (t) segs.push({ text: t, style: st }); };
  const re = /\\([A-Za-z_#0-9]{2,16})\\/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    const word = m[1];
    if (!isFancyCode(word)) { re.lastIndex = m.index + 1; continue; } // not a code: the first backslash is just text
    push(text.slice(last, m.index));
    const w = ALIASES[word.toLowerCase()] ?? word.toLowerCase();
    if (w === 'reset') st = blank(baseColor);
    else if (HEX.test(word)) st = { ...st, color: word.toLowerCase() };
    else if (MC_COLORS[w]) st = { ...st, color: MC_COLORS[w] };
    else if (w === 'bold') st = { ...st, bold: true };
    else if (w === 'italic') st = { ...st, italic: true };
    else if (w === 'underline') st = { ...st, underline: true };
    else if (w === 'strike') st = { ...st, strike: true };
    else if (FANCY_FONTS[w]) st = { ...st, font: w };
    else if (!st.fx.includes(w as FancyEffect)) st = { ...st, fx: [...st.fx, w as FancyEffect] };
    last = re.lastIndex;
  }
  push(text.slice(last));
  return segs;
}
/** The words without any codes (for places that can't show colour, like the Esc menu or the ban list's search). */
export function stripFancy(text: string): string { return parseFancy(text).map((s) => s.text).join(''); }
/** Is there any code in here at all? */
export function hasFancy(text: string): boolean { return /\\[A-Za-z_#0-9]{2,16}\\/.test(text) && parseFancy(text).some((s) => s.style.color || s.style.fx.length || s.style.bold || s.style.italic || s.style.underline || s.style.strike || s.style.font); }

export const GLITCH_CHARS = '!@#$%^&*?<>/|~+=';
export const rndGlitch = () => GLITCH_CHARS[Math.floor(Math.random() * GLITCH_CHARS.length)];
/** The text with some letters swapped for symbols, different every call. */
export function glitchText(text: string, amount = 0.3): string {
  let out = '';
  for (const ch of text) out += ch !== ' ' && Math.random() < amount ? rndGlitch() : ch;
  return out;
}

// ---- drawing it on a canvas (name tags in the 3D world): a still picture of the animated text ----
export function drawFancy(ctx: CanvasRenderingContext2D, text: string, cx: number, cy: number, size: number, baseColor = '#ffffff', t = 0): number {
  const segs = parseFancy(text, baseColor);
  const pieces: Array<{ ch: string; font: string; fill: string; glow?: string; w: number }> = [];
  let idx = 0;
  for (const s of segs) {
    const fam = s.style.font ? FANCY_FONTS[s.style.font].replace(/var\([^)]*\)/, 'monospace') : 'sans-serif';
    const font = `${s.style.italic ? 'italic ' : ''}${s.style.bold ? 'bold ' : 'bold '}${size}px ${fam}`;
    const glitched = s.style.fx.includes('glitched');
    for (const ch0 of [...s.text]) {
      const ch = glitched && ch0 !== ' ' && Math.random() < 0.3 ? rndGlitch() : ch0;
      let fill = s.style.color ?? baseColor, glow: string | undefined;
      const fx = s.style.fx;
      if (fx.includes('rainbow') || fx.includes('flair')) fill = `hsl(${((idx * 28 + t * 120) % 360)},90%,62%)`;
      if (fx.includes('neon')) { fill = s.style.color ?? '#4dfff2'; glow = fill; }
      if (fx.includes('toxic')) { fill = '#b6ff00'; glow = '#6bff00'; }
      if (fx.includes('pristine')) { fill = '#eaf8ff'; glow = '#bfe9ff'; }
      if (fx.includes('shiny') && idx % 5 === Math.floor(t * 4) % 5) fill = '#ffffff';
      ctx.font = font;
      pieces.push({ ch, font, fill, glow, w: ctx.measureText(ch).width });
      idx++;
    }
  }
  const total = pieces.reduce((n, p) => n + p.w, 0);
  let x = cx - total / 2;
  ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
  for (const p of pieces) {
    ctx.font = p.font; ctx.shadowBlur = p.glow ? 10 : 0; ctx.shadowColor = p.glow ?? 'transparent';
    ctx.fillStyle = p.fill; ctx.fillText(p.ch, x, cy);
    x += p.w;
  }
  ctx.shadowBlur = 0;
  return total; // how wide it came out, so callers can fit a background or shrink the text
}

