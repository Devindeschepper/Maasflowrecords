import type { Env } from '../_lib/env';
import { jsonResponse, sameOrigin } from '../_lib/http';
import { db } from '../_lib/studio';
import { checkStatsPassword } from './studio';
import { markShipped, shopOrders, shopStats, type ShopOrder } from '../_lib/sales';
import { toBase64, xlsx } from '../_lib/xlsx';
import { githubConfigured, readFile, updateJson, writeFile } from '../_lib/github';
import { restockWaiting } from '../_lib/restock';
import { CODE_PATTERN, cleanCode, deleteCode, listCodes, saveCode } from '../_lib/discounts';
import { legal, site } from '../../src/data/site';

/**
 * Private shop page (/shop-admin/), same password as /studio-stats/:
 *   GET  /api/shop          sales, stock, countries and the orders to ship
 *   POST /api/shop/shipped  { orderId, shipped } ticks an order as shipped (or undoes it)
 *   GET  /api/shop/export   Excel of the orders to ship (packing list with addresses)
 *   GET  /api/shop/manage   shop switches and products (from the repository)
 *   POST /api/shop/settings open/close the shop, plan a timed drop, test mode on/off
 *   POST /api/shop/products add, edit or remove a product (with photo)
 *   POST /api/shop/discounts add, change or delete a discount code
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
  return jsonResponse(200, {
    ok: true, stats: await shopStats(env, now, monthStartNow(now)), ...(await shopOrders(env)),
    discounts: await listCodes(env),
    // Sender on the package labels.
    sender: { name: legal.name || site.name, address: legal.address },
  });
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

/** POST /api/shop/discounts { action: 'save', code, percent, maxUses?, endsAt? } or { action: 'remove', code } */
export const onDiscounts: PagesFunction<Env> = async ({ request, env }) => {
  if (!sameOrigin(request)) return jsonResponse(403, { ok: false, error: 'Forbidden.' });
  const a = await auth(request, env);
  if (a instanceof Response) return a;
  const body = (await request.json().catch(() => ({}))) as { action?: unknown; code?: unknown; percent?: unknown; maxUses?: unknown; endsAt?: unknown };
  const code = cleanCode(body.code);
  if (!CODE_PATTERN.test(code)) return jsonResponse(400, { ok: false, error: 'The code needs 3 to 20 letters or numbers (no spaces), e.g. MAAS10.' });
  if (body.action === 'remove') {
    await deleteCode(env, code);
    return jsonResponse(200, { ok: true, discounts: await listCodes(env) });
  }
  const percent = Number(body.percent);
  if (!Number.isInteger(percent) || percent < 1 || percent > 90) return jsonResponse(400, { ok: false, error: 'The discount must be between 1 and 90 %.' });
  const maxUses = body.maxUses === null || body.maxUses === '' || body.maxUses === undefined ? null : Number(body.maxUses);
  if (maxUses !== null && (!Number.isInteger(maxUses) || maxUses < 1 || maxUses > 100000)) return jsonResponse(400, { ok: false, error: 'How many times: leave empty for unlimited, or a number from 1.' });
  const endsAt = body.endsAt === null || body.endsAt === '' || body.endsAt === undefined ? null : Date.parse(String(body.endsAt));
  if (endsAt !== null && (!Number.isFinite(endsAt) || endsAt < Date.now())) return jsonResponse(400, { ok: false, error: 'The end date must be in the future.' });
  await saveCode(env, { code, percent, maxUses, endsAt });
  return jsonResponse(200, { ok: true, discounts: await listCodes(env) });
};

// ---- Managing the shop from the page: open/close, test mode, products ----------------------------------------
// Changes are saved in the repository (src/content/*.json) through the GitHub API; Cloudflare then rebuilds the
// site, so they are live after about 2 minutes. Needs the GITHUB_TOKEN secret.

type RawProduct = {
  id: string; name: string; category: string; description?: string; price: number; image: string;
  stock: number; preorder?: boolean; sizes?: (string | { size: string; stock: number })[]; shippingClass?: string;
};
type Settings = { shopOpen?: boolean; shopTestMode?: boolean; dropAt?: string; legalName?: string; legalAddress?: string } & Record<string, unknown>;

const CATEGORIES = ['CD', 'Vinyl', 'T-Shirt', 'Hoodie', 'Cap', 'Poster', 'Jewellery', 'Other'];
const SETTINGS = 'src/content/settings.json';
const PRODUCTS = 'src/content/products.json';
const SHOP = 'src/content/shop.json';
const PLACEHOLDER = '/images/shop/cd.svg';

const noGithub = () =>
  jsonResponse(503, { ok: false, error: 'Not set up yet: add the GITHUB_TOKEN secret in Cloudflare (see the instructions from Claude).' });

