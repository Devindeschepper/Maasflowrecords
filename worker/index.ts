// Cloudflare Worker entry point.
// Static pages (the Astro build in /dist) are served directly by Cloudflare;
// only /api/* requests reach this code (see run_worker_first in wrangler.toml).
import type { Env } from '../functions/_lib/env';
import { jsonResponse } from '../functions/_lib/http';
import { onRequestPost as contact } from '../functions/api/contact';
import { onRequestPost as casting } from '../functions/api/casting';
import { onRequestPost as checkout } from '../functions/api/checkout';
import { onRequestPost as subscribe } from '../functions/api/subscribe';
import { onRequestPost as booking } from '../functions/api/booking';
import { onRequestPost as services } from '../functions/api/services';
import { onRequestPost as stripeWebhook } from '../functions/api/webhooks/stripe';
import { onRequestPost as cryptoWebhook } from '../functions/api/webhooks/crypto';
import { onRequestGet as studioStatus, onRequestPost as studioSet, onKnock, onStats } from '../functions/api/studio';
import { onConnect as tiktokConnect, onCallback as tiktokCallback } from '../functions/api/tiktok';
import { weeklySummary } from '../functions/_lib/studio';
import { refreshInstagramTokens, snapshotFollowers } from '../functions/_lib/followers';

/** Must match the Sunday entry in wrangler.toml [triggers]. */
const WEEKLY_CRON = '0 18 * * SUN';

interface WorkerEnv extends Env {
  ASSETS: Fetcher;
}

type Handler = (ctx: { request: Request; env: Env }) => Response | Promise<Response>;

// The handlers are written as Pages Functions; they only use `request` and `env`.
const routes: Record<string, Handler> = {
  '/api/contact': contact as unknown as Handler,
  '/api/casting': casting as unknown as Handler,
  '/api/checkout': checkout as unknown as Handler,
  '/api/subscribe': subscribe as unknown as Handler,
  '/api/booking': booking as unknown as Handler,
  '/api/services': services as unknown as Handler,
  '/api/webhooks/stripe': stripeWebhook as unknown as Handler,
  '/api/webhooks/crypto': cryptoWebhook as unknown as Handler,
};

export default {
  async fetch(request: Request, env: WorkerEnv): Promise<Response> {
    const { pathname } = new URL(request.url);
    const route = pathname.replace(/\/$/, '');

    // Studio light: public GET for the header, POST from the studio PC.
    if (route === '/api/studio') {
      if (request.method === 'GET') return (studioStatus as unknown as Handler)({ request, env });
      if (request.method === 'POST') return (studioSet as unknown as Handler)({ request, env });
      return jsonResponse(405, { ok: false, error: 'Method not allowed.' });
    }
    if (route === '/api/studio/knock') {
      if (request.method !== 'POST') return jsonResponse(405, { ok: false, error: 'Method not allowed.' });
      return (onKnock as unknown as Handler)({ request, env });
    }
    if (route === '/api/studio/stats') {
      if (request.method !== 'GET') return jsonResponse(405, { ok: false, error: 'Method not allowed.' });
      return (onStats as unknown as Handler)({ request, env });
    }
    // TikTok login for the follower count on /studio-stats/.
    if (route === '/api/tiktok/connect' || route === '/api/tiktok/callback') {
      if (request.method !== 'GET') return jsonResponse(405, { ok: false, error: 'Method not allowed.' });
      return ((route.endsWith('connect') ? tiktokConnect : tiktokCallback) as unknown as Handler)({ request, env });
    }

    const handler = routes[route];

    if (handler) {
      if (request.method !== 'POST') return jsonResponse(405, { ok: false, error: 'Method not allowed.' });
      return handler({ request, env });
    }
    if (pathname.startsWith('/api/')) return jsonResponse(404, { ok: false, error: 'Not found.' });

    return env.ASSETS.fetch(request);
  },

  // Crons (wrangler.toml [triggers]): daily follower snapshot; Sunday evening WhatsApp summary.
  async scheduled(controller: ScheduledController, env: WorkerEnv, ctx: ExecutionContext): Promise<void> {
    if (controller.cron === WEEKLY_CRON) {
      ctx.waitUntil(Promise.all([refreshInstagramTokens(env).then(() => snapshotFollowers(env)), weeklySummary(env, Date.now())]));
    } else {
      ctx.waitUntil(snapshotFollowers(env));
    }
  },
} satisfies ExportedHandler<WorkerEnv>;
