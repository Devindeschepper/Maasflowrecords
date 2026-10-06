import type { PaymentProvider } from './types';
import { itemsText, vatText } from './notify';
import { shopTestMode } from '../../../src/data/site';

/**
 * Stripe Checkout (https://docs.stripe.com/api/checkout/sessions/create).
 * No payment method types are passed, so Checkout shows every method switched on in the
 * Stripe dashboard (Settings → Payment methods): card, iDEAL, PayPal, Bancontact, Apple Pay…
 * Payment is confirmed by functions/api/webhooks/stripe.ts.
 */
export const stripeProvider: PaymentProvider = {
  id: 'card',
  // In test mode only a test key is accepted, so no real card can be charged by accident.
  configured: (env) =>
    !!env.STRIPE_SECRET_KEY && !!env.STRIPE_WEBHOOK_SECRET && (!shopTestMode || env.STRIPE_SECRET_KEY.startsWith('sk_test_')),
  async createCheckout(order, env, origin) {
    const c = order.customer;
    const p = new URLSearchParams({
      mode: 'payment',
      locale: 'auto',
      client_reference_id: order.orderId,
      customer_email: c.email,
      success_url: `${origin}/order/?status=paid&order=${encodeURIComponent(order.orderId)}`,
      cancel_url: `${origin}/cart/?payment=cancelled`,
      'shipping_options[0][shipping_rate_data][type]': 'fixed_amount',
      'shipping_options[0][shipping_rate_data][display_name]': `Shipping - ${order.shippingZone}`,
      'shipping_options[0][shipping_rate_data][fixed_amount][amount]': String(order.shipping),
      'shipping_options[0][shipping_rate_data][fixed_amount][currency]': 'eur',
      'payment_intent_data[metadata][order_id]': order.orderId,
    });
    order.lines.forEach((l, i) => {
      p.set(`line_items[${i}][quantity]`, String(l.qty));
      p.set(`line_items[${i}][price_data][currency]`, 'eur');
      p.set(`line_items[${i}][price_data][unit_amount]`, String(l.unitPrice));
      p.set(`line_items[${i}][price_data][product_data][name]`, `${l.name}${l.size ? ` (${l.size})` : ''}${l.preorder ? ' - pre-order' : ''}`);
    });
    // Everything needed to ship the order travels with the payment (max 500 chars per value).
    const meta: Record<string, string> = {
      order_id: order.orderId,
      items: itemsText(order.lines),
      name: c.name,
      address: `${c.address}\n${c.postalCode} ${c.city}\n${c.country}`,
      zone: order.shippingZone,
      vat: vatText(order),
      notes: c.notes,
    };
    for (const [k, v] of Object.entries(meta)) if (v) p.set(`metadata[${k}]`, v.slice(0, 500));

    const res = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${env.STRIPE_SECRET_KEY}`, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: p,
    });
    const data = (await res.json().catch(() => ({}))) as { url?: string; error?: { message?: string } };
    if (!res.ok || !data.url) throw new Error(`Stripe: ${res.status} ${data.error?.message ?? ''}`);
    return { redirectUrl: data.url };
  },
};
