import type { PaymentProvider } from './types';
import { sendMail } from '../mail';
import { eur, itemsText, vatText } from './notify';
import { customerTexts, itemsForCustomer, vatForCustomer } from './customer-texts';

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
      subject: `[Order ${order.orderId}] ${c.name} - ${eur(order.total)}`,
      replyTo: c.email,
      fields: [
        ['Order', order.orderId],
        ['Items', items],
        ['Subtotal', eur(order.subtotal)],
        ['Shipping', `${eur(order.shipping)} (${order.shippingZone})`],
        ['Total', eur(order.total)],
        ['VAT', vatText(order)],
        ['Name', c.name],
        ['Email', c.email],
        ['Address', `${c.address}\n${c.postalCode} ${c.city}\n${c.country}`],
        ['Notes', c.notes],
        ['Next step', 'Send the customer a payment request, then ship after payment.'],
      ],
    });

    // Confirmation to the customer.
    const lang = order.lang ?? 'en';
    const t = customerTexts(lang);
    await sendMail(env, {
      to: c.email,
      subject: t.manualSubject(order.orderId),
      fields: [
        [t.thanksLabel, t.manualThanks(c.name)],
        [t.order, order.orderId],
        [t.items, itemsForCustomer(items, lang)],
        [t.total, `${eur(order.total)} (${t.inclShipping(eur(order.shipping))})`],
        [t.vat, vatForCustomer(vatText(order), lang)],
        [t.questions, t.questionsText],
      ],
    }).catch((err) => console.error('Customer confirmation failed', err));

    return { message: t.manualMessage(order.orderId) };
  },
};
