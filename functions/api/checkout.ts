import type { Env } from '../_lib/env';
import { jsonResponse, sameOrigin, str, isEmail } from '../_lib/http';
import { checkSpam } from '../_lib/spam';
import { getProvider } from '../_lib/payments';
import type { Order, OrderLine, PaymentMethod } from '../_lib/payments/types';
// The same catalogue the website is built from — prices can't be tampered with by the browser.
import { products, shippingZones, MAX_QTY_PER_ITEM } from '../../src/data/products';
import { shopOpen, paymentMethods } from '../../src/data/site';

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  // Checkout is JS-only (the cart lives in the browser), so always answer with JSON.
  const json = jsonResponse;

  if (!shopOpen) return json(503, { ok: false, error: 'The shop is not open yet.' });
  if (!sameOrigin(request)) return json(403, { ok: false, error: 'Forbidden.' });

  let fd: FormData;
  try {
    fd = await request.formData();
  } catch {
    return json(400, { ok: false, error: 'Invalid form data.' });
  }

  const spam = await checkSpam(request, fd, env);
  if (spam) return json(400, { ok: false, error: spam });

  // ---- cart: re-price every line from the catalogue ----
  let raw: unknown;
  try {
    raw = JSON.parse(str(fd, 'cart', 10_000) || '[]');
  } catch {
    return json(400, { ok: false, error: 'Invalid cart.' });
  }
  if (!Array.isArray(raw) || raw.length === 0 || raw.length > 50) return json(400, { ok: false, error: 'Your cart is empty.' });

  const lines: OrderLine[] = [];
  for (const item of raw as { id?: unknown; size?: unknown; qty?: unknown }[]) {
    const p = products.find((x) => x.id === item?.id);
    const qty = Number(item?.qty);
    if (!p) return json(400, { ok: false, error: 'An item in your cart is no longer available.' });
    if (!Number.isInteger(qty) || qty < 1 || qty > MAX_QTY_PER_ITEM) return json(400, { ok: false, error: 'Invalid quantity.' });
    if (p.stock < qty) return json(409, { ok: false, error: `Sorry, "${p.name}" is sold out or has limited stock.` });
    const size = typeof item.size === 'string' && item.size ? item.size : undefined;
    if (p.sizes ? !size || !p.sizes.includes(size) : size) return json(400, { ok: false, error: `Please choose a valid size for "${p.name}".` });
    lines.push({ id: p.id, name: p.name, size, qty, unitPrice: p.price, preorder: !!p.preorder });
  }

  const zone = shippingZones.find((z) => z.id === str(fd, 'zone', 20));
  if (!zone) return json(400, { ok: false, error: 'Please choose a shipping destination.' });
  const shippingClass = lines.some((l) => products.find((p) => p.id === l.id)!.shippingClass === 'standard') ? 'standard' : 'small';
  const subtotal = lines.reduce((s, l) => s + l.unitPrice * l.qty, 0);
  const shipping = zone.rates[shippingClass];

  // ---- customer ----
  const customer = {
    name: str(fd, 'name', 100),
    email: str(fd, 'email', 200),
    address: str(fd, 'address', 200),
    postalCode: str(fd, 'postalCode', 20),
    city: str(fd, 'city', 100),
    country: str(fd, 'country', 80),
    notes: str(fd, 'notes', 1000),
  };
  if (!customer.name || !customer.address || !customer.postalCode || !customer.city || !customer.country) {
    return json(400, { ok: false, error: 'Please fill in your shipping details.' });
  }
  if (!isEmail(customer.email)) return json(400, { ok: false, error: 'Please enter a valid email address.' });
  if (str(fd, 'terms', 5) !== 'yes') return json(400, { ok: false, error: 'Please accept the shipping & returns terms.' });

  // ---- payment method (switched on/off in the admin panel) ----
  const enabled = (['card', 'crypto'] as const).filter((m) => paymentMethods[m]);
  let method: PaymentMethod = 'manual';
  if (enabled.length) {
    const chosen = str(fd, 'method', 10);
    const match = enabled.find((m) => m === chosen);
    if (!match) return json(400, { ok: false, error: 'Please choose a payment method.' });
    method = match;
  }
  const provider = getProvider(method);
  if (!provider.configured(env)) {
    return json(503, { ok: false, error: 'This payment method is not available right now. Please choose another one or email us.' });
  }

  const order: Order = {
    method,
    orderId: `MFR-${new Date().toISOString().slice(2, 10).replace(/-/g, '')}-${crypto.randomUUID().slice(0, 6).toUpperCase()}`,
    lines,
    subtotal,
    shipping,
    total: subtotal + shipping,
    currency: 'EUR',
    shippingZone: zone.label,
    customer,
  };

  try {
    const result = await provider.createCheckout(order, env, new URL(request.url).origin);
    return json(200, { ok: true, orderId: order.orderId, ...result });
  } catch (err) {
    console.error(err);
    return json(502, { ok: false, error: 'Checkout is temporarily unavailable.' });
  }
};
