import type { Env } from './env';
import { db } from './studio';

/**
 * Discount codes, made by VIN on /shop-admin/ (D1 table discounts). A code takes a percentage off the products
 * (not shipping), optionally only for a number of orders and/or until a date. A use is counted once the order
 * is paid (recordSale), so abandoned checkouts don't use up a limited code.
 */
export interface DiscountCode {
  code: string;
  percent: number;
  /** null = unlimited */
  maxUses: number | null;
  uses: number;
  /** ms timestamp; null = no end date */
  endsAt: number | null;
  createdAt: number;
}

type Row = { code: string; percent: number; max_uses: number | null; uses: number; ends_at: number | null; created_at: number };
const toCode = (r: Row): DiscountCode => ({ code: r.code, percent: r.percent, maxUses: r.max_uses, uses: r.uses, endsAt: r.ends_at, createdAt: r.created_at });

/** Codes are case-insensitive: stored and compared in capitals. */
export const cleanCode = (raw: unknown) => String(raw ?? '').trim().toUpperCase();
export const CODE_PATTERN = /^[A-Z0-9_-]{3,20}$/;

async function table(env: Env): Promise<D1Database | null> {
  const d = await db(env);
  if (!d) return null;
  await d.prepare('CREATE TABLE IF NOT EXISTS discounts (code TEXT PRIMARY KEY, percent INTEGER NOT NULL, max_uses INTEGER, uses INTEGER NOT NULL DEFAULT 0, ends_at INTEGER, created_at INTEGER NOT NULL)').run();
  return d;
}

export async function listCodes(env: Env): Promise<DiscountCode[]> {
  const d = await table(env);
  if (!d) return [];
  const { results } = await d.prepare('SELECT * FROM discounts ORDER BY created_at DESC').all<Row>();
  return results.map(toCode);
}

/** Adds a code, or changes it when it already exists (keeps its use count). */
export async function saveCode(env: Env, c: { code: string; percent: number; maxUses: number | null; endsAt: number | null }, now = Date.now()) {
  const d = await table(env);
  if (!d) throw new Error('The database is not set up.');
  await d
    .prepare('INSERT INTO discounts (code, percent, max_uses, uses, ends_at, created_at) VALUES (?1, ?2, ?3, 0, ?4, ?5) ON CONFLICT(code) DO UPDATE SET percent = ?2, max_uses = ?3, ends_at = ?4')
    .bind(c.code, c.percent, c.maxUses, c.endsAt, now)
    .run();
}

export async function deleteCode(env: Env, code: string) {
  const d = await table(env);
  await d?.prepare('DELETE FROM discounts WHERE code = ?1').bind(code).run();
}

/** The code if it can be used right now, otherwise why not. */
export async function checkCode(env: Env, raw: unknown, now = Date.now()): Promise<{ ok: true; code: DiscountCode } | { ok: false; error: string }> {
  const code = cleanCode(raw);
  if (!CODE_PATTERN.test(code)) return { ok: false, error: 'This discount code does not exist.' };
  const d = await table(env);
  const row = d ? await d.prepare('SELECT * FROM discounts WHERE code = ?1').bind(code).first<Row>() : null;
  if (!row) return { ok: false, error: 'This discount code does not exist.' };
  const c = toCode(row);
  if (c.endsAt !== null && now > c.endsAt) return { ok: false, error: 'This discount code has expired.' };
  if (c.maxUses !== null && c.uses >= c.maxUses) return { ok: false, error: 'This discount code has been used up.' };
  return { ok: true, code: c };
}

/** Price after the discount, in cents (same rounding in the cart). */
export const discounted = (cents: number, percent: number) => Math.round((cents * (100 - percent)) / 100);

/** Called once an order with a code is paid. Never throws. */
export async function countUse(env: Env, code: string) {
  try {
    const d = await table(env);
    await d?.prepare('UPDATE discounts SET uses = uses + 1 WHERE code = ?1').bind(code).run();
  } catch (err) {
    console.error('Counting the discount use failed', err);
  }
}
