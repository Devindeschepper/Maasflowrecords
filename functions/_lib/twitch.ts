import type { Env } from './env';
import settings from '../../src/content/settings.json';

/**
 * Twitch followers for the stats page. Needs a free Twitch app (dev.twitch.tv → Your Console → Register
 * Your Application) with its Client ID and Client Secret as Cloudflare secrets TWITCH_CLIENT_ID /
 * TWITCH_CLIENT_SECRET, and the channel name in the admin panel (Settings → Twitch username).
 * The follower total is public, so no Twitch login is needed: an app token is enough (kept in KV ~60 days).
 */
export const twitchUser = String((settings as { twitchUsername?: unknown }).twitchUsername ?? '').trim().replace(/^@/, '').toLowerCase();

export const twitchConfigured = (env: Env) => !!(env.TWITCH_CLIENT_ID?.trim() && env.TWITCH_CLIENT_SECRET?.trim() && twitchUser);

async function appToken(env: Env): Promise<string> {
  const cached = await env.STUDIO?.get('twitch-app-token');
  if (cached) return cached;
  const url = new URL('https://id.twitch.tv/oauth2/token');
  url.searchParams.set('client_id', env.TWITCH_CLIENT_ID!.trim());
  url.searchParams.set('client_secret', env.TWITCH_CLIENT_SECRET!.trim());
  url.searchParams.set('grant_type', 'client_credentials');
  const res = await fetch(url, { method: 'POST', signal: AbortSignal.timeout(8000) });
  if (!res.ok) throw new Error(`Twitch login HTTP ${res.status} (check TWITCH_CLIENT_ID / TWITCH_CLIENT_SECRET)`);
  const data = (await res.json()) as { access_token?: string; expires_in?: number };
  if (!data.access_token) throw new Error('Twitch gave no token');
  await env.STUDIO?.put('twitch-app-token', data.access_token, { expirationTtl: Math.max(3600, (data.expires_in ?? 86400) - 3600) });
  return data.access_token;
}

async function helix(env: Env, path: string): Promise<Record<string, unknown>> {
  const res = await fetch(`https://api.twitch.tv/helix/${path}`, {
    headers: { Authorization: `Bearer ${await appToken(env)}`, 'Client-Id': env.TWITCH_CLIENT_ID!.trim() },
    signal: AbortSignal.timeout(8000),
  });
  if (res.status === 401) await env.STUDIO?.delete('twitch-app-token'); // expired: a new one next time
  if (!res.ok) throw new Error(`Twitch HTTP ${res.status}`);
  return (await res.json()) as Record<string, unknown>;
}

/**
 * The channel link while VIN is streaming, otherwise null (for the studio sign in the header).
 * Every visitor's header asks, so the answer is kept in KV for a minute. Never throws.
 */
export async function twitchLive(env: Env): Promise<string | null> {
  if (!twitchConfigured(env) || !env.STUDIO) return null;
  const url = `https://www.twitch.tv/${twitchUser}`;
  try {
    let live = await env.STUDIO.get('twitch-live');
    if (live === null) {
      const streams = (await helix(env, `streams?user_login=${encodeURIComponent(twitchUser)}&first=1`)).data as unknown[] | undefined;
      live = streams?.length ? '1' : '0';
      await env.STUDIO.put('twitch-live', live, { expirationTtl: 60 });
    }
    return live === '1' ? url : null;
  } catch (err) {
    console.error('Twitch live check failed', err);
    return null;
  }
}

export async function twitchFollowers(env: Env): Promise<number> {
  let id = await env.STUDIO?.get(`twitch-id-${twitchUser}`);
  if (!id) {
    const users = (await helix(env, `users?login=${encodeURIComponent(twitchUser)}`)).data as { id: string }[] | undefined;
    id = users?.[0]?.id;
    if (!id) throw new Error(`Twitch channel "${twitchUser}" not found`);
    await env.STUDIO?.put(`twitch-id-${twitchUser}`, id);
  }
  const n = Number((await helix(env, `channels/followers?broadcaster_id=${encodeURIComponent(id)}&first=1`)).total);
  if (!Number.isFinite(n)) throw new Error('No follower count from Twitch');
  return n;
}
