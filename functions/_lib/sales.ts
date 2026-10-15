import type { Env } from './env';
import type { Order } from './payments/types';
import { db } from './studio';
import { products } from '../../src/data/products';
import { shopOpen, shopTestMode } from '../../src/data/site';

/**
 * Shop sales and stock for the private stats page.
 * - Checkout remembers each order's lines for a week (KV 'order-<id>'); the payment webhook then saves the paid
 *   order in D1 (table sales; Stripe retries are ignored by order id).
 * - Stock "left" = the stock set in the admin panel minus what was sold since that number last changed. So when
 *   VIN lowers the stock in the admin panel after shipping, nothing is counted twice.
 */
const LOW = 5; // same as "Only X left" on the shop

async function ensureTable(d: D1Database) {
  await d.prepare(
    'CREATE TABLE IF NOT EXISTS sales (order_id TEXT PRIMARY KEY, at INTEGER NOT NULL, total_cents INTEGER NOT NULL, via TEXT NOT NULL, lines TEXT NOT NULL, test INTEGER NOT NULL DEFAULT 0)',
  ).run();
}

type Line = { id: string; name: string; qty: number; unitPrice: number };

export async function rememberOrder(env: Env, order: Order): Promise<void> {
  const lines: Line[] = order.lines.map((l) => ({ id: l.id, name: l.name, qty: l.qty, unitPrice: l.unitPrice }));
  await env.STUDIO?.put(`order-${order.orderId}`, JSON.stringify(lines), { expirationTtl: 7 * 86400 });
}

/** Called by the payment webhooks once an order is paid. Never throws: the order email matters more. */
export async function recordSale(env: Env, sale: { orderId: string; totalCents: number; via: string }, now = Date.now()): Promise<void> {
  try {
    const d = await db(env);
    if (!d) return;
    await ensureTable(d);
    const lines = (await env.STUDIO?.get(`order-${sale.orderId}`)) ?? '[]';
    await d
      .prepare('INSERT OR IGNORE INTO sales (order_id, at, total_cents, via, lines, test) VALUES (?1, ?2, ?3, ?4, ?5, ?6)')
      .bind(sale.orderId, now, Math.max(0, Math.round(sale.totalCents)), sale.via, lines, shopTestMode ? 1 : 0)
      .run();
  } catch (err) {
    console.error('Recording the sale failed', err);
  }
}

export interface ShopStats {
  open: boolean;
  test: boolean;
  month: { orders: number; revenue: number; best: { name: string; qty: number } | null };
  all: { orders: number; revenue: number };
  stock: { id: string; name: string; stock: number; sold: number; left: number; low: boolean }[];
}

export async function shopStats(env: Env, now: number, monthStart: number): Promise<ShopStats | null> {
  const d = await db(env);
  if (!d) return null;
  await ensureTable(d);
  const { results } = await d
    .prepare('SELECT at, total_cents, lines FROM sales WHERE test = ?1 ORDER BY at')
    .bind(shopTestMode ? 1 : 0)
    .all<{ at: number; total_cents: number; lines: string }>();
  const sales = results.map((r) => ({ ...r, lines: JSON.parse(r.lines || '[]') as Line[] }));

  const month = sales.filter((s) => s.at >= monthStart);
  const qtyByName = new Map<string, number>();
  for (const s of month) for (const l of s.lines) qtyByName.set(l.name, (qtyByName.get(l.name) ?? 0) + l.qty);
  const best = [...qtyByName].sort((a, b) => b[1] - a[1])[0];

  const stock = [];
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
    const left = Math.max(0, p.stock - sold);
    stock.push({ id: p.id, name: p.name, stock: p.stock, sold, left, low: left <= LOW });
  }

  const sum = (list: typeof sales) => list.reduce((n, s) => n + s.total_cents, 0);
  return {
    open: shopOpen,
    test: shopTestMode,
    month: { orders: month.length, revenue: sum(month), best: best ? { name: best[0], qty: best[1] } : null },
    all: { orders: sales.length, revenue: sum(sales) },
    stock,
  };
}
