import type { Lang } from './index';
import type { ProductCategory } from '../data/types';

/** Product categories as shown to visitors (the stored value stays English). */
const CATEGORIES: Record<Exclude<Lang, 'en'>, Record<ProductCategory, string>> = {
  fr: { CD: 'CD', Vinyl: 'Vinyle', 'T-Shirt': 'T-shirt', Hoodie: 'Hoodie', Cap: 'Casquette', Poster: 'Poster', Jewellery: 'Bijoux', Bundle: 'Pack', Other: 'Autre' },
  de: { CD: 'CD', Vinyl: 'Vinyl', 'T-Shirt': 'T-Shirt', Hoodie: 'Hoodie', Cap: 'Cap', Poster: 'Poster', Jewellery: 'Schmuck', Bundle: 'Bundle', Other: 'Sonstiges' },
};
export const categoryLabel = (c: ProductCategory, lang: Lang) => (lang === 'en' ? c : CATEGORIES[lang][c] ?? c);

/**
 * Shipping zone names and delivery times are typed in the admin panel (in English). The usual ones are
 * translated here; anything else is shown as typed.
 */
const ZONE_TEXT: Record<string, { fr: string; de: string }> = {
  Luxembourg: { fr: 'Luxembourg', de: 'Luxemburg' },
  'Other EU countries': { fr: 'Autres pays de l’UE', de: 'Andere EU-Länder' },
  'Rest of the world': { fr: 'Reste du monde', de: 'Rest der Welt' },
};
export function zoneText(text: string, lang: Lang): string {
  if (lang === 'en') return text;
  const known = ZONE_TEXT[text];
  if (known) return known[lang];
  // "1–2 business days" → "1–2 jours ouvrés" / "1–2 Werktage"
  const days = text.match(/^(\d+\s*[–-]\s*\d+|\d+)\s+business days?$/i);
  if (days) return `${days[1]} ${lang === 'fr' ? 'jours ouvrés' : 'Werktage'}`;
  return text;
}
