// Cloudflare Worker entry point.
// Static pages (the Astro build in /dist) are served directly by Cloudflare;
// only /api/* requests reach this code (see run_worker_first in wrangler.toml).
import type { Env } from '../functions/_lib/env';
import { jsonResponse } from '../functions/_lib/http';
import { onRequestPost as contact } from '../functions/api/contact';
import { onRequestPost as casting } from '../functions/api/casting';
import { onRequestPost as checkout } from '../functions/api/checkout';

interface WorkerEnv extends Env {
  ASSETS: Fetcher;
}

type Handler = (ctx: { request: Request; env: Env }) => Response | Promise<Response>;

// The handlers are written as Pages Functions; they only use `request` and `env`.
const routes: Record<string, Handler> = {
  '/api/contact': contact as unknown as Handler,
  '/api/casting': casting as unknown as Handler,
  '/api/checkout': checkout as unknown as Handler,
};

export default {
  async fetch(request: Request, env: WorkerEnv): Promise<Response> {
    const { pathname } = new URL(request.url);
    const handler = routes[pathname.replace(/\/$/, '')];

    if (handler) {
      if (request.method !== 'POST') return jsonResponse(405, { ok: false, error: 'Method not allowed.' });
      return handler({ request, env });
    }
    if (pathname.startsWith('/api/')) return jsonResponse(404, { ok: false, error: 'Not found.' });

    return env.ASSETS.fetch(request);
  },
} satisfies ExportedHandler<WorkerEnv>;
