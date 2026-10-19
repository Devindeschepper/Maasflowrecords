import type { Env } from './env';
import { db } from './studio';
import { escapeHtml } from './http';
import { stockLeft } from './sales';
import { notifyWhatsApp } from './whatsapp';
import { products } from '../../src/data/products';
import { dropStarted, shopOpen, shopTestMode, site } from '../../src/data/site';

/**
 * "Tell me when it's back": fans leave their email on a sold-out product (D1 table restock). Once that product
 * is in stock again on the live site, the hourly cron emails them all once (Resend batch API, up to 100 per
 * call) and deletes their addresses. VIN gets one WhatsApp saying how many people were told.
 */
const MAX_PER_PRODUCT = 5000;
const BATCH = 100;
const BATCHES_PER_RUN = 3; // the rest goes out the next hour

async function table(env: Env): Promise<D1Database | null> {
  const d = await db(env);
  if (!d) return null;
  await d.prepare('CREATE TABLE IF NOT EXISTS restock (product_id TEXT NOT NULL, email TEXT NOT NULL, at INTEGER NOT NULL, PRIMARY KEY (product_id, email))').run();
  return d;
}

/** Saves a request. Asking twice for the same product is fine (kept once). */
export async function addRestockRequest(env: Env, productId: string, email: string, now = Date.now()): Promise<'ok' | 'full' | 'unavailable'> {
  const d = await table(env);
  if (!d) return 'unavailable';
  const row = await d.prepare('SELECT COUNT(*) AS n FROM restock WHERE product_id = ?1').bind(productId).first<{ n: number }>();
  if ((row?.n ?? 0) >= MAX_PER_PRODUCT) return 'full';
  await d.prepare('INSERT OR IGNORE INTO restock (product_id, email, at) VALUES (?1, ?2, ?3)').bind(productId, email, now).run();
  return 'ok';
}

/** How many people wait for each product (for the shop page). */
export async function restockWaiting(env: Env): Promise<Record<string, number>> {
  const d = await table(env);
  if (!d) return {};
  const { results } = await d.prepare('SELECT product_id, COUNT(*) AS n FROM restock GROUP BY product_id').all<{ product_id: string; n: number }>();
  return Object.fromEntries(results.map((r) => [r.product_id, r.n]));
}

function backInStockEmail(env: Env, to: string, name: string) {
  const shop = `${site.url}/shop/`;
  const intro = [
    'Hi,',
    `Good news: ${name} is back in stock at Maas Flow Records.`,
    `Get yours here: ${shop}`,
    'Limited pieces, so be quick.',
    "You asked us to tell you when it's back. This is the only email you get about it, and your address is now deleted.",
    'Maas Flow Records · maasflowrecords.com',
  ];
  return {
    from: env.CONTACT_FROM_EMAIL!,
    to: [to],
    reply_to: env.CONTACT_TO_EMAIL ?? site.email,
    subject: `Back in stock: ${name} - Maas Flow Records`.replace(/[\r\n]+/g, ' ').slice(0, 200),
    html: intro.map((p) => `<p style="font-family:sans-serif;line-height:1.5">${escapeHtml(p).replace(escapeHtml(shop), `<a href="${shop}">${shop}</a>`)}</p>`).join(''),
    text: intro.join('\n\n'),
  };
}

/** Hourly cron: email everyone waiting for a product that is in stock again. Never throws. */
export async function restockAlerts(env: Env, now: number): Promise<void> {
  try {
    if (!shopOpen || shopTestMode || !dropStarted(now) || !env.RESEND_API_KEY || !env.CONTACT_FROM_EMAIL) return;
    const d = await table(env);
    if (!d) return;
    const waiting = await restockWaiting(env);
    if (!Object.keys(waiting).length) return;
    const left = await stockLeft(env, now);
    const told: string[] = [];
    let batches = 0;
    for (const p of products) {
      if (!waiting[p.id] || (left.get(p.id)?.left ?? 0) <= 0) continue;
      let sent = 0;
      while (batches < BATCHES_PER_RUN) {
        const { results } = await d.prepare('SELECT email FROM restock WHERE product_id = ?1 LIMIT ?2').bind(p.id, BATCH).all<{ email: string }>();
        if (!results.length) break;
        batches++;
        const res = await fetch('https://api.resend.com/emails/batch', {
          method: 'POST',
          headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
          body: JSON.stringify(results.map((r) => backInStockEmail(env, r.email, p.name))),
        });
        if (!res.ok) {
          console.error('Restock emails failed', res.status, await res.text().catch(() => ''));
          break; // keep the addresses, try again next hour
        }
        await d.batch(results.map((r) => d.prepare('DELETE FROM restock WHERE product_id = ?1 AND email = ?2').bind(p.id, r.email)));
        sent += results.length;
      }
      if (sent) told.push(`${sent} × ${p.name}`);
    }
    if (told.length) await notifyWhatsApp(env, `📬 Back-in-stock email sent: ${told.join(', ')}. They can buy now on maasflowrecords.com/shop`);
  } catch (err) {
    console.error('Restock alerts failed', err);
  }
}
