// Ads, plus which portal we're running on.
//
//  - On CrazyGames and Poki ads come from their own SDKs (both portals forbid any other ad network).
//  - On vibeblox.online (or any other site) ads come from Google AdSense "Ads for games" (adBreak).
//    It stays switched off until you give it your publisher id:  VITE_ADSENSE_CLIENT=ca-pub-1234567890123456
//    (see ADS_SETUP.md). Without it, triggerRewardedAd() resolves false and the shop shows the ad buttons as unavailable.
//  - Players with a rank (and the owner) never see an ad: App calls setAdsBlocked(true) for them.
//
// The portal is detected from the page/iframe address. For a Poki upload you can also force
// it at build time:  VITE_PLATFORM=poki npm run build   (or crazygames / web)

/* eslint-disable @typescript-eslint/no-explicit-any */
export type Platform = 'poki' | 'crazygames' | 'web';

function detectPlatform(): Platform {
  const forced = String((import.meta as any).env?.VITE_PLATFORM ?? '').toLowerCase();
  if (forced === 'poki' || forced === 'crazygames' || forced === 'web') return forced;
  if (typeof window === 'undefined') return 'web';
  let where = `${location.hostname} ${document.referrer}`;
  try { const ao = (location as any).ancestorOrigins; if (ao) where += ' ' + Array.from(ao as ArrayLike<string>).join(' '); } catch { /* not supported */ }
  where = where.toLowerCase();
  if (where.includes('poki')) return 'poki';
  if (where.includes('crazygames')) return 'crazygames';
  return 'web';
}

export const PLATFORM: Platform = detectPlatform();
/** Poki forbids every outgoing link. CrazyGames allows community links (Discord) on menus. */
export const CAN_LINK_OUT = PLATFORM !== 'poki';
/** Real-money purchases (Tebex ranks) only on our own site: Poki allows none, CrazyGames requires its own Xsolla account. */
export const CAN_SELL_RANKS = PLATFORM === 'web';
const env = ((import.meta as any).env ?? {}) as Record<string, string | undefined>;
/** Your AdSense publisher id (ca-pub-...), set at build time. */
export const ADSENSE_CLIENT = String(env.VITE_ADSENSE_CLIENT ?? '').trim();
/** "on" shows Google's test ads (they never earn money): the default while running on localhost, or with VITE_ADSENSE_TEST=1. */
const ADSENSE_TEST = env.VITE_ADSENSE_TEST === '1' || (typeof location !== 'undefined' && /^(localhost|127\.|\[::1\])/.test(location.hostname));
export const ADSENSE_ON = PLATFORM === 'web' && /^ca-pub-\d{8,24}$/.test(ADSENSE_CLIENT);
/** Ads exist through a portal SDK, or through AdSense on our own site once it is set up. */
export const ADS_POSSIBLE = PLATFORM !== 'web' || ADSENSE_ON;

let adsBlocked = false;
/** Players with a rank never see ads. */
export function setAdsBlocked(blocked: boolean) { adsBlocked = blocked; }
export const adsAreBlocked = () => adsBlocked;

const w = (typeof window !== 'undefined' ? window : {}) as any;

function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = src; s.async = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error('Could not load ' + src));
    document.head.appendChild(s);
  });
}

