import type { Env } from '../_lib/env';
import { jsonResponse } from '../_lib/http';
import { db } from '../_lib/studio';
import { ACCOUNTS, connectUrl, exchangeCode, takeState, tiktokConfigured } from '../_lib/tiktok';
import { checkStatsPassword } from './studio';

/**
 * Connecting the TikTok accounts for the follower counts on /studio-stats/ (see functions/_lib/tiktok.ts).
 * GET /api/tiktok/connect?account=VIN|MFR  (Authorization: Bearer <STATS_PASSWORD>) → {"url": TikTok login page}
 * GET /api/tiktok/callback  TikTok sends VIN back here after he allows access; saves the login and
 *   returns to /studio-stats/?tiktok=connected (or ?tiktok=failed).
 */
export const onConnect: PagesFunction<Env> = async ({ request, env }) => {
  const d = await db(env);
  if (!env.STUDIO || !d || !tiktokConfigured(env)) return jsonResponse(503, { ok: false, error: 'TikTok is not set up yet.' });
  const denied = await checkStatsPassword(request, env, d);
  if (denied) return denied;
  const url = new URL(request.url);
  const ref = url.searchParams.get('account') ?? 'VIN';
  if (!ACCOUNTS.includes(ref)) return jsonResponse(400, { ok: false, error: 'Unknown account.' });
  return jsonResponse(200, { ok: true, url: await connectUrl(env, url.origin, ref) });
};

export const onCallback: PagesFunction<Env> = async ({ request, env }) => {
  const url = new URL(request.url);
  const back = (result: 'connected' | 'failed') => Response.redirect(`${url.origin}/studio-stats/?tiktok=${result}`, 303);
  if (!env.STUDIO || !tiktokConfigured(env)) return back('failed');

  const code = url.searchParams.get('code');
  // The state proves the login was started from the stats page (with the password) a few minutes ago.
  const ref = await takeState(env, url.searchParams.get('state') ?? '');
  if (!ref || !code) return back('failed');
  try {
    await exchangeCode(env, ref, code, url.origin);
  } catch (err) {
    console.error('TikTok connect failed', err);
    return back('failed');
  }
  // Fetch the count on the next page load instead of waiting up to 10 minutes.
  await env.STUDIO.delete('followers-last-try');
  return back('connected');
};
