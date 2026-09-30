import type { Env } from '../../_lib/env';
import { jsonResponse, isEmail } from '../../_lib/http';
import { hmacHex, safeEqual } from '../../_lib/sign';
import { mailPaidOrder } from '../../_lib/payments/notify';
import { sendMail } from '../../_lib/mail';

interface Ipn {
  payment_id?: number | string;
  payment_status?: string;
  order_id?: string;
  order_description?: string;
  price_amount?: number;
  price_currency?: string;
  pay_amount?: number;
  actually_paid?: number;
  pay_currency?: string;
}

/**
 * NOWPayments IPN (payment notification). The URL is set per invoice by the crypto provider;
 * set the IPN secret (NOWPayments → Settings → Payments → IPN) in NOWPAYMENTS_IPN_SECRET.
 * NOWPayments may notify more than once per status.
 */
export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  if (!env.NOWPAYMENTS_IPN_SECRET) return jsonResponse(503, { ok: false, error: 'Not configured.' });

  const raw = await request.text();
  let body: Ipn;
  try {
    body = JSON.parse(raw);
  } catch {
    return jsonResponse(400, { ok: false, error: 'Invalid body.' });
  }
  // Signature = HMAC-SHA512 of the body with keys sorted alphabetically.
  const expected = await hmacHex('SHA-512', env.NOWPAYMENTS_IPN_SECRET, JSON.stringify(sortKeys(body)));
  if (!safeEqual(request.headers.get('x-nowpayments-sig') ?? '', expected)) {
    return jsonResponse(400, { ok: false, error: 'Invalid signature.' });
  }

  const email = new URL(request.url).searchParams.get('e') ?? '';
  const orderId = body.order_id ?? '?';
  const paid = `${body.actually_paid ?? body.pay_amount ?? '?'} ${String(body.pay_currency ?? '').toUpperCase()} (${body.price_amount ?? '?'} ${String(body.price_currency ?? '').toUpperCase()})`;

  try {
    if (body.payment_status === 'finished') {
      await mailPaidOrder(env, {
        orderId,
        via: 'Crypto (NOWPayments)',
        reference: String(body.payment_id ?? ''),
        items: body.order_description ?? '',
        paid,
        customer: { email: isEmail(email) ? email : undefined },
      });
    } else if (body.payment_status === 'partially_paid') {
      await sendMail(env, {
        subject: `[Partly paid] Crypto order ${orderId}`,
        fields: [
          ['Status', 'The customer sent LESS than the invoice amount. Do not ship yet — contact the customer.'],
          ['Order', orderId],
          ['Received', paid],
          ['Payment id', String(body.payment_id ?? '')],
          ['Customer email', email],
        ],
      });
    }
  } catch (err) {
    console.error(err);
    return jsonResponse(500, { ok: false, error: 'Could not send the order email.' });
  }
  return jsonResponse(200, { ok: true });
};

function sortKeys(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(sortKeys);
  if (v && typeof v === 'object') {
    return Object.fromEntries(Object.keys(v).sort().map((k) => [k, sortKeys((v as Record<string, unknown>)[k])]));
  }
  return v;
}
