import type { Product, ProductCategory, ShippingZone } from './types';
import data from '../content/products.json';
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

export const shippingZones: ShippingZone[] = [
  { id: 'nl', label: 'Netherlands', rates: { small: 495, standard: 695 }, estimate: '1–3 business days' },
  { id: 'eu', label: 'European Union', rates: { small: 995, standard: 1495 }, estimate: '3–7 business days' },
  { id: 'world', label: 'Rest of the world', rates: { small: 1695, standard: 2495 }, estimate: '7–15 business days' },
];

export const MAX_QTY_PER_ITEM = 10;

export const getProduct = (id: string) => products.find((p) => p.id === id);

export const formatPrice = (cents: number) =>
  new Intl.NumberFormat('en-IE', { style: 'currency', currency: 'EUR' }).format(cents / 100);
