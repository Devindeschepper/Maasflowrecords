import type { Product, ProductCategory, ShippingZone } from './types';
import data from '../content/products.json';
import shop from '../content/shop.json';
import { list, opt } from './clean';

/**
 * Shop catalogue — edited in the admin panel (/admin → Shop products) or src/content/products.json.
 * This is ALSO read by the checkout function on the server, so prices/stock here are the
 * source of truth (the browser can't change them).
 *
 * In the content file prices are in euros (12.5 = €12.50); here they become cents.
 */
type RawProduct = (typeof data.products)[number] & Record<string, unknown>;

export const products: Product[] = (data.products as RawProduct[])
  .map(
    (p): Product => ({
      id: p.id,
      name: p.name,
      category: p.category as ProductCategory,
      description: p.description ?? '',
      price: Math.round(Number(p.price) * 100),
      image: p.image,
      stock: Math.max(0, Math.floor(Number(p.stock) || 0)),
      preorder: p.preorder === true,
      sizes: list(p.sizes).length ? list(p.sizes) : undefined,
      shippingClass: p.shippingClass === 'standard' ? 'standard' : 'small',
    }),
  )
  .filter((p) => opt(p.id) && opt(p.name));

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

export const formatPrice = (cents: number) =>
  new Intl.NumberFormat('en-IE', { style: 'currency', currency: 'EUR' }).format(cents / 100);
