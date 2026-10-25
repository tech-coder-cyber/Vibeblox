// Terms of Use and Privacy Policy text (Indev 35.3), the "by playing you agree" notice for new players, and the Settings > About page.
// This is a plain-language draft written for the game. It is not legal advice: have it reviewed before relying on it.
import { useEffect, useState } from 'react';
import { DISCORD_INVITE_URL } from './progression';
import { onCrazyGames } from './crazygames';
import { PLATFORM } from './adEconomy';

const SEEN_KEY = 'vb-legal-seen';

export function LegalText() {
  const accounts = PLATFORM !== 'poki';
  return (
    <div className="text-[#8ea0b8] text-xs leading-relaxed space-y-3" data-testid="legal-text">
      <h3 className="text-white text-sm font-bold">Terms of Use</h3>
      <p>VibeBlox is a free game made by an independent creator. By playing you agree to these terms. If you do not agree, please stop playing.</p>
      <ul className="list-disc pl-5 space-y-1">
        <li>Be kind. No hate, harassment, threats, sexual content, spam, or sharing other people&apos;s private details in chat, names, signs, worlds or servers.</li>
        <li>No cheating tools, exploits, or attacking the game or its servers. We may mute, kick, or ban players who break these rules.</li>
        <li>What you build is yours, but you let us show it to other players inside the game (for example in worlds you host).</li>
        <li>The game is provided as it is, without promises that it is always online or free of bugs. Saves can be lost.</li>
        <li>VibeBlox is a fan-made game inspired by block-building games. It is not made by or connected to any other game company.</li>
      </ul>
      <h3 className="text-white text-sm font-bold pt-1">Privacy Policy</h3>
      <p><b>What we keep.</b> {accounts ? 'If you make or use an account we keep your username, your account email (or, on CrazyGames, your CrazyGames user id and name), your level, coins, friends and the private messages you send. ' : ''}Chat you send in multiplayer is seen by the other players in that game. Your settings, skins and world saves are stored in your browser{onCrazyGames ? ' and, when you are logged in to CrazyGames, in your CrazyGames account so they follow you between devices' : ''}.</p>
      <p><b>What we do not do.</b> We do not sell your data. We do not ask for your real name, address or phone number. Please do not type them in chat.</p>
      <p><b>Ads and partners.</b> {PLATFORM === 'web' ? 'This site may show ads. ' : 'The platform that hosts this game (' + (PLATFORM === 'crazygames' ? 'CrazyGames' : 'Poki') + ') shows the ads and has its own privacy policy that applies to you there. '}Ad providers may use cookies or similar technology under their own policies.</p>
      <p><b>Children.</b> If you are young, ask a parent or guardian before creating an account or chatting with others.</p>
      <p><b>Your choices.</b> {accounts ? 'You can delete your account in Settings > Account; this removes your profile, friends, messages and ranks. ' : ''}You can clear your saves by clearing this site&apos;s data in your browser.</p>
      <p><b>Contact.</b> Questions or requests about your data: join the VibeBlox Discord{PLATFORM === 'poki' ? '' : <> (<a className="underline text-[#00e676]" href={DISCORD_INVITE_URL} target="_blank" rel="noopener noreferrer">{DISCORD_INVITE_URL}</a>)</>} and message the owner.</p>
    </div>
  );
}

export function LegalModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/70 p-4" data-testid="legal-modal" onClick={onClose}>
      <div className="bg-[#121822] border border-[#243044] rounded-2xl p-6 max-w-lg w-full max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <LegalText />
        <button onClick={onClose} data-testid="legal-close" className="mt-4 px-4 py-2 rounded-lg bg-[#00e676] text-[#0a0e14] text-xs font-bold">Close</button>
      </div>
    </div>
  );
}

/** A small, non-blocking strip shown once to new players. It never covers the game or stops anything. */
export function LegalFirstVisit() {
  const [show, setShow] = useState(false);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    let seen = false;
    try { seen = localStorage.getItem(SEEN_KEY) === '1'; } catch { /* private mode */ }
    if (!seen) setShow(true);
  }, []);
  function dismiss() { setShow(false); try { localStorage.setItem(SEEN_KEY, '1'); } catch { /* ignore */ } }
  if (!show) return open ? <LegalModal onClose={() => setOpen(false)} /> : null;
  return (
    <>
      <div className="fixed bottom-2 left-2 right-2 sm:left-auto sm:right-3 sm:max-w-sm z-[250] bg-[#0a0e14]/95 border border-[#243044] rounded-xl px-3 py-2 text-[11px] text-[#8ea0b8] flex items-center gap-2" data-testid="legal-banner">
        <span className="flex-1">By playing VibeBlox you agree to our <button className="underline text-[#00e676]" onClick={() => setOpen(true)} data-testid="legal-open">Terms of Use and Privacy Policy</button>.</span>
        <button onClick={dismiss} data-testid="legal-ok" className="px-2 py-1 rounded-md bg-[#00e676] text-[#0a0e14] font-bold">OK</button>
      </div>
      {open && <LegalModal onClose={() => setOpen(false)} />}
    </>
  );
}
