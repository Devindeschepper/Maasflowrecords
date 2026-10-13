import type { Env } from './env';

/**
 * TikTok follower count for the private stats page (TikTok Display API, Login Kit).
 * Needs a TikTok developer app (sandbox mode is enough, with VIN's account as target user):
 *   TIKTOK_CLIENT_KEY / TIKTOK_CLIENT_SECRET - from the app page on developers.tiktok.com (secrets)
 * VIN connects his account once with the "Connect TikTok" button on /studio-stats/. The login is kept
 * in KV ('tiktok-auth') and renewed automatically: the access token lasts a day, the refresh token a year
 * and every refresh gives a new one, so the daily cron keeps it alive.
 */
const AUTH_KEY = 'tiktok-auth';
const TOKEN_URL = 'https://open.tiktokapis.com/v2/oauth/token/';
export const NOT_CONNECTED = 'TikTok not connected';

interface TikTokAuth {
  access_token: string;
  refresh_token: string;
  /** ms timestamps */
  expires_at: number;
  refresh_expires_at: number;
}

export function tiktokConfigured(env: Env): boolean {
  return !!(env.TIKTOK_CLIENT_KEY?.trim() && env.TIKTOK_CLIENT_SECRET?.trim());
}

export const redirectUri = (origin: string) => `${origin}/api/tiktok/callback`;

/** TikTok login page for VIN; the state is checked again in the callback. */
export async function connectUrl(env: Env, origin: string): Promise<string> {
  const state = [...crypto.getRandomValues(new Uint8Array(16))].map((b) => b.toString(16).padStart(2, '0')).join('');
  await env.STUDIO!.put(`tiktok-state-${state}`, '1', { expirationTtl: 600 });
  const q = new URLSearchParams({
    client_key: env.TIKTOK_CLIENT_KEY!.trim(),
    scope: 'user.info.basic,user.info.stats',
    response_type: 'code',
    redirect_uri: redirectUri(origin),
    state,
  });
  return `https://www.tiktok.com/v2/auth/authorize/?${q}`;
}

/** true once (the state is deleted on use). */
export async function takeState(env: Env, state: string): Promise<boolean> {
  if (!/^[a-f0-9]{32}$/.test(state)) return false;
  const key = `tiktok-state-${state}`;
  if (!(await env.STUDIO!.get(key))) return false;
  await env.STUDIO!.delete(key);
  return true;
}

async function tokenRequest(env: Env, params: Record<string, string>, now: number): Promise<TikTokAuth> {
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Cache-Control': 'no-cache' },
    body: new URLSearchParams({ client_key: env.TIKTOK_CLIENT_KEY!.trim(), client_secret: env.TIKTOK_CLIENT_SECRET!.trim(), ...params }),
    signal: AbortSignal.timeout(8000),
  });
  const data = (await res.json().catch(() => ({}))) as {
    access_token?: string; refresh_token?: string; expires_in?: number; refresh_expires_in?: number; error?: string; error_description?: string;
  };
  if (!data.access_token || !data.refresh_token) throw new Error(data.error_description || data.error || `HTTP ${res.status}`);
  const auth: TikTokAuth = {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_at: now + (data.expires_in ?? 86400) * 1000,
    refresh_expires_at: now + (data.refresh_expires_in ?? 31536000) * 1000,
  };
  await env.STUDIO!.put(AUTH_KEY, JSON.stringify(auth));
  return auth;
}

/** Callback: trades the one-time code for tokens and saves them. */
export const exchangeCode = (env: Env, code: string, origin: string, now = Date.now()) =>
  tokenRequest(env, { code, grant_type: 'authorization_code', redirect_uri: redirectUri(origin) }, now);

export async function tiktokFollowers(env: Env, now = Date.now()): Promise<number> {
  const raw = await env.STUDIO?.get(AUTH_KEY);
  if (!raw) throw new Error(NOT_CONNECTED);
  let auth = JSON.parse(raw) as TikTokAuth;
  if (now > auth.refresh_expires_at) {
    await env.STUDIO!.delete(AUTH_KEY);
    throw new Error(NOT_CONNECTED);
  }
  if (now > auth.expires_at - 5 * 60 * 1000) {
    try {
      auth = await tokenRequest(env, { grant_type: 'refresh_token', refresh_token: auth.refresh_token }, now);
    } catch (err) {
      // A revoked or invalid login means VIN has to connect again; anything else is retried later.
      if (/invalid_grant|revoked|expired/i.test(err instanceof Error ? err.message : '')) {
        await env.STUDIO!.delete(AUTH_KEY);
        throw new Error(NOT_CONNECTED);
      }
      throw err;
    }
  }

  const res = await fetch('https://open.tiktokapis.com/v2/user/info/?fields=open_id,follower_count', {
    headers: { Authorization: `Bearer ${auth.access_token}` },
    signal: AbortSignal.timeout(8000),
  });
  const data = (await res.json().catch(() => ({}))) as { data?: { user?: { follower_count?: number } }; error?: { code?: string; message?: string } };
  if (data.error?.code === 'scope_not_authorized') throw new Error('Follower count not allowed (add user.info.stats to the app)');
  if (data.error?.code === 'access_token_invalid') {
    await env.STUDIO!.delete(AUTH_KEY);
    throw new Error(NOT_CONNECTED);
  }
  const n = Number(data.data?.user?.follower_count);
  if (!res.ok || !Number.isFinite(n)) throw new Error(data.error?.message || `HTTP ${res.status}`);
  return n;
}
