import type { Env } from '../_lib/env';
import { jsonResponse, sameOrigin } from '../_lib/http';
import { safeEqual } from '../_lib/sign';
import { followerSummary } from '../_lib/followers';
import { visitorStats } from '../_lib/visitors';
import { newsletterStats } from '../_lib/newsletter';
import { spotifyStats } from '../_lib/spotify';
import { wrappedStats, wrappedYear, type Wrapped } from '../_lib/wrapped';
import { db, openSession, sessionOff, sessionOn, summarize, weekStart, type Session } from '../_lib/studio';

/**
 * "VIN is in the studio" light.
 *
 * POST /api/studio  (Authorization: Bearer <STUDIO_TOKEN>, body {"state":"on"|"off"})
 *   Sent by the helper on the studio PC (tools/studio-light/) while FL Studio is open.
 *   "on" is repeated every few minutes as a heartbeat; the key expires by itself, so the
 *   light goes off on its own if the PC crashes or loses internet.
 * GET /api/studio → {"live": boolean, "last": ISO date | null}  (public, read by the header)
 * POST /api/studio/knock  (public) → visitors "knock on the door" while the light is on; one knock
 *   per visitor per session. Counted in D1, shown in the stats and the Sunday WhatsApp summary.
 * GET /api/studio/stats  (Authorization: Bearer <STATS_PASSWORD or STUDIO_TOKEN>) → hours, knocks, followers and website visits
 *   for /studio-stats/. Max 10 wrong passwords per visitor per hour.
 *
 * Off (live:false) when the STUDIO KV namespace or STUDIO_TOKEN is not set up.
 */
const LIVE_TTL = 15 * 60; // seconds without a heartbeat before the light switches off

export const onRequestGet: PagesFunction<Env> = async ({ env }) => {
  if (!env.STUDIO) return jsonResponse(200, { live: false, last: null });
  const [live, last] = await Promise.all([env.STUDIO.get('live'), env.STUDIO.get('last')]);
  return new Response(JSON.stringify({ live: live !== null, last: live ?? last }), {
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'public, max-age=30' },
  });
};

/** null when the request carries the studio token, otherwise the error response to return. */
function checkToken(request: Request, env: Env): Response | null {
  const token = env.STUDIO_TOKEN?.trim();
  const auth = request.headers.get('Authorization')?.replace(/^Bearer\s+/i, '').trim() ?? '';
  if (!env.STUDIO || !token || token.length < 16) return jsonResponse(503, { ok: false, error: 'Studio light is not set up.' });
  if (!safeEqual(auth, token)) return jsonResponse(401, { ok: false, error: 'Unauthorized.' });
  return null;
}

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const denied = checkToken(request, env);
  if (denied) return denied;
  const kv = env.STUDIO!;

  let state = '';
  try {
    state = String(((await request.json()) as { state?: unknown }).state ?? '');
  } catch {
    return jsonResponse(400, { ok: false, error: 'Invalid JSON.' });
  }

  const t = Date.now();
  const now = new Date(t).toISOString();
  // Session stats are a bonus: a database problem must never stop the light itself.
  const track = (fn: typeof sessionOn) => fn(env, t).catch((err) => console.error('Studio session tracking failed', err));
  if (state === 'on') {
    await Promise.all([kv.put('live', now, { expirationTtl: LIVE_TTL }), track(sessionOn)]);
  } else if (state === 'off') {
    await Promise.all([kv.delete('live'), kv.put('last', now), track(sessionOff)]);
  } else {
    return jsonResponse(400, { ok: false, error: 'state must be "on" or "off".' });
  }
  return jsonResponse(200, { ok: true, live: state === 'on' });
};

/** A visitor knocks on the studio door (only while the light is on). */
export const onKnock: PagesFunction<Env> = async ({ request, env }) => {
  if (!sameOrigin(request)) return jsonResponse(403, { ok: false, error: 'Forbidden.' });
  const d = await db(env);
  if (!env.STUDIO || !d) return jsonResponse(503, { ok: false, error: 'Not available.' });
  if (!(await env.STUDIO.get('live'))) return jsonResponse(409, { ok: false, live: false, error: "VIN isn't in the studio right now." });
  const s = await openSession(d);
  if (!s) return jsonResponse(409, { ok: false, live: false, error: "VIN isn't in the studio right now." });

  // One knock per visitor per session. Only a salted hash of the IP is stored, never the IP itself.
  const visitor = await visitorHash(request, env, s.id);
  const res = await d.prepare('INSERT OR IGNORE INTO knocks (session_id, visitor, at) VALUES (?1, ?2, ?3)').bind(s.id, visitor, Date.now()).run();
  const counted = (res.meta.changes ?? 0) > 0;
  const row = counted
    ? await d.prepare('UPDATE sessions SET knocks = knocks + 1 WHERE id = ?1 RETURNING knocks').bind(s.id).first<{ knocks: number }>()
    : { knocks: s.knocks };
  return jsonResponse(200, { ok: true, counted, knocks: row?.knocks ?? s.knocks });
};

