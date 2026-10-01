import data from '../content/services.json';
import { opt } from './clean';

/**
 * Services page content — edited in the admin panel (Site → Services) or src/content/services.json.
 * Also read by functions/api/services.ts to validate the chosen package.
 */
export interface ServicePackage {
  id: string;
  name: string;
  stems: string;
  /** Display text, e.g. "€40" — empty in the content file = "Price on request". */
  price: string;
}

const priceText = (raw: unknown) => {
  const v = String(raw ?? '').trim();
  if (!v) return 'Price on request';
  return /^\d+([.,]\d{1,2})?$/.test(v) ? `€${v.replace('.', ',')}` : v;
};

export const beats = {
  intro: opt(data.beats?.intro) ?? '',
  beatstars: opt(data.beats?.beatstars),
  youtube: opt(data.beats?.youtube),
};

export const mixing = {
  intro: opt(data.mixing?.intro) ?? '',
  turnaround: opt(data.mixing?.turnaround),
  packages: (data.mixing?.packages ?? [])
    .map((p): ServicePackage => ({
      id: String(p.id ?? '').trim(),
      name: String(p.name ?? '').trim(),
      stems: String(p.stems ?? '').trim(),
      price: priceText(p.price),
    }))
    .filter((p) => p.id && p.name),
};

/** Request types offered in the services form. */
export const requestTypes = [
  ...mixing.packages.map((p) => ({ value: p.id, label: `${p.name} — ${p.stems}` })),
  { value: 'custom-beat', label: 'Custom beat' },
  { value: 'other', label: 'Other / not sure' },
];
