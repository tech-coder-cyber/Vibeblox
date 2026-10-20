// @ts-nocheck
// The chat filter. It hides bad words, and ONLY the bad word: "you are a f***ing noob" keeps the rest of the sentence.
// Mild, crude language (damn, hell, crap, ass, piss, suck, bastard, wtf...) is allowed on purpose.
//
// This file is plain JavaScript (no type syntax) so that server/server.js can carry an identical copy:
// `node server/make-pack.mjs` pastes it into the server between the PROFANITY markers. Edit it HERE only.
//
// How a word is judged: the word is lower-cased, look-alike symbols are turned back into letters (5hit, @ss, $h!t), and
// separators inside the word are ignored (f.u.c.k, f-u-c-k), and stretched letters count (fuuuuck). Then:
//   STRONG: the bad word may sit anywhere inside the word      (fucking, motherfucker, bullshit)
//   EXACT:  only the word itself, plus -s -ed -ing -er          (cock, dick, cum, tits)
// A short list of innocent words that happen to contain a strong word is never touched (Scunthorpe, shiitake, snigger...).

/* PROFANITY_BEGIN */
const PROFANITY_STRONG = [
  'fuck', 'shit', 'bitch', 'cunt', 'twat', 'whore', 'slut', 'pussy', 'pussi', 'bollock', 'dildo', 'blowjob', 'handjob', 'jerkoff', 'asshole', 'arsehole',
  'dickhead', 'cocksuck', 'retard', 'nigg', 'faggot', 'nazi', 'porn', 'molest', 'rapist', 'pedophile', 'paedophile', 'cumshot', 'orgasm',
];
const PROFANITY_EXACT = [
  'cock', 'dick', 'cum', 'tit', 'anal', 'wank', 'wanker', 'wanking', 'fag', 'tranny', 'kike', 'spic', 'chink', 'gook', 'coon', 'paki', 'rape', 'pedo', 'kys',
  'fck', 'fuk', 'fuq', 'fvck', 'fcuk', 'phuck', 'phuk', 'sht', 'shyt', 'btch', 'biatch', 'bytch', 'cnt', 'dik', 'pusy', 'jizz', 'ahole',
];
const PROFANITY_SAFE = [
  'scunthorpe', 'shiitake', 'shiitakes', 'shitake', 'shitakes', 'shiite', 'shiites', 'snigger', 'sniggers', 'sniggering', 'sniggered', 'niggle', 'niggles', 'niggled', 'niggling',
  'retardant', 'retardants', 'therapist', 'therapists', 'therapy',
];
const PROFANITY_LEET = { '0': 'o', '1': 'i', '3': 'e', '4': 'a', '5': 's', '7': 't', '8': 'b', '@': 'a', '$': 's', '!': 'i', '|': 'i', '+': 't', '€': 'e', '£': 'l', 'á': 'a', 'à': 'a', 'ä': 'a', 'é': 'e', 'è': 'e', 'í': 'i', 'ó': 'o', 'ö': 'o', 'ú': 'u', 'ü': 'u' };
/** One letter of a bad word as a pattern: a single letter may be stretched (fuuuck); a doubled letter must stay doubled (niGGer is not Niger). */
function profanityPattern(word) {
  let out = '';
  for (let i = 0; i < word.length;) {
    let j = i;
    while (j < word.length && word[j] === word[i]) j++;
    out += word[i] + (j - i > 1 ? '{' + (j - i) + ',}' : '+');
    i = j;
  }
  return out;
}
let profanityRules = null;
function profanityBuild() {
  if (profanityRules) return profanityRules;
  const strong = new RegExp(PROFANITY_STRONG.map(profanityPattern).join('|'));
  const exact = new RegExp('^(?:' + PROFANITY_EXACT.map(profanityPattern).join('|') + ')(?:s|es|ed|ing|er|ers)?$');
  profanityRules = { strong, exact };
  return profanityRules;
}
/** The letters of a chunk of text, look-alikes turned back into letters, everything else dropped. */
const PROFANITY_EDGE = /^[.,;:!?'"()\[\]{}<>~*_\-\/\\]+|[.,;:!?'"()\[\]{}<>~*_\-\/\\]+$/g;
function profanityLetters(chunk) {
  let out = '';
  for (const ch of chunk.replace(PROFANITY_EDGE, '').toLowerCase()) {
    const c = PROFANITY_LEET[ch] || ch;
    if (c >= 'a' && c <= 'z') out += c;
  }
  return out;
}
/** Is this one word (no spaces) a bad word? */
function profanityWordIsBad(word) {
  const letters = profanityLetters(word);
  if (letters.length < 3) return false;
  const squeezed = letters.replace(/(.)\1+/g, '$1');
  const lower = word.toLowerCase().replace(/[^a-z]/g, '');
  if (PROFANITY_SAFE.indexOf(lower) >= 0 || PROFANITY_SAFE.indexOf(letters) >= 0 || PROFANITY_SAFE.indexOf(squeezed) >= 0) return false;
  const r = profanityBuild();
  if (r.exact.test(letters)) return true;
  if (r.strong.test(letters)) {
    // a safe word hiding inside a longer word ("scunthorpes", "cocktails") is still safe
    for (let i = 0; i < PROFANITY_SAFE.length; i++) if (PROFANITY_SAFE[i].length >= 5 && letters.indexOf(PROFANITY_SAFE[i]) >= 0 && !r.strong.test(letters.split(PROFANITY_SAFE[i]).join(''))) return false;
    return true;
  }
  return false;
}
/** Hides every bad word in a message with * (same length). Everything else, including mild language, is left alone. */
function filterProfanity(text) {
  if (typeof text !== 'string' || text.length < 3) return text;
  const parts = text.split(/(\s+)/); // words and the spaces between them
  const bad = new Array(parts.length).fill(false);
  for (let i = 0; i < parts.length; i += 2) if (parts[i] && profanityWordIsBad(parts[i])) bad[i] = true;
  // letters spread out with spaces: "f u c k"
  for (let i = 0; i < parts.length;) {
    if (bad[i] || parts[i].length !== 1 || !/[a-z0-9@$!|+]/i.test(parts[i])) { i += 2; continue; }
    let j = i, joined = '';
    while (j < parts.length && parts[j].length === 1 && /[a-z0-9@$!|+]/i.test(parts[j])) { joined += parts[j]; j += 2; }
    if (joined.length >= 4 && profanityWordIsBad(joined)) for (let k = i; k < j; k += 2) bad[k] = true;
    i = Math.max(j, i + 2);
  }
  let changed = false;
  for (let i = 0; i < parts.length; i += 2) {
    if (!bad[i]) continue;
    // keep punctuation around the word ("fuck!", "(shit)"), star the word itself
    parts[i] = parts[i].replace(/^([.,;:!?'"()\[\]{}<>~_\-\/\\]*)(.*?)([.,;:!?'"()\[\]{}<>~_\-\/\\]*)$/s, (m, a, w, z) => a + '*'.repeat(Math.max(1, w.length)) + z);
    changed = true;
  }
  return changed ? parts.join('') : text;
}
/** Does the message contain a bad word? */
function hasProfanity(text) { return typeof text === 'string' && filterProfanity(text) !== text; }
/* PROFANITY_END */

export { filterProfanity, hasProfanity };