/** What's still missing before the shop can open (empty = ready). */
async function missingForOpening(env: Env, testMode: boolean): Promise<string[]> {
  const missing: string[] = [];
  const products = JSON.parse((await readFile(env, PRODUCTS))?.text ?? '{"products":[]}') as { products: RawProduct[] };
  if (!products.products.some((p) => p.price > 0)) missing.push('at least one product with a price');
  const shop = JSON.parse((await readFile(env, SHOP))?.text ?? '{}') as { shipping?: { price?: unknown }[] };
  if (!(shop.shipping ?? []).some((z) => z.price !== '' && z.price !== null && z.price !== undefined)) missing.push('a shipping price (admin panel → Site → Shipping & VAT)');
  if (!testMode) {
    const settings = JSON.parse((await readFile(env, SETTINGS))?.text ?? '{}') as Settings;
    if (!settings.legalName?.trim() || !settings.legalAddress?.trim()) missing.push('your legal name and address (admin panel → Site → Settings), required by EU law');
  }
  return missing;
}

/** GET /api/shop/manage: shop switches and the product list as they are saved right now. */
export const onManage: PagesFunction<Env> = async ({ request, env }) => {
  const a = await auth(request, env);
  if (a instanceof Response) return a;
  if (!githubConfigured(env)) return jsonResponse(200, { ok: true, github: false });
  try {
    const settings = JSON.parse((await readFile(env, SETTINGS))!.text) as Settings;
    const products = JSON.parse((await readFile(env, PRODUCTS))!.text) as { products: RawProduct[] };
    return jsonResponse(200, {
      ok: true, github: true, categories: CATEGORIES,
      shopOpen: settings.shopOpen === true, shopTestMode: settings.shopTestMode === true,
      dropAt: settings.shopOpen !== true && settings.dropAt ? settings.dropAt : null,
      products: products.products,
      waiting: await restockWaiting(env).catch(() => ({})),
    });
  } catch (err) {
    console.error('Shop manage failed', err);
    return jsonResponse(502, { ok: false, error: "Couldn't read the shop settings from GitHub. Check the GITHUB_TOKEN." });
  }
};

/**
 * POST /api/shop/settings { shopOpen?, shopTestMode?, dropAt? }
 * dropAt: an ISO date to open the shop by itself at that moment (null = cancel the drop). Opening or closing
 * the shop by hand also cancels a planned drop.
 */
export const onSettings: PagesFunction<Env> = async ({ request, env }) => {
  if (!sameOrigin(request)) return jsonResponse(403, { ok: false, error: 'Forbidden.' });
  const a = await auth(request, env);
  if (a instanceof Response) return a;
  if (!githubConfigured(env)) return noGithub();
  const body = (await request.json().catch(() => ({}))) as { shopOpen?: unknown; shopTestMode?: unknown; dropAt?: unknown };
  try {
    const current = JSON.parse((await readFile(env, SETTINGS))!.text) as Settings;
    const open = typeof body.shopOpen === 'boolean' ? body.shopOpen : current.shopOpen === true;
    const test = typeof body.shopTestMode === 'boolean' ? body.shopTestMode : current.shopTestMode === true;
    let drop = typeof body.shopOpen === 'boolean' || open ? null : (current.dropAt ?? null);
    if (body.dropAt === null) drop = null;
    else if (typeof body.dropAt === 'string') {
      const t = Date.parse(body.dropAt);
      const now = Date.now();
      if (open) return jsonResponse(409, { ok: false, error: 'The shop is already open. Close it first to plan a drop.' });
      if (!Number.isFinite(t) || t < now + 5 * 60_000) return jsonResponse(400, { ok: false, error: 'Pick a time at least 5 minutes from now.' });
      if (t > now + 366 * 86400_000) return jsonResponse(400, { ok: false, error: 'Pick a time within the next year.' });
      drop = new Date(t).toISOString();
    }
    if (open || drop) {
      const missing = await missingForOpening(env, test);
      if (missing.length) return jsonResponse(409, { ok: false, error: `Before the shop can open, it still needs: ${missing.join('; ')}.` });
    }
    const what = typeof body.shopOpen === 'boolean' ? (open ? 'open the shop' : 'close the shop')
      : body.dropAt !== undefined ? (drop ? `timed drop at ${drop}` : 'cancel the timed drop')
      : `test mode ${test ? 'on' : 'off'}`;
    await updateJson<Settings>(env, SETTINGS, `Shop: ${what} (from the shop page)`, (s) => {
      const next: Settings = { ...s, shopOpen: open, shopTestMode: test, dropAt: drop ?? undefined };
      if (!drop) delete next.dropAt;
      return next;
    });
    return jsonResponse(200, { ok: true, shopOpen: open, shopTestMode: test, dropAt: drop });
  } catch (err) {
    console.error('Shop settings failed', err);
    return jsonResponse(502, { ok: false, error: err instanceof Error ? err.message : 'Could not save.' });
  }
};

