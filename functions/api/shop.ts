import type { Env } from '../_lib/env';
import { jsonResponse, sameOrigin } from '../_lib/http';
import { db } from '../_lib/studio';
import { checkStatsPassword } from './studio';
import { markShipped, shopOrders, shopStats, type ShopOrder } from '../_lib/sales';
import { toBase64, xlsx } from '../_lib/xlsx';

/**
 * Private shop page (/shop-admin/), same password as /studio-stats/:
 *   GET  /api/shop          sales, stock, countries and the orders to ship
 *   POST /api/shop/shipped  { orderId, shipped } ticks an order as shipped (or undoes it)
 *   GET  /api/shop/export   Excel of the orders to ship (packing list with addresses)
 */
async function auth(request: Request, env: Env): Promise<Response | D1Database> {
  const d = await db(env);
  if (!env.STUDIO || !d) return jsonResponse(503, { ok: false, error: 'The shop page is not set up yet.' });
  return (await checkStatsPassword(request, env, d)) ?? d;
}

function monthStartNow(now: number): number {
  const local = new Date(new Date(now).toLocaleString('en-US', { timeZone: 'Europe/Luxembourg' }));
  return now - ((local.getDate() - 1) * 86400000 + (local.getHours() * 3600 + local.getMinutes() * 60 + local.getSeconds()) * 1000);
}

export const onShop: PagesFunction<Env> = async ({ request, env }) => {
  const a = await auth(request, env);
  if (a instanceof Response) return a;
  const now = Date.now();
  return jsonResponse(200, { ok: true, stats: await shopStats(env, now, monthStartNow(now)), ...(await shopOrders(env)) });
};

export const onShipped: PagesFunction<Env> = async ({ request, env }) => {
  if (!sameOrigin(request)) return jsonResponse(403, { ok: false, error: 'Forbidden.' });
  const a = await auth(request, env);
  if (a instanceof Response) return a;
  const body = (await request.json().catch(() => ({}))) as { orderId?: unknown; shipped?: unknown };
  if (typeof body.orderId !== 'string' || body.orderId.length > 100) return jsonResponse(400, { ok: false, error: 'Unknown order.' });
  const ok = await markShipped(env, body.orderId, body.shipped !== false);
  return ok ? jsonResponse(200, { ok: true }) : jsonResponse(404, { ok: false, error: 'Unknown order.' });
};

const TZ = 'Europe/Luxembourg';
const when = (t: number) => new Date(t).toLocaleString('sv-SE', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
const items = (o: ShopOrder) => o.items.map((l) => `${l.qty} × ${l.name}${l.size ? ` (${l.size})` : ''}`).join('\n');

export const onExport: PagesFunction<Env> = async ({ request, env }) => {
  const a = await auth(request, env);
  if (a instanceof Response) return a;
  const { toShip } = await shopOrders(env);
  const rows = [
    ['✓', 'Order', 'Paid on', 'Items', 'Name', 'Address', 'Postal code', 'City', 'Country', 'Email', 'Notes'],
    ...toShip.map((o) => ['', o.orderId, when(o.at), items(o), o.customer?.name, o.customer?.address, o.customer?.postalCode, o.customer?.city, o.customer?.country, o.customer?.email, o.customer?.notes]),
  ];
  const file = xlsx([{ name: 'To ship', rows }]);
  return jsonResponse(200, { ok: true, filename: `orders-to-ship-${when(Date.now()).slice(0, 10)}.xlsx`, content: toBase64(file), count: toShip.length });
};
