import type { Env } from '../_lib/env';
import { jsonResponse } from '../_lib/http';
import { safeEqual } from '../_lib/sign';

/**
 * "VIN is in the studio" light.
 *
 * POST /api/studio  (Authorization: Bearer <STUDIO_TOKEN>, body {"state":"on"|"off"})
 *   Sent by the helper on the studio PC (tools/studio-light/) while FL Studio is open.
 *   "on" is repeated every few minutes as a heartbeat; the key expires by itself, so the
 *   light goes off on its own if the PC crashes or loses internet.
 * GET /api/studio → {"live": boolean, "last": ISO date | null}  (public, read by the header)
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

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const token = env.STUDIO_TOKEN?.trim();
  const auth = request.headers.get('Authorization')?.replace(/^Bearer\s+/i, '').trim() ?? '';
  if (!env.STUDIO || !token || token.length < 16) return jsonResponse(503, { ok: false, error: 'Studio light is not set up.' });
  if (!safeEqual(auth, token)) return jsonResponse(401, { ok: false, error: 'Unauthorized.' });

  let state = '';
  try {
    state = String(((await request.json()) as { state?: unknown }).state ?? '');
  } catch {
    return jsonResponse(400, { ok: false, error: 'Invalid JSON.' });
  }

  const now = new Date().toISOString();
  if (state === 'on') {
    await env.STUDIO.put('live', now, { expirationTtl: LIVE_TTL });
  } else if (state === 'off') {
    await Promise.all([env.STUDIO.delete('live'), env.STUDIO.put('last', now)]);
  } else {
    return jsonResponse(400, { ok: false, error: 'state must be "on" or "off".' });
  }
  return jsonResponse(200, { ok: true, live: state === 'on' });
};
