import type { Links } from './types';

/** Content files from the admin panel may contain empty fields — drop them. */
export const cleanLinks = (links: Record<string, unknown> | undefined): Links =>
  Object.fromEntries(
    Object.entries(links ?? {}).filter(([, v]) => typeof v === 'string' && v.trim() !== '').map(([k, v]) => [k, (v as string).trim()]),
  ) as Links;

export const opt = (v: unknown): string | undefined => (typeof v === 'string' && v.trim() !== '' ? v.trim() : undefined);

export const list = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x) => typeof x === 'string' && x.trim() !== '') : []);

/** Filename without folder/extension, e.g. '../content/releases/take-your-time.json' → 'take-your-time'. */
export const slugFromPath = (path: string) => path.split('/').pop()!.replace(/\.json$/, '');
