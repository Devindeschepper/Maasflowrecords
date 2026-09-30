import type { PaymentMethod, PaymentProvider } from './types';
import { manualProvider } from './manual';
import { stripeProvider } from './stripe';
import { nowPaymentsProvider } from './nowpayments';

/** One provider per payment method the customer can pick at checkout. */
const providers: Record<PaymentMethod, PaymentProvider> = {
  card: stripeProvider,
  crypto: nowPaymentsProvider,
  manual: manualProvider,
};

export const getProvider = (method: PaymentMethod): PaymentProvider => providers[method];
