import type { PaymentProvider } from './types';
import { sendMail } from '../mail';
import { eur, itemsText } from './notify';

/**
 * "Manual" provider — no payment processor needed.
 * The order is emailed to the label, which then sends the customer a payment
 * link / invoice by hand (e.g. Tikkie, bank transfer or PayPal request).
 * Used when both online payment methods are switched off in the admin panel.
 */
export const manualProvider: PaymentProvider = {
  id: 'manual',
  configured: () => true,
  async createCheckout(order, env) {
    const items = itemsText(order.lines);
    const c = order.customer;

    await sendMail(env, {
      subject: `[Order ${order.orderId}] ${c.name} — ${eur(order.total)}`,
      replyTo: c.email,
      fields: [
        ['Order', order.orderId],
        ['Items', items],
        ['Subtotal', eur(order.subtotal)],
        ['Shipping', `${eur(order.shipping)} (${order.shippingZone})`],
        ['Total', eur(order.total)],
        ['Name', c.name],
        ['Email', c.email],
        ['Address', `${c.address}\n${c.postalCode} ${c.city}\n${c.country}`],
        ['Notes', c.notes],
        ['Next step', 'Send the customer a payment request, then ship after payment.'],
      ],
    });

    // Confirmation to the customer.
    await sendMail(env, {
      to: c.email,
      subject: `Your Maas Flow Records order ${order.orderId}`,
      fields: [
        ['Thank you', `Hi ${c.name}, we received your order. You'll get a payment request from us by email within 1–2 working days. Your order ships after payment.`],
        ['Order', order.orderId],
        ['Items', items],
        ['Total', `${eur(order.total)} (incl. ${eur(order.shipping)} shipping)`],
        ['Questions', 'Reply to this email or write to info@maasflowrecords.com'],
      ],
    }).catch((err) => console.error('Customer confirmation failed', err));

    return {
      message: `Order ${order.orderId} received. We'll email you a payment request within 1–2 working days — your order ships after payment.`,
    };
  },
};
