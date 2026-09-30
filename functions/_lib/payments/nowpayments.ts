import type { PaymentProvider } from './types';
import { sendMail } from '../mail';
import { eur, itemsText } from './notify';
import { shopTestMode } from '../../../src/data/site';

// Test mode uses the sandbox (separate account + API key at account-sandbox.nowpayments.io).
const API = shopTestMode ? 'https://api-sandbox.nowpayments.io' : 'https://api.nowpayments.io';

/**
 * Crypto payments via a NOWPayments hosted invoice (https://documenter.getpostman.com/view/7907941/2s93JusNJt).
 * The customer picks the coin on NOWPayments' page. Payment is confirmed by
 * functions/api/webhooks/crypto.ts (IPN).
 *
 * NOWPayments' notification doesn't carry the shipping address, so the full order is
 * emailed to the label now ("awaiting payment") and the IPN later sends "PAID".
 */
export const nowPaymentsProvider: PaymentProvider = {
  id: 'crypto',
  configured: (env) => !!env.NOWPAYMENTS_API_KEY && !!env.NOWPAYMENTS_IPN_SECRET,
  async createCheckout(order, env, origin) {
    const c = order.customer;
    const items = itemsText(order.lines);

    const res = await fetch(`${API}/v1/invoice`, {
      method: 'POST',
      headers: { 'x-api-key': env.NOWPAYMENTS_API_KEY!, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        price_amount: order.total / 100,
        price_currency: 'eur',
        order_id: order.orderId,
        order_description: `Maas Flow Records — ${order.lines.map((l) => `${l.qty}× ${l.name}`).join(', ')}`.slice(0, 200),
        // The customer's email rides along so the confirmation can be sent when the payment lands.
        ipn_callback_url: `${origin}/api/webhooks/crypto?e=${encodeURIComponent(c.email)}`,
        success_url: `${origin}/order/?status=paid&method=crypto&order=${encodeURIComponent(order.orderId)}`,
        cancel_url: `${origin}/cart/?payment=cancelled`,
      }),
    });
    const data = (await res.json().catch(() => ({}))) as { id?: string; invoice_url?: string; message?: string };
    if (!res.ok || !data.invoice_url) throw new Error(`NOWPayments: ${res.status} ${data.message ?? ''}`);

    await sendMail(env, {
      subject: `${shopTestMode ? '[TEST] ' : ''}[Awaiting crypto payment] Order ${order.orderId} — ${eur(order.total)}`,
      replyTo: c.email,
      fields: [
        ['Status', 'AWAITING CRYPTO PAYMENT — do not ship until you receive the "[PAID]" email for this order.'],
        ['Order', order.orderId],
        ['Invoice', `NOWPayments invoice ${data.id ?? ''}`],
        ['Items', items],
        ['Subtotal', eur(order.subtotal)],
        ['Shipping', `${eur(order.shipping)} (${order.shippingZone})`],
        ['Total', eur(order.total)],
        ['Name', c.name],
        ['Email', c.email],
        ['Address', `${c.address}\n${c.postalCode} ${c.city}\n${c.country}`],
        ['Notes', c.notes],
      ],
    });

    return { redirectUrl: data.invoice_url };
  },
};