const slug = (s: string) =>
  s.normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 50) || 'product';

/** POST /api/shop/products { action: 'save', product, image? } or { action: 'remove', id } */
export const onProducts: PagesFunction<Env> = async ({ request, env }) => {
  if (!sameOrigin(request)) return jsonResponse(403, { ok: false, error: 'Forbidden.' });
  const a = await auth(request, env);
  if (a instanceof Response) return a;
  if (!githubConfigured(env)) return noGithub();
  const body = (await request.json().catch(() => ({}))) as {
    action?: string; id?: string;
    product?: Partial<RawProduct> & { isNew?: boolean };
    image?: { type?: string; data?: string };
  };
  try {
    if (body.action === 'remove') {
      if (typeof body.id !== 'string') return jsonResponse(400, { ok: false, error: 'Unknown product.' });
      await updateJson<{ products: RawProduct[] }>(env, PRODUCTS, `Shop: remove product ${body.id} (from the shop page)`, (d) => ({ ...d, products: d.products.filter((p) => p.id !== body.id) }));
      return jsonResponse(200, { ok: true });
    }

    // Check every field; the shop and checkout read this file, so nothing odd may get in.
    const p = body.product ?? {};
    const name = String(p.name ?? '').trim().slice(0, 80);
    const category = CATEGORIES.includes(String(p.category)) ? String(p.category) : '';
    const price = Math.round(Number(p.price) * 100) / 100;
    if (!name) return jsonResponse(400, { ok: false, error: 'Give the product a name.' });
    if (!category) return jsonResponse(400, { ok: false, error: 'Choose a category.' });
    if (!Number.isFinite(price) || price <= 0 || price > 10000) return jsonResponse(400, { ok: false, error: 'Enter a price, for example 15 or 24.90.' });
    // Sizes come with their own stock: [{ size: 'M', stock: 3 }]. Without sizes the product has one stock number.
    const sizes: { size: string; stock: number }[] = [];
    for (const x of (Array.isArray(p.sizes) ? p.sizes : []).slice(0, 20)) {
      const size = String(typeof x === 'string' ? x : x?.size ?? '').trim().slice(0, 20);
      const n = Math.floor(Number(typeof x === 'string' ? NaN : x?.stock));
      if (!size || sizes.some((s) => s.size === size)) continue;
      if (!Number.isFinite(n) || n < 0 || n > 100000) return jsonResponse(400, { ok: false, error: `Enter how many you have in size ${size} (0 or more).` });
      sizes.push({ size, stock: n });
    }
    const stock = sizes.length ? sizes.reduce((a, s) => a + s.stock, 0) : Math.floor(Number(p.stock));
    if (!Number.isFinite(stock) || stock < 0 || stock > 100000) return jsonResponse(400, { ok: false, error: 'Enter how many you have (0 or more).' });

    let image: string | undefined;
    if (body.image?.data) {
      const ext = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' }[String(body.image.type)];
      if (!ext) return jsonResponse(400, { ok: false, error: 'The photo must be a JPG, PNG or WebP.' });
      if (body.image.data.length > 5_600_000) return jsonResponse(400, { ok: false, error: 'The photo is too big (max 4 MB).' });
      image = `/images/shop/${slug(name)}-${Date.now().toString(36)}.${ext}`;
      await writeFile(env, `public${image}`, body.image.data, `Shop: photo for ${name} (from the shop page)`);
    }

    let savedId = '';
    await updateJson<{ products: RawProduct[] }>(env, PRODUCTS, `Shop: ${p.isNew ? 'add' : 'update'} ${name} (from the shop page)`, (d) => {
      const existing = p.isNew ? undefined : d.products.find((x) => x.id === p.id);
      let id = existing?.id ?? slug(name);
      if (!existing) for (let n = 2; d.products.some((x) => x.id === id); n++) id = `${slug(name)}-${n}`;
      savedId = id;
      const next: RawProduct = {
        id, name, category,
        description: String(p.description ?? '').trim().slice(0, 1000),
        price, image: image ?? existing?.image ?? PLACEHOLDER, stock,
        preorder: p.preorder === true,
        sizes,
        shippingClass: p.shippingClass === 'standard' ? 'standard' : 'small',
      };
      const products = existing ? d.products.map((x) => (x.id === id ? next : x)) : [...d.products, next];
      return { ...d, products };
    });
    return jsonResponse(200, { ok: true, id: savedId });
  } catch (err) {
    console.error('Shop products failed', err);
    return jsonResponse(502, { ok: false, error: err instanceof Error ? err.message : 'Could not save.' });
  }
};
