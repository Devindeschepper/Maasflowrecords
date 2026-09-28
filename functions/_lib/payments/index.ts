import type { PaymentProvider } from './types';
import { manualProvider } from './manual';

/** Registered providers. Add new ones here (see types.ts). */
const providers: Record<string, PaymentProvider> = {
  [manualProvider.id]: manualProvider,
};

export function getProvider(id: string | undefined): PaymentProvider | undefined {
  return providers[id || 'manual'];
}
