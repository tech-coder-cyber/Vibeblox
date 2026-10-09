// Rewarded ads, plus which portal we're running on.
//
// Ads only exist on CrazyGames and Poki, through their own SDKs (both portals forbid any
// other ad network). On vibeblox.online there is no ad provider, so triggerRewardedAd()
// resolves false and the shop shows the ad buttons as unavailable.
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
/** Ads exist only through a portal SDK. */
export const ADS_POSSIBLE = PLATFORM !== 'web';

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
    } catch (e) {
      console.warn('[ads] portal SDK unavailable:', e);
    }
    return false;
  })();
  return ready;
}

let adRunning = false;
/**
 * Shows a rewarded ad. Resolves true only if the player watched it to the end
 * (give the reward then), false if it was skipped, failed, or ads aren't available.
 * onStart/onEnd: mute and pause the game while the ad plays.
 */
export async function triggerRewardedAd(hooks: { onStart?: () => void; onEnd?: () => void } = {}): Promise<boolean> {
  if (adRunning || !(await initAds())) return false;
  adRunning = true;
  hooks.onStart?.();
  try {
    if (PLATFORM === 'poki') return !!(await w.PokiSDK.rewardedBreak());
    return await new Promise<boolean>((resolve) => {
      w.CrazyGames.SDK.ad.requestAd('rewarded', {
        adStarted: () => {},
        adFinished: () => resolve(true),
        adError: () => resolve(false), // also fires when no ad was available
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
