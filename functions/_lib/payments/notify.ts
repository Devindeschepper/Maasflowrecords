import type { Env } from '../env';
import type { OrderLine } from './types';
import { sendMail } from '../mail';
import { shopTestMode } from '../../../src/data/site';

const test = shopTestMode ? '[TEST] ' : '';

export const eur = (cents: number) => `€${(cents / 100).toFixed(2)}`;

export const itemsText = (lines: OrderLine[]) =>
  lines
    .map((l) => `${l.qty} × ${l.name}${l.size ? ` (${l.size})` : ''} — ${eur(l.unitPrice * l.qty)}${l.preorder ? ' [PRE-ORDER]' : ''}`)
    .join('\n');

/** "Incl. 17% VAT: €2.47" */
export const vatText = (o: { vat: number; vatNote: string }) => (o.vat ? `${o.vatNote}: ${eur(o.vat)}` : o.vatNote);

export interface PaidOrder {
  orderId: string;
  /** e.g. "Stripe (card / PayPal / Apple Pay…)" or "Crypto (NOWPayments)" */
  via: string;
  /** Payment reference at the provider (Stripe payment intent, NOWPayments payment id). */
  reference: string;
  items: string;
  /** Amount actually charged, as text (e.g. "€16.95" or "0.00041 BTC (€16.95)"). */
  paid: string;
  vat?: string;
  shippingZone?: string;
  customer: { name?: string; email?: string; address?: string };
  notes?: string;
}

/** Emails a confirmed payment to the label and a confirmation to the customer. */
export async function mailPaidOrder(env: Env, o: PaidOrder): Promise<void> {
  await sendMail(env, {
    subject: `${test}[PAID] Order ${o.orderId} — ${o.paid}`,
    replyTo: o.customer.email,
    fields: [
      ['Status', 'PAID — ready to ship'],
      ['Order', o.orderId],
      ['Paid via', `${o.via} · ref ${o.reference}`],
      ['Amount', o.paid],
      ['VAT', o.vat ?? ''],
      ['Items', o.items],
      ['Ship to', o.customer.address ? `${o.customer.name ?? ''}\n${o.customer.address}` : 'See the "awaiting payment" email for this order number.'],
      ['Shipping zone', o.shippingZone ?? ''],
      ['Email', o.customer.email ?? ''],
      ['Notes', o.notes ?? ''],
      ['Next step', 'Pack and ship the order, then lower the stock in the admin panel (Site → Shop).'],
    ],
  });

  if (o.customer.email) {
    await sendMail(env, {
      to: o.customer.email,
      subject: `${test}Payment received — Maas Flow Records order ${o.orderId}`,
      fields: [
        ['Thank you', `${o.customer.name ? `Hi ${o.customer.name}, t` : 'T'}hanks for your order! Your payment was received. Pre-orders ship on or around the release date; you'll get an email when it's on the way.`],
        ['Order', o.orderId],
        ['Items', o.items],
        ['Paid', o.paid],
        ['VAT', o.vat ?? ''],
        ['Questions', 'Reply to this email or write to info@maasflowrecords.com'],
      ],
    }).catch((err) => console.error('Customer confirmation failed', err));
  }
}
