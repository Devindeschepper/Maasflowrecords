import type { Env } from '../env';

export interface OrderLine {
  id: string;
  name: string;
  size?: string;
  qty: number;
  /** euro cents */
  unitPrice: number;
  preorder: boolean;
}

export type PaymentMethod = 'card' | 'crypto' | 'manual';

export interface Order {
  orderId: string;
  method: PaymentMethod;
  lines: OrderLine[];
  subtotal: number;
  shipping: number;
  total: number;
  /** VAT contained in the total (cents); 0 when exempt or exported. */
  vat: number;
  /** e.g. "Incl. 17% VAT" */
  vatNote: string;
  currency: 'EUR';
  shippingZone: string;
  customer: {
    name: string;
    email: string;
    address: string;
    postalCode: string;
    city: string;
    country: string;
    notes: string;
  };
}

export interface CheckoutResult {
  /** Hosted payment page to send the customer to (Stripe Checkout, Mollie, PayPal…). */
  redirectUrl?: string;
  /** Message shown to the customer when there is no redirect. */
  message?: string;
}

/**
 * A payment provider turns a validated, server-priced Order into a payment.
 * Providers that redirect to a hosted payment page confirm the payment later
 * through a webhook (functions/api/webhooks/*), which emails the paid order.
 */
export interface PaymentProvider {
  id: PaymentMethod;
  /** Whether the secrets this provider needs are set. */
  configured(env: Env): boolean;
  createCheckout(order: Order, env: Env, origin: string): Promise<CheckoutResult>;
}
