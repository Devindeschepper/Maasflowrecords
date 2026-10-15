import type { Env } from './env';
import type { Order } from './payments/types';
import { db } from './studio';
import { products } from '../../src/data/products';
import { shopOpen, shopTestMode } from '../../src/data/site';

/**
 * Shop sales and stock for the private stats page.
 * - Checkout remembers each order's lines for a week (KV 'order-<id>'); the payment webhook then saves the paid
 *   order in D1 (table sales; Stripe retries are ignored by order id).
 * - Orders are counted per country (as typed at checkout, cleaned up: "luxemburg" and "LU" are both Luxembourg).
 * - Stock "left" = the stock set in the admin panel minus what was sold since that number last changed. So when
 *   VIN lowers the stock in the admin panel after shipping, nothing is counted twice.
 */
const LOW = 5; // same as "Only X left" on the shop

export async function ensureSalesTable(d: D1Database) {
  await d.prepare(
    "CREATE TABLE IF NOT EXISTS sales (order_id TEXT PRIMARY KEY, at INTEGER NOT NULL, total_cents INTEGER NOT NULL, via TEXT NOT NULL, lines TEXT NOT NULL, test INTEGER NOT NULL DEFAULT 0, country TEXT NOT NULL DEFAULT '', details TEXT NOT NULL DEFAULT '{}', notified INTEGER NOT NULL DEFAULT 1, shipped_at INTEGER)",
  ).run();
  // Tables made before these columns existed get them added (fails harmlessly when they're already there).
  await d.prepare("ALTER TABLE sales ADD COLUMN country TEXT NOT NULL DEFAULT ''").run().catch(() => {});
  await d.prepare("ALTER TABLE sales ADD COLUMN details TEXT NOT NULL DEFAULT '{}'").run().catch(() => {});
  await d.prepare('ALTER TABLE sales ADD COLUMN notified INTEGER NOT NULL DEFAULT 1').run().catch(() => {});
  await d.prepare('ALTER TABLE sales ADD COLUMN shipped_at INTEGER').run().catch(() => {});
}

/** The country as customers type it ("luxemburg", "NL", "Deutschland") → one name per country. */
const COUNTRY_ALIASES: Record<string, string> = {
  lu: 'Luxembourg', lux: 'Luxembourg', luxemburg: 'Luxembourg', 'lëtzebuerg': 'Luxembourg', letzebuerg: 'Luxembourg', 'grand-duché de luxembourg': 'Luxembourg',
  nl: 'Netherlands', holland: 'Netherlands', nederland: 'Netherlands', 'the netherlands': 'Netherlands', 'pays-bas': 'Netherlands', niederlande: 'Netherlands',
  be: 'Belgium', belgie: 'Belgium', 'belgië': 'Belgium', belgique: 'Belgium', belgien: 'Belgium',
  de: 'Germany', deutschland: 'Germany', allemagne: 'Germany', duitsland: 'Germany',
  fr: 'France', frankreich: 'France', frankrijk: 'France',
  pt: 'Portugal', es: 'Spain', 'españa': 'Spain', espana: 'Spain', it: 'Italy', italia: 'Italy',
  uk: 'United Kingdom', gb: 'United Kingdom', 'great britain': 'United Kingdom', england: 'United Kingdom',
  us: 'United States', usa: 'United States', 'united states of america': 'United States',
  ch: 'Switzerland', schweiz: 'Switzerland', suisse: 'Switzerland', at: 'Austria', 'österreich': 'Austria',
};
export function countryName(raw: string): string {
  const t = raw.trim().replace(/\s+/g, ' ').replace(/\.$/, '');
  if (!t) return '';
  const alias = COUNTRY_ALIASES[t.toLowerCase()];
  if (alias) return alias;
  return t.length <= 3 ? t.toUpperCase() : t.replace(/(^|[\s-])\p{L}/gu, (c) => c.toUpperCase());
}

type Line = { id: string; name: string; qty: number; unitPrice: number; size?: string };

/** Everything about a sale kept for VIN's records (and the monthly backup). Amounts in cents. */
export interface SaleDetails {
  subtotal?: number;
  shipping?: number;
  vat?: number;
  vatNote?: string;
  shippingZone?: string;
  customer?: { name: string; email: string; address: string; postalCode: string; city: string; country: string; notes: string };
}

export async function rememberOrder(env: Env, order: Order): Promise<void> {
  const lines: Line[] = order.lines.map((l) => ({ id: l.id, name: l.name, qty: l.qty, unitPrice: l.unitPrice, ...(l.size ? { size: l.size } : {}) }));
  const details: SaleDetails = {
    subtotal: order.subtotal,
    shipping: order.shipping,
    vat: order.vat,
    vatNote: order.vatNote,
    shippingZone: order.shippingZone,
    customer: order.customer,
  };
  await env.STUDIO?.put(`order-${order.orderId}`, JSON.stringify({ lines, country: countryName(order.customer.country), details }), { expirationTtl: 7 * 86400 });
}