/** Salted hash of the visitor's IP (never stored in plain text). */
async function visitorHash(request: Request, env: Env, scope: string | number): Promise<string> {
  const ip = request.headers.get('CF-Connecting-IP') ?? 'unknown';
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${env.STUDIO_TOKEN ?? ''}|${scope}|${ip}`));
  return [...new Uint8Array(digest)].slice(0, 16).map((b) => b.toString(16).padStart(2, '0')).join('');
}

const MAX_FAILS = 10; // wrong stats passwords per visitor per hour

/**
 * null when the request carries STATS_PASSWORD or STUDIO_TOKEN, otherwise the error response to return.
 * Wrong passwords are counted per visitor; after MAX_FAILS in an hour that visitor is locked out.
 */
export async function checkStatsPassword(request: Request, env: Env, d: D1Database): Promise<Response | null> {
  const visitor = await visitorHash(request, env, 'stats-login');
  const hourAgo = Date.now() - 3600000;
  const fails = await d.prepare('SELECT COUNT(*) AS n FROM login_fails WHERE visitor = ?1 AND at > ?2').bind(visitor, hourAgo).first<{ n: number }>();
  if ((fails?.n ?? 0) >= MAX_FAILS) return jsonResponse(429, { ok: false, error: 'Too many wrong passwords. Try again in an hour.' });

  const given = request.headers.get('Authorization')?.replace(/^Bearer\s+/i, '').trim() ?? '';
  const valid = [env.STATS_PASSWORD?.trim(), env.STUDIO_TOKEN?.trim()].filter((p): p is string => !!p && p.length >= 8);
  if (!given || !valid.some((p) => safeEqual(given, p))) {
    await d.batch([
      d.prepare('INSERT INTO login_fails (visitor, at) VALUES (?1, ?2)').bind(visitor, Date.now()),
      d.prepare('DELETE FROM login_fails WHERE at < ?1').bind(hourAgo),
    ]);
    return jsonResponse(401, { ok: false, error: 'Wrong password.' });
  }
  return null;
}

/** The year's Wrapped when it is due (December/January) or asked for; cached for an hour. */
async function wrapped(env: Env, now: number, preview: boolean): Promise<Wrapped | null> {
  const year = wrappedYear(now, preview);
  if (year === null) return null;
  const key = `wrapped-cache-${year}`;
  const cached = await env.STUDIO?.get(key);
  if (cached) return JSON.parse(cached) as Wrapped;
  try {
    const w = await wrappedStats(env, year, now);
    await env.STUDIO?.put(key, JSON.stringify(w), { expirationTtl: 3600 });
    return w;
  } catch (err) {
    console.error('Wrapped failed', err);
    return null;
  }
}

/** Private stats for /studio-stats/. Accepts VIN's own STATS_PASSWORD or the STUDIO_TOKEN. */
export const onStats: PagesFunction<Env> = async ({ request, env }) => {
  const d = await db(env);
  if (!env.STUDIO || !d) return jsonResponse(503, { ok: false, error: 'Studio stats are not set up yet.' });
  const denied = await checkStatsPassword(request, env, d);
  if (denied) return denied;

  const now = Date.now();
  const thisWeek = weekStart(now);
  const { results } = await d.prepare('SELECT * FROM sessions ORDER BY started_at DESC').all<Session>();
  const local = new Date(new Date(now).toLocaleString('en-US', { timeZone: 'Europe/Luxembourg' }));
  const monthStart = now - ((local.getDate() - 1) * 86400000 + (local.getHours() * 3600 + local.getMinutes() * 60 + local.getSeconds()) * 1000);

  return jsonResponse(200, {
    ok: true,
    live: Boolean(await env.STUDIO!.get('live')),
    week: summarize(results, thisWeek, now),
    month: summarize(results, monthStart, now),
    all: summarize(results, 0, now),
    followers: await followerSummary(env, now).catch((err) => {
      console.error('Followers failed', err);
      return [];
    }),
    visitors: await visitorStats(env, now).catch(() => null),
    newsletter: await newsletterStats(env, now, monthStart).catch(() => null),
    spotify: await spotifyStats(env, now).catch(() => null),
    wrapped: await wrapped(env, now, new URL(request.url).searchParams.has('wrapped')),
  });
};
