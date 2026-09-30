import shop from '../content/shop.json';

/**
 * VAT settings (admin panel → Site → Shipping & VAT). The business is based in Luxembourg.
 *  included = prices include Luxembourg VAT (default 17%). Orders shipped outside the EU are
 *             exports: the VAT is taken off the price.
 *  exempt   = small-business VAT exemption (turnover under the Luxembourg threshold): no VAT is charged.
 * Used by the cart (display) and by the checkout function (the amounts actually charged).
 */
export const vat = {
  mode: shop.vat?.mode === 'exempt' ? ('exempt' as const) : ('included' as const),
  rate: Number(shop.vat?.rate) > 0 ? Number(shop.vat.rate) : 17,
};

/** What the customer pays for a VAT-inclusive price (cents), depending on where it ships. */
export const priceForZone = (gross: number, inEU: boolean) =>
  vat.mode === 'included' && !inEU ? Math.round((gross * 100) / (100 + vat.rate)) : gross;

/** The VAT contained in an amount paid for a zone (cents). */
export const vatIn = (amount: number, inEU: boolean) =>
  vat.mode === 'included' && inEU ? amount - Math.round((amount * 100) / (100 + vat.rate)) : 0;

/** Short line shown under the total. */
export const vatNote = (inEU: boolean) =>
  vat.mode === 'exempt'
    ? 'No VAT charged (small business exemption)'
    : inEU
      ? `Incl. ${vat.rate}% VAT`
      : 'No EU VAT (export). Import taxes may apply in your country.';
