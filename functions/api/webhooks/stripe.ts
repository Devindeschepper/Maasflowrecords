import type { Env } from '../../_lib/env';
import { jsonResponse } from '../../_lib/http';
import { hmacHex, safeEqual } from '../../_lib/sign';
import { eur, mailPaidOrder } from '../../_lib/payments/notify';

interface Session {
  id: string;
  payment_status: string;
  payment_intent?: string | null;
  amount_total?: number;
  customer_details?: { email?: string | null; name?: string | null } | null;
  metadata?: Record<string, string>;
}

/**
 * Stripe webhook — add this endpoint in Stripe (Developers → Webhooks):
 *   https://maasflowrecords.com/api/webhooks/stripe
 *   events: checkout.session.completed, checkout.session.async_payment_succeeded
 * and put its signing secret in STRIPE_WEBHOOK_SECRET.
 */
export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  if (!env.STRIPE_WEBHOOK_SECRET) return jsonResponse(503, { ok: false, error: 'Not configured.' });

  const raw = await request.text();
  if (!(await validSignature(request.headers.get('Stripe-Signature'), raw, env.STRIPE_WEBHOOK_SECRET))) {
    return jsonResponse(400, { ok: false, error: 'Invalid signature.' });
  }

  const event = JSON.parse(raw) as { type: string; data: { object: Session } };
  const s = event.data.object;
  const paid =
    (event.type === 'checkout.session.completed' && s.payment_status === 'paid') ||
    event.type === 'checkout.session.async_payment_succeeded';
  if (!paid) return jsonResponse(200, { ok: true, ignored: event.type });

  const m = s.metadata ?? {};
  try {
    await mailPaidOrder(env, {
      orderId: m.order_id ?? s.id,
      via: 'Stripe (card / iDEAL / PayPal)',
      reference: s.payment_intent ?? s.id,
      items: m.items ?? '',
      paid: eur(s.amount_total ?? 0),
      shippingZone: m.zone,
      customer: { name: m.name ?? s.customer_details?.name ?? undefined, email: s.customer_details?.email ?? undefined, address: m.address },
      notes: m.notes,
    });
  } catch (err) {
    console.error(err);
    // Non-2xx makes Stripe retry later, so the order email isn't lost.
    return jsonResponse(500, { ok: false, error: 'Could not send the order email.' });
  }
  return jsonResponse(200, { ok: true });
};

/** https://docs.stripe.com/webhooks#verify-manually */
async function validSignature(header: string | null, payload: string, secret: string) {
  if (!header) return false;
  const parts = header.split(',').map((p) => p.split('=') as [string, string]);
  const t = parts.find(([k]) => k === 't')?.[1];
  const sigs = parts.filter(([k]) => k === 'v1').map(([, v]) => v);
  if (!t || !sigs.length || Math.abs(Date.now() / 1000 - Number(t)) > 300) return false;
  const expected = await hmacHex('SHA-256', secret, `${t}.${payload}`);
  return sigs.some((s) => safeEqual(s, expected));
}
