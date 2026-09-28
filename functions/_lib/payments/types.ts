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

export interface Order {
  orderId: string;
  lines: OrderLine[];
  subtotal: number;
  shipping: number;
  total: number;
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
 * To add one (e.g. Mollie, Stripe, PayPal): create a file in this folder that
 * implements this interface using the provider's REST API + a secret from `env`,
 * register it in ./index.ts, and set PAYMENT_PROVIDER to its id.
 * You will also need a webhook function (functions/api/webhooks/<provider>.ts)
 * to confirm payment and update stock.
 */
export interface PaymentProvider {
  id: string;
  createCheckout(order: Order, env: Env, origin: string): Promise<CheckoutResult>;
}
