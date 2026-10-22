import { LOCALES, type Lang } from '../i18n';
import type { Product, ProductCategory, ShippingZone } from './types';
import data from '../content/products.json';
import shop from '../content/shop.json';
import { opt } from './clean';

/**
 * Shop catalogue — edited in the admin panel (/admin → Shop products) or src/content/products.json.
 * This is ALSO read by the checkout function on the server, so prices/stock here are the
 * source of truth (the browser can't change them).
 *
 * In the content file prices are in euros (12.5 = €12.50); here they become cents.
 */
type RawProduct = (typeof data.products)[number] & Record<string, unknown>;

const count = (v: unknown) => Math.max(0, Math.floor(Number(v) || 0));

/**
 * Sizes are saved as [{ size: 'M', stock: 3 }, …] (stock per size). Older files have plain names ['M', 'L'];
 * those keep the one stock number of the product.
 */
function readSizes(raw: unknown): { sizes?: string[]; sizeStock?: Record<string, number> } {
  const entries = (Array.isArray(raw) ? raw : [])
    .map((x) => (typeof x === 'string' ? { size: x.trim(), stock: null } : {
      size: String((x as { size?: unknown })?.size ?? '').trim(),
      stock: (x as { stock?: unknown })?.stock === undefined || (x as { stock?: unknown }).stock === '' || (x as { stock?: unknown }).stock === null ? null : count((x as { stock: unknown }).stock),
    }))
    .filter((e) => e.size);
  if (!entries.length) return {};
  const sizes = [...new Set(entries.map((e) => e.size))];
  if (entries.some((e) => e.stock === null)) return { sizes };
  return { sizes, sizeStock: Object.fromEntries(sizes.map((s) => [s, entries.find((e) => e.size === s)!.stock!])) };
}

const singles: Product[] = (data.products as RawProduct[])
  .map((p): Product => {
    const { sizes, sizeStock } = readSizes(p.sizes);
    return {
      id: p.id,
      name: p.name,
      category: p.category as ProductCategory,
      description: p.description ?? '',
      price: Math.round(Number(p.price) * 100),
      image: p.image,
      // With stock per size, the product's stock is the total of all sizes.
      stock: sizeStock ? Object.values(sizeStock).reduce((a, b) => a + b, 0) : count(p.stock),
      preorder: p.preorder === true,
      sizes,
      ...(sizeStock ? { sizeStock } : {}),
      shippingClass: p.shippingClass === 'standard' ? 'standard' : 'small',
      ...(/^\d{4}-\d\d-\d\d/.test(String(p.added ?? '')) ? { added: String(p.added).slice(0, 10) } : {}),
      ...(p.category === 'Bundle' ? { bundle: (Array.isArray(p.bundle) ? p.bundle : []).map((x) => String(x)) } : {}),
    };
  })
  .filter((p) => opt(p.id) && opt(p.name));

/**
 * A bundle's stock comes from the products inside it: as many as the scarcest one allows. When one product
 * inside has sizes, the bundle has those sizes too (stock per size). Bundles without (valid) products are left out.
 */
export function bundleStock(items: Product[], left: (p: Product, size?: string) => number): { stock: number; sizes?: string[]; sizeStock?: Record<string, number> } {
  const sized = items.find((x) => x.sizes?.length);
  const others = items.filter((x) => x !== sized);
  const min = (extra: number[]) => Math.max(0, Math.min(...extra, ...others.map((x) => left(x))));
  if (!sized) return { stock: items.length ? min([]) : 0 };
  const sizeStock = Object.fromEntries(sized.sizes!.map((s) => [s, min([left(sized, s)])]));
  // All sizes together can't go past the other products (2 M + 3 L would need 5 CDs).
  const total = Math.min(Object.values(sizeStock).reduce((a, b) => a + b, 0), min([Infinity]));
  return { stock: total, sizes: sized.sizes, sizeStock };
}

const buildLeft = (p: Product, size?: string) => (size && p.sizeStock ? p.sizeStock[size] ?? 0 : p.stock);

export const products: Product[] = singles
  .map((p): Product => {
    if (!p.bundle) return p;
    const items = p.bundle.map((id) => singles.find((x) => x.id === id && !x.bundle)).filter((x): x is Product => !!x);
    const { stock, sizes, sizeStock } = bundleStock(items, buildLeft);
    return { ...p, bundle: items.map((x) => x.id), stock, sizes, ...(sizeStock ? { sizeStock } : { sizeStock: undefined }) };
  })
  .filter((p) => !p.bundle || p.bundle.length >= 2);

/** Shipping from Luxembourg — edited in the admin panel (Site → Shipping & VAT). Prices in € there, cents here. */
export const shippingZones: ShippingZone[] = (shop.shipping as Record<string, unknown>[])
  .map((z): ShippingZone => {
    const raw = z.price;
    const n = raw === '' || raw === null || raw === undefined ? NaN : Number(String(raw).replace(',', '.'));
    return {
      id: String(z.id ?? ''),
      label: String(z.label ?? ''),
      price: Number.isFinite(n) && n >= 0 ? Math.round(n * 100) : undefined,
      estimate: String(z.estimate ?? ''),
      inEU: z.inEU !== false,
    };
  })
  .filter((z) => z.id && z.label);

/** Zones customers can order to (shipping price is set). */
export const orderableZones = shippingZones.filter((z) => z.price !== undefined);

export const MAX_QTY_PER_ITEM = 10;

export const getProduct = (id: string) => products.find((p) => p.id === id);

export const formatPrice = (cents: number, lang: Lang = 'en') =>
  new Intl.NumberFormat(lang === 'en' ? 'en-IE' : LOCALES[lang], { style: 'currency', currency: 'EUR' }).format(cents / 100);
