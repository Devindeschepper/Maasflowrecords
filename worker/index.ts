// Cloudflare Worker entry point.
// Static pages (the Astro build in /dist) are served directly by Cloudflare;
// only /api/* requests reach this code (see run_worker_first in wrangler.toml).
import type { Env } from '../functions/_lib/env';
import { jsonResponse } from '../functions/_lib/http';
import { onRequestPost as contact } from '../functions/api/contact';
import { onRequestPost as casting } from '../functions/api/casting';
import { onRequestPost as checkout } from '../functions/api/checkout';
import { onRequestPost as subscribe } from '../functions/api/subscribe';
import { onRequestPost as restock } from '../functions/api/restock';
import { onRequestPost as booking } from '../functions/api/booking';
import { onRequestPost as services } from '../functions/api/services';
import { onRequestPost as stripeWebhook } from '../functions/api/webhooks/stripe';
import { onRequestPost as cryptoWebhook } from '../functions/api/webhooks/crypto';
import { onRequestGet as studioStatus, onRequestPost as studioSet, onKnock, onStats } from '../functions/api/studio';
import { onConnect as tiktokConnect, onCallback as tiktokCallback } from '../functions/api/tiktok';
import { onShop, onShipped, onExport as shopExport, onManage, onSettings as shopSettings, onProducts as shopProducts } from '../functions/api/shop';
import { studioNudge, weeklySummary } from '../functions/_lib/studio';
import { refreshInstagramTokens } from '../functions/_lib/followers';
import { hourlyFollowers } from '../functions/_lib/alerts';
import { monthlyReport } from '../functions/_lib/report';
import { wrappedMessage } from '../functions/_lib/wrapped';
import { releaseAnniversaries, type ReleaseDate } from '../functions/_lib/anniversary';
import { monthlyLinkCheck, type SiteLink } from '../functions/_lib/linkcheck';
import { dueReminders } from '../functions/_lib/reminders';
import { monthlyBackup } from '../functions/_lib/backup';
import { salesSummary } from '../functions/_lib/sales';
import { notifyWhatsApp } from '../functions/_lib/whatsapp';
import { restockAlerts } from '../functions/_lib/restock';
import { finishDrop } from '../functions/_lib/drop';

/** Must match the Sunday entry in wrangler.toml [triggers]. */
const WEEKLY_CRON = '0 18 * * SUN';
/** Must match the monthly entry in wrangler.toml [triggers]: the 1st at 08:00 UTC (9:00/10:00 Luxembourg). */
const MONTHLY_CRON = '0 8 1 * *';

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
  '/api/restock': restock as unknown as Handler,
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
    // Private shop page (/shop-admin/), same password as the stats page.
    const shopGet: Record<string, unknown> = { '/api/shop': onShop, '/api/shop/export': shopExport, '/api/shop/manage': onManage };
    const shopPost: Record<string, unknown> = { '/api/shop/shipped': onShipped, '/api/shop/settings': shopSettings, '/api/shop/products': shopProducts };
    if (route in shopGet || route in shopPost) {
      const handler = request.method === 'GET' ? shopGet[route] : request.method === 'POST' ? shopPost[route] : undefined;
      if (!handler) return jsonResponse(405, { ok: false, error: 'Method not allowed.' });
      return (handler as Handler)({ request, env });
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

  // Crons (wrangler.toml [triggers]): hourly follower check (+ WhatsApp milestone/problem alerts, the
  // 18:00 studio nudge, the 31 December Wrapped and 10:00 release anniversaries, dated reminders, the busy-hour sales summary, tidying up after a timed drop and back-in-stock emails); Sunday evening WhatsApp
  // summary and Instagram token renewal; monthly WhatsApp report, link check and backup email on the 1st.
  async scheduled(controller: ScheduledController, env: WorkerEnv, ctx: ExecutionContext): Promise<void> {
    if (controller.cron === WEEKLY_CRON) {
      ctx.waitUntil(Promise.all([refreshInstagramTokens(env), weeklySummary(env, Date.now())]));
    } else if (controller.cron === MONTHLY_CRON) {
      const links = async () => (await (await env.ASSETS.fetch('https://assets.local/site-links.json')).json()) as SiteLink[];
      ctx.waitUntil(Promise.all([monthlyReport(env), monthlyLinkCheck(env, links), monthlyBackup(env)]));
    } else {
      const now = Date.now();
      const busySales = async () => {
        const text = await salesSummary(env).catch(() => '');
        if (text) await notifyWhatsApp(env, text);
      };
      const releases = async () => (await (await env.ASSETS.fetch('https://assets.local/release-dates.json')).json()) as ReleaseDate[];
      ctx.waitUntil(Promise.all([hourlyFollowers(env, now), studioNudge(env, now), wrappedMessage(env, now), releaseAnniversaries(env, now, releases), dueReminders(env, now), busySales(), finishDrop(env, now), restockAlerts(env, now)]));
    }
  },
} satisfies ExportedHandler<WorkerEnv>;
