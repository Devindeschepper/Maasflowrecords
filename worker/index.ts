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
import { weeklySummary } from '../functions/_lib/studio';

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

    const handler = routes[route];

    if (handler) {
      if (request.method !== 'POST') return jsonResponse(405, { ok: false, error: 'Method not allowed.' });
      return handler({ request, env });
    }
    if (pathname.startsWith('/api/')) return jsonResponse(404, { ok: false, error: 'Not found.' });

    return env.ASSETS.fetch(request);
  },

  // Cron (wrangler.toml [triggers]): Sunday-evening studio summary on WhatsApp.
  async scheduled(_controller: ScheduledController, env: WorkerEnv, ctx: ExecutionContext): Promise<void> {
    ctx.waitUntil(weeklySummary(env, Date.now()));
  },
} satisfies ExportedHandler<WorkerEnv>;
