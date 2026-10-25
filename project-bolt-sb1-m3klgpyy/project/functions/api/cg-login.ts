// CrazyGames automatic login (Indev 35.3). Cloudflare Pages Function: POST /api/cg-login  { token }
//
// The game on CrazyGames asks the CrazyGames SDK for the player's signed token and posts it here. We
//   1. check the token's signature with CrazyGames' public key (RS256) and that it has not expired,
//   2. find or create the player's VibeBlox account (email cg-<id>@cg.vibeblox.online, a password only we can compute),
//   3. sign that account in and return the session tokens, which the game hands to Supabase.
// Uses only WebCrypto + fetch, so it also runs on any other edge host.
//
// Environment variables (Cloudflare Pages > Settings > Variables and Secrets):
//   SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY (secret), CG_LINK_SECRET (secret: a long random string)
//   CG_GAME_ID (optional: your CrazyGames game id; when set, tokens made for other games are refused)

/* eslint-disable @typescript-eslint/no-explicit-any */
export interface Env {
  SUPABASE_URL: string;
  SUPABASE_ANON_KEY: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  CG_LINK_SECRET: string;
  CG_GAME_ID?: string;
}

export const CG_PUBLIC_KEY_URL = 'https://sdk.crazygames.com/publicKey.json';
const EMAIL_DOMAIN = 'cg.vibeblox.online';

const CORS = {
  'access-control-allow-origin': '*', // the game is embedded from crazygames.com and its partner domains; the token itself is the credential
  'access-control-allow-methods': 'POST, OPTIONS',
  'access-control-allow-headers': 'content-type',
  'access-control-max-age': '86400',
};
const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store', ...CORS } });

const b64urlToBytes = (s: string): Uint8Array => {
  const b = atob(s.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(s.length / 4) * 4, '='));
  const out = new Uint8Array(b.length);
  for (let i = 0; i < b.length; i++) out[i] = b.charCodeAt(i);
  return out;
};
const pemToDer = (pem: string): Uint8Array => b64urlToBytes(pem.replace(/-----[A-Z ]+-----/g, '').replace(/\s+/g, '').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''));
const hex = (buf: ArrayBuffer) => [...new Uint8Array(buf)].map((x) => x.toString(16).padStart(2, '0')).join('');

export type CgClaims = { userId: string; gameId?: string; username?: string; profilePictureUrl?: string; iat?: number; exp?: number };

/** Verifies a CrazyGames user token. Throws on any problem. */
export async function verifyCgToken(token: string, publicKeyPem: string, now = Date.now() / 1000, expectedGameId?: string): Promise<CgClaims> {
  const parts = String(token).split('.');
  if (parts.length !== 3) throw new Error('bad token');
  const header = JSON.parse(new TextDecoder().decode(b64urlToBytes(parts[0])));
  if (header.alg !== 'RS256') throw new Error('bad algorithm');
  const key = await crypto.subtle.importKey('spki', pemToDer(publicKeyPem), { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']);
  const ok = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, b64urlToBytes(parts[2]), new TextEncoder().encode(parts[0] + '.' + parts[1]));
  if (!ok) throw new Error('bad signature');
  const c = JSON.parse(new TextDecoder().decode(b64urlToBytes(parts[1]))) as CgClaims;
  if (!c.userId || typeof c.userId !== 'string') throw new Error('no user');
  if (typeof c.exp === 'number' && c.exp < now) throw new Error('expired');
  if (expectedGameId && String(c.gameId) !== String(expectedGameId)) throw new Error('wrong game');
  return c;
}

/** The username we ask for: letters, numbers and underscore, 3-16 characters (the database makes it unique if taken). */
export function wantedName(name: string | undefined, userId: string): string {
  let n = String(name ?? '').replace(/[^A-Za-z0-9_]/g, '').slice(0, 16);
  if (n.length < 3) n = 'CG' + userId.replace(/[^A-Za-z0-9]/g, '').slice(0, 8);
  return n.slice(0, 16);
}

async function linkPassword(secret: string, userId: string): Promise<string> {
  const k = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return hex(await crypto.subtle.sign('HMAC', k, new TextEncoder().encode('cg-link:' + userId)));
}

export async function handleCgLogin(request: Request, env: Env, fetchFn: typeof fetch = (...a) => fetch(...a)): Promise<Response> {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
  if (request.method !== 'POST') return json(405, { error: 'POST only' });
  if (!env.SUPABASE_URL || !env.SUPABASE_ANON_KEY || !env.SUPABASE_SERVICE_ROLE_KEY || !env.CG_LINK_SECRET) return json(500, { error: 'not configured' });

  let token = '';
  try { token = String(((await request.json()) as any)?.token ?? ''); } catch { return json(400, { error: 'bad request' }); }
  if (!token || token.length > 4000) return json(400, { error: 'bad request' });

  let claims: CgClaims;
  try {
    const kr = await fetchFn(CG_PUBLIC_KEY_URL);
    if (!kr.ok) return json(502, { error: 'no public key' });
    const pem = String(((await kr.json()) as any).publicKey ?? '');
    claims = await verifyCgToken(token, pem, Date.now() / 1000, env.CG_GAME_ID);
  } catch (e) {
    return json(401, { error: 'invalid token', detail: String((e as Error).message) });
  }

  const base = env.SUPABASE_URL.replace(/\/+$/, '');
  const email = `cg-${claims.userId.toLowerCase().replace(/[^a-z0-9]/g, '')}@${EMAIL_DOMAIN}`;
  const password = await linkPassword(env.CG_LINK_SECRET, claims.userId);
  const admin = { 'content-type': 'application/json', apikey: env.SUPABASE_SERVICE_ROLE_KEY, authorization: 'Bearer ' + env.SUPABASE_SERVICE_ROLE_KEY };

  // Create the account the first time (an "already registered" answer just means they played before)
  const created = await fetchFn(`${base}/auth/v1/admin/users`, {
    method: 'POST', headers: admin,
    body: JSON.stringify({ email, password, email_confirm: true, user_metadata: { username: wantedName(claims.username, claims.userId), crazygames: true } }),
  });
  if (!created.ok && created.status !== 422 && created.status !== 409) return json(502, { error: 'could not create account' });

  const signin = await fetchFn(`${base}/auth/v1/token?grant_type=password`, {
    method: 'POST', headers: { 'content-type': 'application/json', apikey: env.SUPABASE_ANON_KEY },
    body: JSON.stringify({ email, password }),
  });
  if (!signin.ok) return json(502, { error: 'could not sign in' });
  const s = (await signin.json()) as any;
  if (!s?.access_token || !s?.refresh_token) return json(502, { error: 'could not sign in' });

  let username = '';
  try {
    const pr = await fetchFn(`${base}/rest/v1/profiles?id=eq.${encodeURIComponent(s.user?.id ?? '')}&select=username`, { headers: admin });
    if (pr.ok) username = String(((await pr.json()) as any[])[0]?.username ?? '');
  } catch { /* the game reads the profile itself */ }

  return json(200, { access_token: s.access_token, refresh_token: s.refresh_token, username });
}

// Cloudflare Pages entry points
export const onRequest = (ctx: { request: Request; env: Env }) => handleCgLogin(ctx.request, ctx.env);
