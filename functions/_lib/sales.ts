import type { Env } from './env';
import type { Order } from './payments/types';
import { db } from './studio';
import { countUse } from './discounts';
import { sendMail } from './mail';
import { notifyWhatsApp } from './whatsapp';
import { customerTexts, itemsForCustomer } from './payments/customer-texts';
import { bundleStock, products } from '../../src/data/products';
import { dropAt, shopOpen, shopTestMode } from '../../src/data/site';

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
  // 1 once the "your order is on the way" email went out (so Undo + Shipped again doesn't send it twice).
  await d.prepare('ALTER TABLE sales ADD COLUMN ship_mailed INTEGER NOT NULL DEFAULT 0').run().catch(() => {});
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
  discount?: { code: string; percent: number; saved: number };
  /** Language the customer shopped in. */
  lang?: 'en' | 'fr' | 'de';
  customer?: { name: string; email: string; address: string; postalCode: string; city: string; country: string; notes: string };
}

/** The item lines of an order as text (with sizes), from what checkout remembered; '' when unknown. */
export async function orderItemsText(env: Env, orderId: string): Promise<string> {
  const saved = JSON.parse((await env.STUDIO?.get(`order-${orderId}`).catch(() => null)) ?? '{}') as { lines?: Line[] };
  return (saved.lines ?? []).map((l) => `${l.qty} × ${l.name}${l.size ? ` (size ${l.size})` : ''} - €${((l.unitPrice * l.qty) / 100).toFixed(2)}`).join('\n');
}

/** The language an order was placed in (remembered at checkout for a week). */
export async function orderLang(env: Env, orderId: string): Promise<'en' | 'fr' | 'de'> {
  const saved = JSON.parse((await env.STUDIO?.get(`order-${orderId}`).catch(() => null)) ?? '{}') as { details?: SaleDetails };
  return saved.details?.lang ?? 'en';
}

export async function rememberOrder(env: Env, order: Order): Promise<void> {
  const lines: Line[] = order.lines.map((l) => ({ id: l.id, name: l.name, qty: l.qty, unitPrice: l.unitPrice, ...(l.size ? { size: l.size } : {}) }));
  const details: SaleDetails = {
    subtotal: order.subtotal,
    shipping: order.shipping,
    vat: order.vat,
    vatNote: order.vatNote,
    shippingZone: order.shippingZone,
    ...(order.discount ? { discount: order.discount } : {}),
    lang: order.lang ?? 'en',
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
    if (saved.details?.discount?.code) await countUse(env, saved.details.discount.code);
    await lowStockAlert(env, saved.lines ?? [], now);
    const recent = await d.prepare('SELECT COUNT(*) AS n FROM sales WHERE at > ?1').bind(now - 3600000).first<{ n: number }>();
    if ((recent?.n ?? 0) <= BUSY_PER_HOUR) return false;
    await d.prepare('UPDATE sales SET notified = 0 WHERE order_id = ?1').bind(sale.orderId).run();
    return true;
  } catch (err) {
    console.error('Recording the sale failed', err);
    return false;
  }
}

/** WhatsApp to VIN when something has only a few pieces left. */
const ALERT_AT = 3;

/**
 * After a sale: one WhatsApp for each product (or size) that this sale took down to ALERT_AT or fewer, so VIN
 * hears it once when it gets low and once when it's sold out, not on every sale. Never throws.
 */