/** More sales than this within an hour = busy: one WhatsApp summary per hour instead of one per sale. */
export const BUSY_PER_HOUR = 3;

/**
 * Called by the payment webhooks once an order is paid. Returns true when it's busy (more than BUSY_PER_HOUR
 * sales in the last hour): the sale is then left for the hourly summary (salesSummary) instead of its own
 * WhatsApp. Never throws: the order email matters more.
 */
export async function recordSale(env: Env, sale: { orderId: string; totalCents: number; via: string }, now = Date.now()): Promise<boolean> {
  try {
    const d = await db(env);
    if (!d) return false;
    await ensureSalesTable(d);
    const saved = JSON.parse((await env.STUDIO?.get(`order-${sale.orderId}`)) ?? '{}') as { lines?: Line[]; country?: string; details?: SaleDetails };
    const inserted = await d
      .prepare('INSERT OR IGNORE INTO sales (order_id, at, total_cents, via, lines, test, country, details) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)')
      .bind(
        sale.orderId, now, Math.max(0, Math.round(sale.totalCents)), sale.via, JSON.stringify(saved.lines ?? []), shopTestMode ? 1 : 0,
        saved.country ?? '', JSON.stringify(saved.details ?? {}),
      )
      .run();
    if (!inserted.meta.changes) return false; // a payment retry for a sale already counted
    const recent = await d.prepare('SELECT COUNT(*) AS n FROM sales WHERE at > ?1').bind(now - 3600000).first<{ n: number }>();
    if ((recent?.n ?? 0) <= BUSY_PER_HOUR) return false;
    await d.prepare('UPDATE sales SET notified = 0 WHERE order_id = ?1').bind(sale.orderId).run();
    return true;
  } catch (err) {
    console.error('Recording the sale failed', err);
    return false;
  }
}

/** Hourly cron: one WhatsApp for all sales that were held back because it was busy. */
export async function salesSummary(env: Env): Promise<string> {
  const d = await db(env);
  if (!d) return '';
  await ensureSalesTable(d);
  const { results } = await d
    .prepare('SELECT order_id, total_cents, lines, test FROM sales WHERE notified = 0 ORDER BY at')
    .all<{ order_id: string; total_cents: number; lines: string; test: number }>();
  if (!results.length) return '';
  await d.prepare(`UPDATE sales SET notified = 1 WHERE order_id IN (${results.map((_, i) => `?${i + 1}`).join(',')})`).bind(...results.map((r) => r.order_id)).run();
  const qty = new Map<string, number>();
  for (const r of results) for (const l of JSON.parse(r.lines || '[]') as Line[]) qty.set(l.name, (qty.get(l.name) ?? 0) + l.qty);
  const total = results.reduce((n, r) => n + r.total_cents, 0);
  return [
    `🔴 Maas Flow Records${results.some((r) => r.test) ? ' [TEST]' : ''}`,
    `💰 Busy! ${results.length} more sale${results.length === 1 ? '' : 's'} since the last message: €${(total / 100).toFixed(2)}`,
    ...[...qty].sort((a, b) => b[1] - a[1]).map(([name, n]) => `• ${n}× ${name}`),
    'Details in your email 📦',
  ].join('\n');
}

/**
 * Stock left per product: the stock set in the admin panel minus what was sold since that number last
 * changed. Used by the stats page and by checkout (so nobody can pay for something that is sold out).
 */
export async function stockLeft(env: Env, now: number): Promise<Map<string, { stock: number; sold: number; left: number }>> {
  const out = new Map<string, { stock: number; sold: number; left: number }>();
  const d = await db(env);
  if (!d) {
    for (const p of products) out.set(p.id, { stock: p.stock, sold: 0, left: p.stock });
    return out;
  }
  await ensureSalesTable(d);
  const { results } = await d.prepare('SELECT at, lines FROM sales WHERE test = ?1').bind(shopTestMode ? 1 : 0).all<{ at: number; lines: string }>();
  const sales = results.map((r) => ({ at: r.at, lines: JSON.parse(r.lines || '[]') as Line[] }));
  for (const p of products) {
    // Remember when this stock number was set, to count only the sales after it.
    const key = `stock-base-${p.id}`;
    let base = JSON.parse((await env.STUDIO?.get(key)) ?? 'null') as { stock: number; at: number } | null;
    // First time: count every sale. After VIN changes the number in the admin panel: only sales after that.
    if (!base || base.stock !== p.stock) {
      base = { stock: p.stock, at: base ? now : 0 };
      await env.STUDIO?.put(key, JSON.stringify(base));
    }
    const sold = sales.filter((s) => s.at >= base!.at).reduce((n, s) => n + s.lines.filter((l) => l.id === p.id).reduce((m, l) => m + l.qty, 0), 0);
    out.set(p.id, { stock: p.stock, sold, left: Math.max(0, p.stock - sold) });
  }
  return out;
}

