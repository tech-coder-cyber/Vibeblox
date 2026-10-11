// Miniblox-style coloured text: \green\\shiny\ Hello world!
//
// Codes sit between backslashes and apply to the text after them (until \reset\):
//   colours   \red\ \gold\ \aqua\ ... or any hex colour \#ff8800\
//   styles    \bold\ \italic\ \underline\ \strike\
//   effects   \shiny\ \rainbow\ \neon\ \toxic\ \pristine\ \glitched\ \wave\ \shake\ \pulse\ \flair\
//   fonts     \serif\ \mono\ \cursive\ \comic\ \impact\ \pixel\ \retro\
// Anything between backslashes that is not a code stays exactly as typed.
import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from 'react';
import { FANCY_FONTS, glitchText, parseFancy, type FancyEffect, type FancyStyle } from './fancycore';
export * from './fancycore';

// ---- the animations (CSS keyframes, added once) ----
const CSS = `
@keyframes vb-fx-rainbow{0%{color:#ff4d4d}16%{color:#ffb84d}33%{color:#f7ff4d}50%{color:#4dff6a}66%{color:#4dc8ff}83%{color:#b04dff}100%{color:#ff4d4d}}
@keyframes vb-fx-neon{0%,100%{text-shadow:0 0 3px currentColor,0 0 9px currentColor,0 0 22px currentColor,0 0 40px currentColor;opacity:1}46%{opacity:1}50%{text-shadow:0 0 2px currentColor,0 0 5px currentColor;opacity:.78}54%{opacity:1}}
@keyframes vb-fx-toxic{0%,100%{color:#b6ff00;text-shadow:0 0 6px #6bff00,0 2px 0 #1e6a00}50%{color:#4dff3a;text-shadow:0 0 15px #b6ff00,0 3px 0 #1e6a00}}
@keyframes vb-fx-pristine{0%,100%{color:#ffffff;text-shadow:0 0 6px #bfe9ff}50%{color:#bfe9ff;text-shadow:0 0 14px #ffffff,0 0 3px #7fd0ff}}
@keyframes vb-fx-shiny{0%{background-position:160% 0}100%{background-position:-60% 0}}
@keyframes vb-fx-wave{0%,100%{transform:translateY(0)}50%{transform:translateY(-.28em)}}
@keyframes vb-fx-shake{0%{transform:translate(0,0)}25%{transform:translate(.04em,-.05em)}50%{transform:translate(-.05em,.03em)}75%{transform:translate(.03em,.05em)}100%{transform:translate(0,0)}}
@keyframes vb-fx-pulse{0%,100%{opacity:1}50%{opacity:.4}}
`;
let cssAdded = false;
function ensureCss() {
  if (cssAdded || typeof document === 'undefined') return;
  cssAdded = true;
  const el = document.createElement('style');
  el.setAttribute('data-vb-fancy', '1');
  el.textContent = CSS;
  document.head.appendChild(el);
}

const PER_LETTER: FancyEffect[] = ['rainbow', 'wave', 'shake'];
function styleFor(st: FancyStyle, i = 0): CSSProperties {
  const css: CSSProperties = {};
  const anims: string[] = [];
  const fx = st.fx;
  const base = st.color ?? '#ffffff';
  if (st.bold) css.fontWeight = 700;
  if (st.italic) css.fontStyle = 'italic';
  const deco = [st.underline ? 'underline' : '', st.strike ? 'line-through' : ''].filter(Boolean).join(' ');
  if (deco) css.textDecoration = deco;
  if (st.font) css.fontFamily = FANCY_FONTS[st.font];
  css.color = st.color;
  if (fx.includes('flair')) { css.backgroundImage = 'linear-gradient(90deg,#ff5f6d,#ffc371,#5fe05f,#4dd2ff,#b070ff)'; css.WebkitBackgroundClip = 'text'; css.backgroundClip = 'text'; css.color = 'transparent'; css.fontWeight = 700; }
  if (fx.includes('rainbow')) anims.push(`vb-fx-rainbow 2.4s linear ${-i * 0.12}s infinite`);
  if (fx.includes('neon')) { if (!st.color) css.color = '#4dfff2'; anims.push('vb-fx-neon 1.7s ease-in-out infinite'); }
  if (fx.includes('toxic')) anims.push('vb-fx-toxic 1.3s ease-in-out infinite');
  if (fx.includes('pristine')) anims.push('vb-fx-pristine 2.2s ease-in-out infinite');
  if (fx.includes('wave')) { css.display = 'inline-block'; anims.push(`vb-fx-wave 1s ease-in-out ${-i * 0.1}s infinite`); }
  if (fx.includes('shake')) { css.display = 'inline-block'; anims.push(`vb-fx-shake .28s linear ${-(i % 5) * 0.06}s infinite`); }
  if (fx.includes('pulse')) anims.push('vb-fx-pulse 1.2s ease-in-out infinite');
  if (fx.includes('shiny')) {
    css.backgroundImage = `linear-gradient(110deg,${base} 38%,#ffffff 50%,${base} 62%)`;
    css.backgroundSize = '260% 100%';
    css.WebkitBackgroundClip = 'text'; css.backgroundClip = 'text'; css.color = 'transparent';
    anims.push('vb-fx-shiny 2.2s linear infinite');
  }
  if (anims.length) css.animation = anims.join(',');
  return css;
}

function Glitched({ text, style }: { text: string; style: CSSProperties }) {
  const [shown, setShown] = useState(text);
  useEffect(() => {
    setShown(text);
    const id = window.setInterval(() => setShown(glitchText(text, 0.28)), 110);
    return () => window.clearInterval(id);
  }, [text]);
  return <span style={{ ...style, fontFamily: style.fontFamily ?? FANCY_FONTS.mono }} aria-label={text}>{shown}</span>;
}

/** Shows text with its codes applied; `color` is the colour it has before any code. */
export function FancyText({ text, color }: { text: string; color?: string }) {
  ensureCss();
  const segs = useMemo(() => parseFancy(text, color), [text, color]);
  const out: ReactNode[] = [];
  segs.forEach((s, k) => {
    const glitched = s.style.fx.includes('glitched');
    const perLetter = s.style.fx.some((f) => PER_LETTER.includes(f));
    if (glitched) out.push(<Glitched key={k} text={s.text} style={styleFor({ ...s.style, fx: s.style.fx.filter((f) => f !== 'glitched') })} />);
    else if (perLetter) out.push(<span key={k}>{[...s.text].map((ch, i) => <span key={i} style={styleFor(s.style, i)}>{ch === ' ' ? ' ' : ch}</span>)}</span>);
    else out.push(<span key={k} style={styleFor(s.style)}>{s.text}</span>);
  });
  return <>{out}</>;
}