async function lowStockAlert(env: Env, lines: Line[], now: number) {
  try {
    if (!lines.length) return;
    const left = await stockLeft(env, now);
    const alerts: string[] = [];
    for (const p of products) {
      if (p.bundle) continue; // a bundle runs out when a product inside runs out
      const sold = (size?: string) =>
        lines
          .filter((l) => (l.id === p.id || products.find((b) => b.id === l.id)?.bundle?.includes(p.id)) && (size === undefined || l.size === size))
          .reduce((n, l) => n + l.qty, 0);
      const st = left.get(p.id);
      const check = (label: string, after: number, qty: number) => {
        if (!qty || (after > 0 && after + qty <= ALERT_AT)) return; // already low before this sale
        if (after === 0) alerts.push(`❌ Sold out: ${label}`);
        else if (after <= ALERT_AT) alerts.push(`⚠️ Only ${after} left: ${label}`);
      };
      if (st?.sizes) for (const [size, s] of Object.entries(st.sizes)) check(`${p.name} (${size})`, s.left, sold(size));
      else if (st) check(p.name, st.left, sold());
    }
    if (alerts.length) await notifyWhatsApp(env, [`🔴 Maas Flow Records${shopTestMode ? ' [TEST]' : ''}`, ...alerts, 'Change the stock on /shop-admin/ when you get new pieces.'].join('\n'));
  } catch (err) {
    console.error('Low stock alert failed', err);
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

export type StockLine = { stock: number; sold: number; left: number };
export type ProductStock = StockLine & { sizes?: Record<string, StockLine> };

/**
 * Stock left per product (and per size, for products with stock per size): the stock set in the admin
 * panel minus what was sold since that number last changed. Used by the stats page and by checkout
 * (so nobody can pay for something that is sold out).
 */
export async function stockLeft(env: Env, now: number): Promise<Map<string, ProductStock>> {
  const out = new Map<string, ProductStock>();
  const d = await db(env);
  const sales: { at: number; lines: Line[] }[] = [];
  if (d) {
    await ensureSalesTable(d);
    const { results } = await d.prepare('SELECT at, lines FROM sales WHERE test = ?1').bind(shopTestMode ? 1 : 0).all<{ at: number; lines: string }>();
    for (const r of results) sales.push({ at: r.at, lines: JSON.parse(r.lines || '[]') as Line[] });
  }
  // Remember when this stock number was set, to count only the sales after it.
  // First time: count every sale. After VIN changes the number: only sales after that.
  const count = async (key: string, stock: number, match: (l: Line) => boolean): Promise<StockLine> => {
    if (!d) return { stock, sold: 0, left: stock };
    let base = JSON.parse((await env.STUDIO?.get(key)) ?? 'null') as { stock: number; at: number } | null;
    if (!base || base.stock !== stock) {
      base = { stock, at: base ? now : 0 };
      await env.STUDIO?.put(key, JSON.stringify(base));
    }
    const sold = sales.filter((s) => s.at >= base!.at).reduce((n, s) => n + s.lines.filter(match).reduce((m, l) => m + l.qty, 0), 0);
    return { stock, sold, left: Math.max(0, stock - sold) };
  };
  // A bundle sold = one of each product inside it sold (for the product with sizes: in the chosen size).
  const inBundle = (l: Line, id: string) => !!products.find((b) => b.id === l.id)?.bundle?.includes(id);
  for (const p of products) {
    if (p.bundle) continue; // worked out below from the products inside
    if (p.sizeStock) {
      const sizes: Record<string, StockLine> = {};
      for (const [size, n] of Object.entries(p.sizeStock)) sizes[size] = await count(`stock-base-${p.id}::${size}`, n, (l) => (l.id === p.id || inBundle(l, p.id)) && l.size === size);
      const all = Object.values(sizes);
      out.set(p.id, { stock: p.stock, sold: all.reduce((a, x) => a + x.sold, 0), left: all.reduce((a, x) => a + x.left, 0), sizes });
    } else {
      out.set(p.id, await count(`stock-base-${p.id}`, p.stock, (l) => l.id === p.id || inBundle(l, p.id)));
    }
  }
  for (const b of products) {
    if (!b.bundle) continue;
    const items = b.bundle.map((id) => products.find((x) => x.id === id)!).filter(Boolean);
    const leftOf = (x: (typeof products)[number], size?: string) => (size ? out.get(x.id)?.sizes?.[size]?.left ?? 0 : out.get(x.id)?.left ?? 0);
    const now = bundleStock(items, leftOf);
    const sold = sales.reduce((n, s) => n + s.lines.filter((l) => l.id === b.id).reduce((m, l) => m + l.qty, 0), 0);
    out.set(b.id, {
      stock: now.stock, sold, left: now.stock,
      ...(now.sizeStock ? { sizes: Object.fromEntries(Object.entries(now.sizeStock).map(([size, n]) => [size, { stock: n, sold: 0, left: n }])) } : {}),
    });
  }
  return out;
}

export interface ShopStats {
  open: boolean;
  /** Timed drop on the live site (ISO), null = none. */
  drop: string | null;
  test: boolean;
  month: { orders: number; revenue: number; best: { name: string; qty: number } | null };
  all: { orders: number; revenue: number };
  stock: { id: string; name: string; stock: number; sold: number; left: number; low: boolean; bundle?: boolean; sizes?: Record<string, StockLine> }[];
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
    return { id: p.id, name: p.name, ...st, low: st.left <= LOW, ...(p.bundle ? { bundle: true } : {}) };
  });

  const byCountry = new Map<string, number>();
  for (const s of sales) {
    const name = s.country || 'Unknown';
    byCountry.set(name, (byCountry.get(name) ?? 0) + 1);
  }

  const sum = (list: typeof sales) => list.reduce((n, s) => n + s.total_cents, 0);
  return {
    open: shopOpen,
    drop: dropAt || null,
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

/**
 * Ticks an order as shipped (or back to "to ship"). The first time an order is marked shipped, the customer
 * gets a "your order is on the way" email in their language (with the tracking number when given).
 * Returns null when the order doesn't exist, otherwise whether that email was sent now.
 */
export async function markShipped(env: Env, orderId: string, shipped: boolean, tracking = '', now = Date.now()): Promise<{ mailed: boolean } | null> {
  const d = await db(env);
  if (!d) return null;
  await ensureSalesTable(d);
  const res = await d.prepare('UPDATE sales SET shipped_at = ?1 WHERE order_id = ?2').bind(shipped ? now : null, orderId).run();
  if (!(res.meta.changes ?? 0)) return null;
  if (!shipped) return { mailed: false };
  const row = await d.prepare('SELECT lines, details, ship_mailed FROM sales WHERE order_id = ?1').bind(orderId).first<{ lines: string; details: string; ship_mailed: number }>();
  const det = JSON.parse(row?.details || '{}') as SaleDetails;
  const c = det.customer;
  if (!row || row.ship_mailed || !c?.email) return { mailed: false };
  const lang = det.lang ?? 'en';
  const t = customerTexts(lang);
  const items = (JSON.parse(row.lines || '[]') as Line[]).map((l) => `${l.qty} × ${l.name}${l.size ? ` (size ${l.size})` : ''}`).join('\n');
  try {
    await sendMail(env, {
      to: c.email,
      replyTo: env.CONTACT_TO_EMAIL ?? 'info@maasflowrecords.com',
      subject: `${shopTestMode ? '[TEST] ' : ''}${t.shippedSubject(orderId)}`,
      fields: [
        [t.thanksLabel, t.shippedText(c.name)],
        [t.order, orderId],
        [t.items, itemsForCustomer(items, lang)],
        [t.tracking, tracking],
        [t.shipTo, [c.name, c.address, `${c.postalCode} ${c.city}`.trim(), c.country].filter(Boolean).join('\n')],
        [t.questions, t.questionsText],
      ],
    });
    await d.prepare('UPDATE sales SET ship_mailed = 1 WHERE order_id = ?1').bind(orderId).run();
    return { mailed: true };
  } catch (err) {
    console.error('Shipped email failed', err);
    return { mailed: false };
  }
}