export interface ShopStats {
  open: boolean;
  test: boolean;
  month: { orders: number; revenue: number; best: { name: string; qty: number } | null };
  all: { orders: number; revenue: number };
  stock: { id: string; name: string; stock: number; sold: number; left: number; low: boolean }[];
  /** All-time orders per country, most first. */
  countries: { name: string; orders: number }[];
}

export async function shopStats(env: Env, now: number, monthStart: number): Promise<ShopStats | null> {
  const d = await db(env);
  if (!d) return null;
  await ensureSalesTable(d);
  const { results } = await d
    .prepare('SELECT at, total_cents, lines, country FROM sales WHERE test = ?1 ORDER BY at')
    .bind(shopTestMode ? 1 : 0)
    .all<{ at: number; total_cents: number; lines: string; country: string }>();
  const sales = results.map((r) => ({ ...r, lines: JSON.parse(r.lines || '[]') as Line[] }));

  const month = sales.filter((s) => s.at >= monthStart);
  const qtyByName = new Map<string, number>();
  for (const s of month) for (const l of s.lines) qtyByName.set(l.name, (qtyByName.get(l.name) ?? 0) + l.qty);
  const best = [...qtyByName].sort((a, b) => b[1] - a[1])[0];

  const left = await stockLeft(env, now);
  const stock = products.map((p) => {
    const st = left.get(p.id)!;
    return { id: p.id, name: p.name, ...st, low: st.left <= LOW };
  });

  const byCountry = new Map<string, number>();
  for (const s of sales) {
    const name = s.country || 'Unknown';
    byCountry.set(name, (byCountry.get(name) ?? 0) + 1);
  }

  const sum = (list: typeof sales) => list.reduce((n, s) => n + s.total_cents, 0);
  return {
    open: shopOpen,
    test: shopTestMode,
    month: { orders: month.length, revenue: sum(month), best: best ? { name: best[0], qty: best[1] } : null },
    all: { orders: sales.length, revenue: sum(sales) },
    stock,
    countries: [...byCountry].map(([name, orders]) => ({ name, orders })).sort((a, b) => b.orders - a.orders || a.name.localeCompare(b.name)),
  };
}

export interface ShopOrder {
  orderId: string;
  at: number;
  via: string;
  total: number;
  items: { name: string; qty: number; size?: string }[];
  customer: SaleDetails['customer'] | null;
  shippingZone: string;
  shippedAt: number | null;
}

/** Paid orders for the shop page: all not shipped yet (oldest first) and the last 20 shipped. */
export async function shopOrders(env: Env): Promise<{ toShip: ShopOrder[]; shipped: ShopOrder[] }> {
  const d = await db(env);
  if (!d) return { toShip: [], shipped: [] };
  await ensureSalesTable(d);
  type Row = { order_id: string; at: number; via: string; total_cents: number; lines: string; details: string; shipped_at: number | null };
  const map = (r: Row): ShopOrder => {
    const det = JSON.parse(r.details || '{}') as SaleDetails;
    return {
      orderId: r.order_id,
      at: r.at,
      via: r.via,
      total: r.total_cents,
      items: (JSON.parse(r.lines || '[]') as Line[]).map((l) => ({ name: l.name, qty: l.qty, ...(l.size ? { size: l.size } : {}) })),
      customer: det.customer ?? null,
      shippingZone: det.shippingZone ?? '',
      shippedAt: r.shipped_at,
    };
  };
  const t = shopTestMode ? 1 : 0;
  const cols = 'order_id, at, via, total_cents, lines, details, shipped_at';
  const toShip = await d.prepare(`SELECT ${cols} FROM sales WHERE test = ?1 AND shipped_at IS NULL ORDER BY at`).bind(t).all<Row>();
  const shipped = await d.prepare(`SELECT ${cols} FROM sales WHERE test = ?1 AND shipped_at IS NOT NULL ORDER BY shipped_at DESC LIMIT 20`).bind(t).all<Row>();
  return { toShip: toShip.results.map(map), shipped: shipped.results.map(map) };
}

/** Ticks an order as shipped (or back to "to ship"). Returns false when the order doesn't exist. */
export async function markShipped(env: Env, orderId: string, shipped: boolean, now = Date.now()): Promise<boolean> {
  const d = await db(env);
  if (!d) return false;
  await ensureSalesTable(d);
  const res = await d.prepare('UPDATE sales SET shipped_at = ?1 WHERE order_id = ?2').bind(shipped ? now : null, orderId).run();
  return (res.meta.changes ?? 0) > 0;
}