let ready: Promise<boolean> | null = null;
/** Loads and starts the portal SDK once. Resolves true if ads can be shown. */
export function initAds(): Promise<boolean> {
  if (ready) return ready;
  ready = (async () => {
    try {
      if (PLATFORM === 'poki') {
        if (!w.PokiSDK) await loadScript('https://game-cdn.poki.com/scripts/v2/poki-sdk.js');
        await w.PokiSDK.init();
        return true;
      }
      if (PLATFORM === 'crazygames') {
        if (!w.CrazyGames?.SDK) await loadScript('https://sdk.crazygames.com/crazygames-sdk-v3.js');
        await w.CrazyGames.SDK.init();
        return true;
      }
      if (ADSENSE_ON) {
        // Google AdSense "Ads for games": the script adds adBreak()/adConfig() to the page
        w.adsbygoogle = w.adsbygoogle || [];
        w.adBreak = w.adConfig = (o: unknown) => { w.adsbygoogle.push(o); };
        scriptState = 'loading';
        await new Promise<void>((resolve, reject) => {
          const s = document.createElement('script');
          s.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${encodeURIComponent(ADSENSE_CLIENT)}`;
          s.async = true; s.crossOrigin = 'anonymous';
          s.setAttribute('data-ad-client', ADSENSE_CLIENT);
          if (ADSENSE_TEST) s.setAttribute('data-adbreak-test', 'on');
          s.onload = () => { scriptState = 'loaded'; resolve(); };
          s.onerror = () => { scriptState = 'blocked'; reject(new Error('AdSense is blocked or unreachable')); };
          document.head.appendChild(s);
        });
        w.adConfig({ preloadAdBreaks: 'on', sound: 'on' });
        return true;
      }
    } catch (e) {
      console.warn('[ads] ads unavailable:', e);
    }
    return false;
  })();
  return ready;
}

let adRunning = false;

// ---------------- Why ads do or don't show (the admin panel shows this) ----------------
let scriptState: 'not loaded' | 'loading' | 'loaded' | 'blocked' = 'not loaded';
let lastResult = '';
/** What happened to the last ad: "viewed", "dismissed", "notReady" (no ad to show yet), "frequencyCapped", "error"... */
export const lastAdResult = () => lastResult;
export type AdStatus = { platform: Platform; configured: boolean; testMode: boolean; script: string; lastResult: string; blockedForYou: boolean; problems: string[] };
export function adStatus(): AdStatus {
  const problems: string[] = [];
  if (PLATFORM === 'web') {
    if (!ADSENSE_CLIENT) problems.push('No AdSense publisher id: add VITE_ADSENSE_CLIENT=ca-pub-... to the build settings (Cloudflare Pages > Settings > Environment variables), then redeploy.');
    else if (!ADSENSE_ON) problems.push(`VITE_ADSENSE_CLIENT "${ADSENSE_CLIENT}" doesn't look like a publisher id (it should be ca-pub- followed by 16 digits).`);
    if (scriptState === 'blocked') problems.push('The AdSense script could not load (an ad blocker, or the site is not approved yet).');
    if (lastResult === 'notReady' || lastResult === 'noAdPreloaded') problems.push('Google had no ad ready. New sites often get no ads until AdSense approves them for "Ads for games" (H5 games ads), and ads can take a while to start.');
    if (lastResult === 'frequencyCapped') problems.push('Google is limiting how often ads show (frequency cap). Try again in a few minutes.');
    if (lastResult === 'invalid' || lastResult === 'error') problems.push('Google rejected the ad request. Check that ads.txt is in the public folder and the site is approved in AdSense.');
  }
  if (adsBlocked) problems.push('Ads are switched off for you: the owner and players with a rank never see ads (they get the rewards without one).');
  return { platform: PLATFORM, configured: PLATFORM !== 'web' || ADSENSE_ON, testMode: ADSENSE_TEST, script: scriptState, lastResult, blockedForYou: adsBlocked, problems };
}
/**
 * Shows a rewarded ad. Resolves true only if the player watched it to the end
 * (give the reward then), false if it was skipped, failed, or ads aren't available.
 * onStart/onEnd: mute and pause the game while the ad plays.
 */
export async function triggerRewardedAd(hooks: { onStart?: () => void; onEnd?: () => void } = {}): Promise<boolean> {
  if (adsBlocked || adRunning || !(await initAds())) return false;
  adRunning = true;
  hooks.onStart?.();
  try {
    if (PLATFORM === 'web') {
      return await new Promise<boolean>((resolve) => {
        let viewed = false;
        w.adBreak({
          type: 'reward', name: 'vb-reward',
          beforeReward: (showAd: () => void) => showAd(), // the player pressed the button, so show it right away
          adViewed: () => { viewed = true; },
          adDismissed: () => {},
          adBreakDone: (info?: { breakStatus?: string }) => { lastResult = info?.breakStatus ?? (viewed ? 'viewed' : 'unknown'); resolve(viewed); }, // also fires when there was no ad to show
        });
        setTimeout(() => resolve(viewed), 120_000); // never leave the shop stuck
      });
    }
    if (PLATFORM === 'poki') { const ok = !!(await w.PokiSDK.rewardedBreak()); lastResult = ok ? 'viewed' : 'notReady'; return ok; }
    return await new Promise<boolean>((resolve) => {
      w.CrazyGames.SDK.ad.requestAd('rewarded', {
        adStarted: () => {},
        adFinished: () => { lastResult = 'viewed'; resolve(true); },
        adError: (e?: { code?: string }) => { lastResult = e?.code ?? 'error'; resolve(false); }, // also fires when no ad was available
      });
    });
  } catch {
    return false;
  } finally {
    adRunning = false;
    hooks.onEnd?.();
  }
}

// Both portals want to know when the player is actually playing (for ad timing and stats)
let playing = false;
export function setGameplayActive(active: boolean) {
  if (active === playing) return; // the SDKs don't want the same event twice in a row
  playing = active;
  void initAds().then((ok) => {
    if (!ok) return;
    try {
      if (PLATFORM === 'poki') { if (active) w.PokiSDK.gameplayStart(); else w.PokiSDK.gameplayStop(); }
      if (PLATFORM === 'crazygames') { if (active) w.CrazyGames.SDK.game.gameplayStart(); else w.CrazyGames.SDK.game.gameplayStop(); }
    } catch { /* ignore */ }
  });
}

let loadingReported = false;
export function reportLoadingFinished() {
  if (loadingReported) return;
  loadingReported = true;
  void initAds().then((ok) => {
    if (!ok) return;
    try {
      if (PLATFORM === 'poki') w.PokiSDK.gameLoadingFinished();
      if (PLATFORM === 'crazygames') w.CrazyGames.SDK.game.loadingStop?.();
    } catch { /* ignore */ }
  });
}

/** Key/value storage: the player's CrazyGames account when on CrazyGames (synced across devices), else this browser. */
export const portalStorage = {
  get(key: string): string | null {
    try {
      if (PLATFORM === 'crazygames' && w.CrazyGames?.SDK?.data) return w.CrazyGames.SDK.data.getItem(key);
      return localStorage.getItem(key);
    } catch { return null; }
  },
  set(key: string, value: string) {
    try {
      if (PLATFORM === 'crazygames' && w.CrazyGames?.SDK?.data) w.CrazyGames.SDK.data.setItem(key, value);
      localStorage.setItem(key, value); // keep a local copy too
    } catch { /* storage blocked */ }
  },
};

let lastBreakAt = Date.now();
/**
 * A short ad between two parts of the game (leaving a world). At most one every few minutes,
 * never for ranked players, and never twice at once. Resolves true if an ad was shown.
 */
export async function maybeInterstitial(hooks: { onStart?: () => void; onEnd?: () => void } = {}, minGapMs = 4 * 60_000): Promise<boolean> {
  if (adsBlocked || adRunning || !ADS_POSSIBLE || Date.now() - lastBreakAt < minGapMs) return false;
  if (!(await initAds())) return false;
  adRunning = true;
  let shown = false;
  try {
    await new Promise<void>((resolve) => {
      const done = () => resolve();
      setTimeout(done, 60_000);
      if (PLATFORM === 'poki') { hooks.onStart?.(); shown = true; Promise.resolve(w.PokiSDK.commercialBreak()).then(done, done); return; }
      if (PLATFORM === 'crazygames') {
        w.CrazyGames.SDK.ad.requestAd('midgame', { adStarted: () => { shown = true; hooks.onStart?.(); }, adFinished: done, adError: done });
        return;
      }
      w.adBreak({
        type: 'next', name: 'vb-leave-world',
        beforeAd: () => { shown = true; hooks.onStart?.(); },
        afterAd: () => {},
        adBreakDone: (info?: { breakStatus?: string }) => { lastResult = info?.breakStatus ?? lastResult; done(); },
      });
    });
  } catch { /* an ad that fails never matters */ } finally {
    adRunning = false;
    if (shown) { lastBreakAt = Date.now(); hooks.onEnd?.(); }
  }
  return shown;
}
