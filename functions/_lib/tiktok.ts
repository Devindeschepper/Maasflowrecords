import type { Env } from './env';

/**
 * TikTok follower count for the private stats page (TikTok Display API, Login Kit).
 * Needs a TikTok developer app (sandbox mode is enough, with VIN's account as target user):
 *   TIKTOK_CLIENT_KEY / TIKTOK_CLIENT_SECRET - from the app page on developers.tiktok.com (secrets)
 * Each account (VIN, MFR) is connected once with its "Connect" button on /studio-stats/. The login is kept
 * in KV ('tiktok-auth-VIN' / 'tiktok-auth-MFR') and renewed automatically: the access token lasts a day, the refresh token a year
 * and every refresh gives a new one, so the daily cron keeps it alive.
 */
const authKey = (ref: string) => `tiktok-auth-${ref}`;
export const ACCOUNTS = ['VIN', 'MFR'];
const TOKEN_URL = 'https://open.tiktokapis.com/v2/oauth/token/';
export const NOT_CONNECTED = 'TikTok not connected';
/** Thrown when a card is connected with the TikTok account that is already on the other card. */
export const SAME_ACCOUNT = 'same account';

interface TikTokAuth {
  access_token: string;
  refresh_token: string;
  /** ms timestamps */
  expires_at: number;
  refresh_expires_at: number;
  /** TikTok's id for the account (to spot the same account on both cards). */
  open_id?: string;
}

export function tiktokConfigured(env: Env): boolean {
  return !!(env.TIKTOK_CLIENT_KEY?.trim() && env.TIKTOK_CLIENT_SECRET?.trim());
}

export const redirectUri = (origin: string) => `${origin}/api/tiktok/callback`;

/** TikTok login page for one account; the state (remembering which account) is checked again in the callback. */
export async function connectUrl(env: Env, origin: string, ref: string): Promise<string> {
  const state = [...crypto.getRandomValues(new Uint8Array(16))].map((b) => b.toString(16).padStart(2, '0')).join('');
  await env.STUDIO!.put(`tiktok-state-${state}`, ref, { expirationTtl: 600 });
  const q = new URLSearchParams({
    client_key: env.TIKTOK_CLIENT_KEY!.trim(),
    scope: 'user.info.basic,user.info.stats',
    response_type: 'code',
    redirect_uri: redirectUri(origin),
    state,
    // Always show TikTok's page (with "switch account") instead of silently reusing whoever is logged in.
    disable_auto_auth: '1',
  });
  return `https://www.tiktok.com/v2/auth/authorize/?${q}`;
}

/** The account the login was started for, only once (the state is deleted on use); null if unknown. */
export async function takeState(env: Env, state: string): Promise<string | null> {
  if (!/^[a-f0-9]{32}$/.test(state)) return null;
  const key = `tiktok-state-${state}`;
  const ref = await env.STUDIO!.get(key);
  if (!ref || !ACCOUNTS.includes(ref)) return null;
  await env.STUDIO!.delete(key);
  return ref;
}

async function tokenRequest(env: Env, ref: string, params: Record<string, string>, now: number): Promise<TikTokAuth> {
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Cache-Control': 'no-cache' },
    body: new URLSearchParams({ client_key: env.TIKTOK_CLIENT_KEY!.trim(), client_secret: env.TIKTOK_CLIENT_SECRET!.trim(), ...params }),
    signal: AbortSignal.timeout(8000),
  });
  const data = (await res.json().catch(() => ({}))) as {
    access_token?: string; refresh_token?: string; expires_in?: number; refresh_expires_in?: number; open_id?: string; error?: string; error_description?: string;
  };
  if (!data.access_token || !data.refresh_token) throw new Error(data.error_description || data.error || `HTTP ${res.status}`);
  const auth: TikTokAuth = {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_at: now + (data.expires_in ?? 86400) * 1000,
    refresh_expires_at: now + (data.refresh_expires_in ?? 31536000) * 1000,
    open_id: data.open_id,
  };
  return auth;
}

const readAuth = async (env: Env, ref: string) => {
  const raw = await env.STUDIO?.get(authKey(ref));
  return raw ? (JSON.parse(raw) as TikTokAuth) : null;
};

/**
 * Callback: trades the one-time code for tokens and saves them. Refuses the account that is already on the
 * other card. Returns true when this card now shows a different account than before (old counts are wrong then).
 */
export async function exchangeCode(env: Env, ref: string, code: string, origin: string, now = Date.now()): Promise<boolean> {
  const auth = await tokenRequest(env, ref, { code, grant_type: 'authorization_code', redirect_uri: redirectUri(origin) }, now);
  for (const other of ACCOUNTS.filter((a) => a !== ref)) {
    if (auth.open_id && (await readAuth(env, other))?.open_id === auth.open_id) throw new Error(SAME_ACCOUNT);
  }
  const before = await readAuth(env, ref);
  await env.STUDIO!.put(authKey(ref), JSON.stringify(auth));
  return !before || before.open_id !== auth.open_id;
}

export async function tiktokFollowers(env: Env, ref: string, now = Date.now()): Promise<number> {
  let auth = await readAuth(env, ref);
  if (!auth) throw new Error(NOT_CONNECTED);
  if (now > auth.refresh_expires_at) {
    await env.STUDIO!.delete(authKey(ref));
    throw new Error(NOT_CONNECTED);
  }
  if (now > auth.expires_at - 5 * 60 * 1000) {
    try {
      const fresh = await tokenRequest(env, ref, { grant_type: 'refresh_token', refresh_token: auth.refresh_token }, now);
      auth = { ...fresh, open_id: fresh.open_id ?? auth.open_id };
      await env.STUDIO!.put(authKey(ref), JSON.stringify(auth));
    } catch (err) {
      // A revoked or invalid login means VIN has to connect again; anything else is retried later.
      if (/invalid_grant|revoked|expired/i.test(err instanceof Error ? err.message : '')) {
        await env.STUDIO!.delete(authKey(ref));
        throw new Error(NOT_CONNECTED);
      }
      throw err;
    }
  }

  const res = await fetch('https://open.tiktokapis.com/v2/user/info/?fields=open_id,follower_count', {
    headers: { Authorization: `Bearer ${auth.access_token}` },
    signal: AbortSignal.timeout(8000),
  });
  const data = (await res.json().catch(() => ({}))) as { data?: { user?: { open_id?: string; follower_count?: number } }; error?: { code?: string; message?: string } };
  if (data.error?.code === 'scope_not_authorized') throw new Error('Follower count not allowed (add user.info.stats to the app)');
  if (data.error?.code === 'access_token_invalid') {
    await env.STUDIO!.delete(authKey(ref));
    throw new Error(NOT_CONNECTED);
  }
  // Logins saved before the account id was kept get it filled in here.
  const openId = data.data?.user?.open_id;
  if (openId && !auth.open_id) await env.STUDIO!.put(authKey(ref), JSON.stringify({ ...auth, open_id: openId }));
  const n = Number(data.data?.user?.follower_count);
  if (!res.ok || !Number.isFinite(n)) throw new Error(data.error?.message || `HTTP ${res.status}`);
  return n;
}
